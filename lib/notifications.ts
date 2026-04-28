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
        logger.error('Error getting push token', e);
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
    const { error } = await supabase.auth.updateUser({
      data: { push_token: token }
    });
    if (error) logger.error('Error saving push token', error);
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
