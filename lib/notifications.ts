import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { logger } from '../utils/logger';

// Push delivery goes through Expo's Push API (see the `push-dispatch` Edge
// Function), so the token stored in public.users.push_token MUST be an Expo
// push token ("ExponentPushToken[...]"). Expo's service relays to FCM v1
// (Android) and APNs (iOS) for us, using the credentials configured on the EAS
// project — so the app never deals with raw FCM/APNs tokens or a Firebase
// service account.
//
// Requirements for delivery to actually work in standalone builds:
//   - Android: the project's FCM V1 service-account key is uploaded to Expo
//     (EAS credentials) — google-services.json alone is not enough.
//   - iOS: an APNs key is configured on the EAS project.

/**
 * The EAS project id is required by getExpoPushTokenAsync. Read it from the
 * app config (extra.eas.projectId / easConfig) instead of hardcoding, so it
 * always matches the project this binary was built for.
 */
function resolveProjectId(): string | undefined {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ??
    (Constants as any)?.easConfig?.projectId ??
    undefined
  );
}

/**
 * A storable push token is either an Expo push token ("ExponentPushToken[...]"
 * / "ExpoPushToken[...]") or — defensively — a raw FCM/APNs registration token
 * (a long opaque string with no whitespace). Empty strings, `null`,
 * `undefined`, and obvious junk are rejected so we never persist a value that
 * makes the server-side fan-out fail. See `push-dispatch`'s matching guard.
 */
const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[[^\]\s]+\]$/;
function isValidPushToken(token: unknown): token is string {
  if (typeof token !== 'string') return false;
  const t = token.trim();
  if (t.length === 0) return false;
  if (EXPO_TOKEN_RE.test(t)) return true;
  // Raw FCM/APNs fallback: a single opaque token of meaningful length.
  return t.length >= 32 && !/\s/.test(t);
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Create the Android 'default' notification channel. Android 8+ silently drops
 * any notification whose channel doesn't exist, and `push-dispatch` sends every
 * push with `channelId: 'default'` — so this channel MUST exist before the first
 * push arrives. Idempotent and safe to call repeatedly; a no-op on iOS. Call it
 * once at app startup (see app/_layout.tsx) so delivery never depends on the
 * user having reached the post-login registration step first.
 */
export async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#10b981',
    });
  } catch (e) {
    logger.warn('[PushChannel] failed to create default channel', e);
  }
}

export const notificationManager = {
  /**
   * Acquire an Expo push token for this device. Requests notification
   * permission if needed and returns null (silently) when the user denies it
   * or we're on a simulator. Safe to call on every launch / login.
   */
  registerForPushNotificationsAsync: async (): Promise<string | null> => {
    if (!Device.isDevice) {
      logger.info('Must use physical device for Push Notifications');
      return null;
    }

    // Ask for permission — request only if not already granted, skip silently
    // when denied.
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      logger.warn('[PushToken] permission not granted — skipping registration');
      return null;
    }

    // Android needs a notification channel before tokens deliver visibly.
    await ensureAndroidNotificationChannel();

    try {
      const projectId = resolveProjectId();
      if (!projectId) {
        logger.warn('[PushToken] EAS projectId missing from app config');
      }
      const { data: token } = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
      console.log('[PushToken] registered (expo):', token);
      return token;
    } catch (e) {
      logger.error('[PushToken] getExpoPushTokenAsync failed', e);
      return null;
    }
  },

  /**
   * Persist the Expo push token on the user's public.users row so the
   * service-role `push-dispatch` function can resolve it for fan-out.
   */
  saveTokenToProfile: async (userId: string, token: string) => {
    // Never overwrite a stored token with junk. On a simulator / denied
    // permission `registerForPushNotificationsAsync` returns null, but guard
    // here too so a bad value can't reach the DB and poison the broadcast.
    if (!isValidPushToken(token)) {
      logger.warn('[PushToken] refusing to store invalid token', { token });
      return;
    }

    try {
      // Only write when the value actually changed. This avoids clobbering a
      // valid token (and churning push_updated_at) on every launch, and stops
      // a transient bad read from overwriting good data.
      const { data: existing } = await supabase
        .from('users')
        .select('push_token')
        .eq('id', userId)
        .maybeSingle();

      if (existing?.push_token === token) {
        return; // unchanged — nothing to do.
      }

      const { error } = await supabase
        .from('users')
        .update({ push_token: token, push_updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) {
        logger.warn('[PushToken] save to public.users failed', error);
      } else {
        console.log('[PushToken] saved to public.users for', userId);
      }
    } catch (e) {
      logger.warn('[PushToken] save threw', e);
    }
  },

  notifyTechniciansInCity: async (city: string, orderDetails: any) => {
    // Fan out through the service-role `push-dispatch` Edge Function. It
    // resolves technician tokens server-side, so the client never reads other
    // users' push tokens. City scoping is not yet a server-side filter; all
    // technicians are notified.
    try {
      const title = 'طلب صيانة جديد! 🛠️';
      const body = `يوجد طلب جديد في ${city}: ${orderDetails.device_brand} - ${orderDetails.device_model}`;

      const { error } = await supabase.functions.invoke('push-dispatch', {
        body: {
          audience: 'technicians',
          title,
          body,
          data: { type: 'new_order', orderId: orderDetails.id, screen: 'orders' },
        },
      });
      if (error) logger.warn('notifyTechniciansInCity: push-dispatch failed', error);
    } catch (error) {
      logger.error('Error notifying technicians', error);
    }
  },
};
