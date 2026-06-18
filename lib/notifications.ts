import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { supabase } from './supabase';
import { logger } from '../utils/logger';

// We send pushes via the FCM v1 HTTP API directly (see the `push-dispatch`
// Edge Function), so the token stored in public.users.push_token MUST be a raw
// FCM registration token — NOT an Expo push token. Expo's `ExponentPushToken`
// format is rejected by FCM v1's messages:send. `@react-native-firebase/
// messaging`'s getToken() returns a real FCM token on both Android and iOS
// (iOS routes through Firebase's APNs integration configured via
// GoogleService-Info.plist), which is the one format FCM v1 accepts everywhere.

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const notificationManager = {
  /**
   * Acquire a raw FCM registration token for this device. Requests
   * notification permission if needed and returns null (silently) when the
   * user denies it or we're on a simulator. Safe to call on every launch.
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
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10b981',
      });
    }

    try {
      // iOS must register with APNs before an FCM token can be minted.
      if (Platform.OS === 'ios' && !messaging().isDeviceRegisteredForRemoteMessages) {
        await messaging().registerDeviceForRemoteMessages();
      }
      const token = await messaging().getToken();
      console.log('[PushToken] registered:', token);
      return token;
    } catch (e) {
      logger.error('[PushToken] error getting FCM token', e);
      return null;
    }
  },

  // BACKFILL NOTE (one-time): existing rows in public.users.push_token hold
  // legacy Expo tokens ("ExponentPushToken[...]") or NULL. FCM v1 cannot deliver
  // to Expo tokens, so those rows will report as failed until each user re-opens
  // the app — registerForPushNotificationsAsync() then overwrites push_token with
  // a fresh FCM token. There is no server-side backfill possible (FCM tokens can
  // only be minted on-device); the only "migration" is users launching the app
  // once. Optionally run, to stop stale Expo tokens from inflating "registered"
  // counts: UPDATE public.users SET push_token = NULL
  //         WHERE push_token LIKE 'ExponentPushToken%';
  saveTokenToProfile: async (userId: string, token: string) => {
    // Persist the FCM token on the user's public.users row so the
    // service-role `push-dispatch` function can resolve it for fan-out.
    try {
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
    // Fan out through the service-role `push-dispatch` Edge Function (FCM v1).
    // It resolves technician tokens server-side, so the client never reads
    // other users' push tokens. City scoping is not yet a server-side filter;
    // all technicians are notified (the previous `profiles`-table query was a
    // no-op because that table doesn't exist).
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
  }
};
