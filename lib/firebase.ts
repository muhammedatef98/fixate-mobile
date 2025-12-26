import messaging from '@react-native-firebase/messaging';
import { supabase } from './supabase';

// Request permission for notifications
export async function requestNotificationPermission() {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (enabled) {
    logger.debug('Authorization status:', authStatus);
    return true;
  }
  return false;
}

// Get FCM token
export async function getFCMToken() {
  try {
    const token = await messaging().getToken();
    logger.debug('FCM Token:', token);
    return token;
  } catch (error) {
    logger.error('Error getting FCM token:', error);
    return null;
  }
}

// Save FCM token to user metadata
export async function saveFCMToken(userId: string, token: string) {
  try {
    const { error } = await supabase.auth.updateUser({
      data: { fcm_token: token }
    });

    if (error) throw error;
    logger.debug('FCM token saved successfully');
  } catch (error) {
    logger.error('Error saving FCM token:', error);
  }
}

// Listen for foreground notifications
export function onMessageReceived(callback: (message: any) => void) {
  return messaging().onMessage(async remoteMessage => {
    logger.debug('Foreground notification:', remoteMessage);
    callback(remoteMessage);
  });
}

// Handle background notifications
messaging().setBackgroundMessageHandler(async remoteMessage => {
  logger.debug('Background notification:', remoteMessage);
});
