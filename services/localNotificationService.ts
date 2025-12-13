import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Request notification permissions
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
      console.log('Failed to get push notification permissions');
      return false;
    }

    console.log('Notification permissions granted');
    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

// Send local notification
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
      trigger: null, // Show immediately
    });
  } catch (error) {
    console.error('Error sending local notification:', error);
  }
}

// Listen for new service requests in real-time
export function subscribeToNewRequests(userId: string, onNewRequest: (request: any) => void) {
  // Subscribe to INSERT events on orders table
  const subscription = supabase
    .channel('new-orders')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
      },
      async (payload) => {
        console.log('New order detected:', payload.new);
        
        // Get current user to check if they're a technician
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user?.user_metadata?.role === 'technician') {
          const order = payload.new;
          
          // Send local notification
          await sendLocalNotification(
            '🔔 طلب جديد متاح!',
            `${order.brand || 'جهاز'} ${order.model || ''} - ${order.issue || 'يحتاج صيانة'}`,
            { orderId: order.id, type: 'new_order' }
          );
          
          // Call the callback
          onNewRequest(order);
        }
      }
    )
    .subscribe();

  return subscription;
}

// Unsubscribe from real-time updates
export function unsubscribeFromNewRequests(subscription: any) {
  if (subscription) {
    supabase.removeChannel(subscription);
  }
}

// Handle notification tap
export function addNotificationResponseListener(callback: (response: any) => void) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}
