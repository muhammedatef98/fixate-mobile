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
 * A storable push token MUST be an Expo push token ("ExponentPushToken[...]" /
 * "ExpoPushToken[...]"). Push delivery goes through the Expo Push API and
 * `push-dispatch` rejects (and clears) anything that doesn't match this exact
 * shape — so the client must never persist a raw FCM/APNs registration token,
 * which would poison public.users.push_token and silently break Android
 * delivery. This guard mirrors `push-dispatch`'s server-side regex.
 */
const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[[^\]\s]+\]$/;
function isValidPushToken(token: unknown): token is string {
  return typeof token === 'string' && EXPO_TOKEN_RE.test(token.trim());
}

/**
 * A log-safe sample of a push token. Never log the full value — the bracketed
 * body is effectively a delivery secret. We keep the `ExponentPushToken[`
 * prefix (useful for shape verification) plus a few chars and the length.
 */
function tokenSample(t: string | null | undefined): string {
  if (!t) return '<null>';
  return t.length <= 24 ? t : `${t.slice(0, 24)}…(len=${t.length})`;
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
      name: 'Fixate Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      lightColor: '#10b981',
      bypassDnd: false,
      showBadge: true,
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
    // Production diagnostic: the #1 silent Android cause is a denied/undetermined
    // POST_NOTIFICATIONS permission (Android 13+). Log both states every time.
    console.log(
      `[PushToken] permission (platform=${Platform.OS}): existing=${existingStatus} final=${finalStatus}`
    );
    if (finalStatus !== 'granted') {
      logger.warn('[PushToken] permission not granted — skipping registration');
      return null;
    }

    // Android needs a notification channel before tokens deliver visibly.
    await ensureAndroidNotificationChannel();

    try {
      const projectId = resolveProjectId();
      // Log the projectId every time: an Expo token is bound to ONE EAS project,
      // and Expo relays to FCM using the credentials on THAT project. A wrong /
      // missing projectId here is a common Android delivery cause.
      console.log('[PushToken] using EAS projectId:', projectId ?? '<missing>');
      if (!projectId) {
        logger.warn(
          '[PushToken] EAS projectId missing — getExpoPushTokenAsync may fail on Android'
        );
      }
      const { data: token } = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
      console.log(
        '[PushToken] getExpoPushTokenAsync OK — sample:',
        tokenSample(token),
        'expoShape:',
        EXPO_TOKEN_RE.test(token ?? '')
      );
      return token;
    } catch (e) {
      logger.error('[PushToken] getExpoPushTokenAsync FAILED', e);
      return null;
    }
  },

  /**
   * Persist the Expo push token on the user's public.users row so the
   * service-role `push-dispatch` function can resolve it for fan-out.
   */
  saveTokenToProfile: async (userId: string, token: string) => {
    // Never store a non-Expo token. `isValidPushToken` is now Expo-only, so this
    // single guard is sufficient — `registerForPushNotificationsAsync` already
    // returns only Expo tokens (or null), and push-dispatch rejects anything
    // else. (The old raw-FCM fallback acceptance has been removed.)
    if (!isValidPushToken(token)) {
      logger.warn('[PushToken] refusing to store non-Expo token', {
        sample: tokenSample(token),
      });
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
        console.log('[PushToken] token unchanged for', userId, '— skipping write');
        return; // unchanged — nothing to do.
      }

      const { error } = await supabase
        .from('users')
        .update({ push_token: token, push_updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) {
        logger.warn('[PushToken] save to public.users FAILED', error);
      } else {
        // Confirms the row actually updated, with a log-safe token sample.
        console.log(
          '[PushToken] saved to public.users for',
          userId,
          '— sample:',
          tokenSample(token)
        );
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

/**
 * Startup self-heal for legacy / non-Expo tokens on Android.
 *
 * Earlier builds (raw FCM-v1 flow, and a brief window where the client accepted
 * non-Expo tokens) could have left a raw FCM/APNs token in
 * public.users.push_token. push-dispatch rejects anything that doesn't match
 * EXPO_TOKEN_RE and DELETES it, so the user gets no pushes until they
 * re-register. This checks the stored token and — if it isn't an Expo token —
 * re-registers and overwrites it with a fresh Expo token. The current code path
 * only ever stores Expo tokens, so for healthy installs this is a cheap no-op;
 * it exists to repair pre-existing bad rows. Android only, no-op on iOS.
 */
export async function healPushTokenIfNeeded(userId: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const { data } = await supabase
      .from('users')
      .select('push_token')
      .eq('id', userId)
      .maybeSingle();

    const storedToken = data?.push_token;

    // Nothing stored yet — normal registration path will handle it.
    if (!storedToken) return;

    if (!EXPO_TOKEN_RE.test(storedToken)) {
      logger.warn('[PushHeal] stored token is non-Expo, re-registering', {
        sample: tokenSample(String(storedToken)),
      });
      const freshToken = await notificationManager.registerForPushNotificationsAsync();
      if (freshToken) {
        // Clear first so saveTokenToProfile's unchanged-value short-circuit
        // can't keep the bad value in place.
        await supabase.from('users').update({ push_token: null }).eq('id', userId);
        await notificationManager.saveTokenToProfile(userId, freshToken);
      }
    }
  } catch (e) {
    logger.warn('[PushHeal] failed', e);
  }
}
