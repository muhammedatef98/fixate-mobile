import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure how notifications are handled when the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const notificationManager = {
  // Register for push notifications and get token
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
        console.log('Failed to get push token for push notification!');
        return;
      }
      try {
        token = (await Notifications.getExpoPushTokenAsync()).data;
      } catch (e) {
        console.log('Error getting push token:', e);
      }
    } else {
      console.log('Must use physical device for Push Notifications');
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

  // Save token to user profile in Supabase
  saveTokenToProfile: async (userId: string, token: string) => {
    const { error } = await supabase.auth.updateUser({
      data: { push_token: token }
    });
    if (error) console.error('Error saving push token:', error);
  },

  // Send notification to a specific token (usually done from backend, but here for demo/direct use)
  sendPushNotification: async (expoPushToken: string, title: string, body: string, data: any = {}) => {
    const message = {
      to: expoPushToken,
      sound: 'default',
      title: title,
      body: body,
      data: data,
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

  // Notify all technicians in a specific city
  notifyTechniciansInCity: async (city: string, orderDetails: any) => {
    try {
      // 1. Get all technicians in that city who have a push token
      // Note: In a real app, you'd query a 'profiles' table. 
      // Since we store push_token in auth metadata, we'd ideally have a synced profiles table.
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('push_token')
        .eq('city', city)
        .eq('user_type', 'technician')
        .not('push_token', 'is', null);

      if (error) throw error;

      // 2. Send notification to each token
      const title = 'طلب صيانة جديد! 🛠️';
      const body = `يوجد طلب جديد في ${city}: ${orderDetails.device_brand} - ${orderDetails.device_model}`;
      
      const notifications = profiles.map(p => 
        notificationManager.sendPushNotification(p.push_token, title, body, { orderId: orderDetails.id })
      );

      await Promise.all(notifications);
    } catch (error) {
      console.error('Error notifying technicians:', error);
    }
  }
};
