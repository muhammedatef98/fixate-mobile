import messaging from '@react-native-firebase/messaging';
import { supabase } from './supabase';
import { logger } from '../utils/logger';

export async function requestNotificationPermission() {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (enabled) {
    logger.info('FCM authorization status', authStatus);
    return true;
  }
  return false;
}

export async function getFCMToken() {
  try {
    const token = await messaging().getToken();
    logger.debug('FCM Token obtained');
    return token;
  } catch (error) {
    logger.error('Error getting FCM token', error);
    return null;
  }
}

export async function saveFCMToken(userId: string, token: string) {
  try {
    const { error } = await supabase.auth.updateUser({
      data: { fcm_token: token }
    });

    if (error) throw error;
    logger.info('FCM token saved successfully');
  } catch (error) {
    logger.error('Error saving FCM token', error);
  }
}

export function onMessageReceived(callback: (message: any) => void) {
  return messaging().onMessage(async remoteMessage => {
    logger.debug('Foreground notification received');
    callback(remoteMessage);
  });
}

messaging().setBackgroundMessageHandler(async remoteMessage => {
  logger.debug('Background notification received');
});
