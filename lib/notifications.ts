import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { logger } from '../utils/logger';

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
      try {
        token = (await Notifications.getExpoPushTokenAsync()).data;
      } catch (e) {
        // Non-fatal. expo-notifications on iOS occasionally fails to parse
        // Expo's push-token response because the RN fetch polyfill wraps
        // the body as a Blob — the app continues fine without a token,
        // we just can't deliver push to this install until next launch.
        // Logged at debug so the dev red-box overlay doesn't block the
        // login screen for users who don't care about push.
        logger.debug('Could not get Expo push token (will retry next launch)', e);
      }
    } else {
      logger.info('Must use physical device for Push Notifications');
    }

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
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
