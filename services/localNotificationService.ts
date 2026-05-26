import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import { subscribeUnique } from '../utils/realtimeChannel';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      logger.warn('Push notification permissions not granted');
      return false;
    }

    logger.info('Notification permissions granted');
    return true;
  } catch (error) {
    logger.error('Error requesting notification permissions', error);
    return false;
  }
}

export async function sendLocalNotification(title: string, body: string, data?: any) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null,
    });
  } catch (error) {
    logger.error('Error sending local notification', error);
  }
}

export function subscribeToNewRequests(userId: string, onNewRequest: (request: any) => void) {
  // Returns a synchronous cleanup function; pass through from useEffect
  // cleanup. subscribeUnique avoids the realtime race on re-mount.
  return subscribeUnique('new-orders', (ch) =>
    ch.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'orders' },
      async (payload: any) => {
        logger.debug('New order detected', payload.new);
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.user_metadata?.role === 'technician') {
          const order = payload.new;
          await sendLocalNotification(
            '🔔 طلب جديد متاح!',
            `${order.brand || 'جهاز'} ${order.model || ''} - ${order.issue || 'يحتاج صيانة'}`,
            { orderId: order.id, type: 'new_order' }
          );
          onNewRequest(order);
        }
      }
    )
  );
}

/** @deprecated subscribeToNewRequests now returns its own cleanup. */
export function unsubscribeFromNewRequests(cleanup: any) {
  if (typeof cleanup === 'function') cleanup();
}

export function addNotificationResponseListener(callback: (response: any) => void) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}
