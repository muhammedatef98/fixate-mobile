import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { logger } from '../utils/logger';

// The EAS project the Expo push service issues tokens against. In a bare /
// dev-client build (which is what we ship) getExpoPushTokenAsync() cannot infer
// this on its own, so it MUST be passed explicitly or the call throws.
const EXPO_PROJECT_ID: string | undefined =
  (Constants.expoConfig?.extra as any)?.eas?.projectId ??
  (Constants as any).easConfig?.projectId;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Creates (or no-ops if already exists) the Android default notification channel.
 * Must be called at app startup (before first login) so that any push arriving
 * on Android 8+ has a valid channel and isn't silently dropped.
 * Safe to call multiple times — setNotificationChannelAsync is idempotent.
 * iOS: no-op.
 */
export async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF231F7C',
  });
}

/**
 * Validates the stored push_token for the given user on Android.
 * If the stored token is a raw FCM token (not an Expo Push Token), it means
 * the Firebase/Expo race condition corrupted it and push-dispatch will delete
 * it on the next send. We detect and heal this proactively.
 * iOS: always no-op — iOS is handled by APNs through expo-notifications.
 */
export async function healPushTokenIfNeeded(userId: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const { data } = await supabase
      .from('users')
      .select('push_token')
      .eq('id', userId)
      .maybeSingle();

    const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[[^\]\s]+\]$/;
    const storedToken: string | null = (data as any)?.push_token ?? null;

    if (!storedToken) {
      // No token stored yet — let the normal registration flow handle it.
      return;
    }

    if (EXPO_TOKEN_RE.test(storedToken)) {
      // Token looks healthy — nothing to do.
      return;
    }

    // Token is invalid (raw FCM, empty, or otherwise malformed).
    logger.warn('[PushHeal] stored token is invalid, re-registering:', storedToken.slice(0, 20));

    const freshToken = await notificationManager.registerForPushNotificationsAsync();
    if (freshToken) {
      // Clear the bad token first, then save the fresh one to avoid
      // a unique-constraint race if another device is registering simultaneously.
      await supabase.from('users').update({ push_token: null }).eq('id', userId);
      await notificationManager.saveTokenToProfile(userId, freshToken);
      logger.info('[PushHeal] token healed successfully');
    }
  } catch (e) {
    logger.warn('[PushHeal] failed silently', e);
  }
}

export const notificationManager = {
  registerForPushNotificationsAsync: async () => {
    let token;
    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        logger.warn('Failed to get push token for push notification');
        return;
      }
      // Reaching Expo's token service is a network call, so it fails routinely
      // on a cold start over a flaky mobile connection ("Network request
      // failed"). That is NOT fatal — push simply stays unregistered until the
      // next launch or the self-heal pass — so retry once, then warn. Logging
      // it as an error red-boxed the app in dev for a condition it recovers
      // from on its own.
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          token = (await Notifications.getExpoPushTokenAsync(
            EXPO_PROJECT_ID ? { projectId: EXPO_PROJECT_ID } : undefined,
          )).data;
          break;
        } catch (e) {
          if (attempt === 1) {
            await new Promise((r) => setTimeout(r, 1500));
            continue;
          }
          logger.warn('Push token unavailable (will retry on next launch)', e);
        }
      }
    } else {
      logger.info('Must use physical device for Push Notifications');
    }

    // Channel creation is now handled by ensureAndroidNotificationChannel()
    // which is called at startup in _layout.tsx. Keeping this call here too
    // is intentional and safe — it is idempotent.
    if (Platform.OS === 'android') {
      await ensureAndroidNotificationChannel();
    }

    return token;
  },

  saveTokenToProfile: async (userId: string, token: string) => {
    // 1. Keep the user-metadata copy for backward compatibility with any
    //    existing code paths that read it.
    const { error: metaError } = await supabase.auth.updateUser({
      data: { push_token: token }
    });
    if (metaError) logger.warn('push token: auth metadata update failed', metaError);

    // 2. Mirror to public.users so admins / RPCs can resolve tokens for
    //    broadcasts (auth.users.user_metadata is per-row and only the
    //    owner can read it, which makes it useless for fan-out).
    try {
      const { error } = await supabase
        .from('users')
        .update({ push_token: token, push_updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) logger.warn('push token mirror to public.users failed', error);
    } catch (e) {
      logger.warn('push token mirror threw', e);
    }
  },

  sendPushNotification: async (expoPushToken: string, title: string, body: string, data: any = {}) => {
    const message = {
      to: expoPushToken,
      sound: 'default',
      title,
      body,
      data,
    };

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
  },

  notifyTechniciansInCity: async (city: string, orderDetails: any) => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('push_token')
        .eq('city', city)
        .eq('role', 'technician')
        .not('push_token', 'is', null);

      if (error) {
        if (error.code === 'PGRST205') {
          logger.warn('Profiles table not found. Notifications skipped.');
          return;
        }
        throw error;
      }

      if (!profiles || profiles.length === 0) return;

      const title = 'طلب صيانة جديد! 🛠️';
      const body = `يوجد طلب جديد في ${city}: ${orderDetails.device_brand} - ${orderDetails.device_model}`;

      const notifications = profiles.map(p =>
        notificationManager.sendPushNotification(p.push_token, title, body, { orderId: orderDetails.id })
      );

      await Promise.all(notifications);
    } catch (error) {
      logger.error('Error notifying technicians', error);
    }
  }
};
