import React, { useCallback, useEffect, useState } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { getColors } from '../constants/theme';
import { getUnreadCount, subscribeToNotifications } from '../utils/notifications';

interface NotificationBellProps {
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export default function NotificationBell({
  color,
  size = 24,
  style,
}: NotificationBellProps) {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const { isDark } = useApp();
  const COLORS = getColors(isDark);
  const [count, setCount] = useState(0);

  // Route to the role-appropriate notifications screen so a customer
  // never lands on the technician deep-link routing (and vice versa).
  const role =
    (userProfile as any)?.role ??
    (user?.user_metadata as any)?.role ??
    null;
  const notifPath =
    role === 'technician' ? '/(technician)/notifications' : '/notifications';

  const refresh = useCallback(() => {
    if (!user?.id) {
      setCount(0);
      return;
    }
    getUnreadCount(user.id)
      .then(setCount)
      .catch(() => undefined);
  }, [user?.id]);

  // Realtime keeps the badge live while the screen is mounted.
  useEffect(() => {
    refresh();
    if (!user?.id) return;
    const sub = subscribeToNotifications(user.id, refresh);
    return () => sub.unsubscribe();
  }, [user?.id, refresh]);

  // Re-check when the host screen regains focus (e.g. returning from the
  // notifications screen after marking all read).
  useFocusEffect(refresh);

  return (
    <TouchableOpacity
      onPress={() => router.push(notifPath as any)}
      accessibilityRole="button"
      accessibilityLabel="Notifications"
      style={style}
    >
      <Ionicons
        name="notifications-outline"
        size={size}
        color={color ?? COLORS.text}
      />
      {count > 0 && (
        <View style={[styles.badge, { borderColor: COLORS.card }]}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
});
