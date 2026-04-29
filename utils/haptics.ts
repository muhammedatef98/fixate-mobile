import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const safe = (fn: () => Promise<unknown>) => {
  if (Platform.OS === 'web') return;
  fn().catch(() => undefined);
};

export const tapLight = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
export const tapMedium = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
export const tapHeavy = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
export const success = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
export const warning = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
export const error = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
export const selection = () => safe(() => Haptics.selectionAsync());
