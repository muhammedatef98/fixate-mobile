import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import { logger } from '../utils/logger';
import { RTLMaterialIcon } from './RTLIcon';

const ACTIVE_STATUSES = [
  'pending',
  'accepted',
  'picking_up',
  'diagnosing',
  'waiting_parts',
  'repairing',
  'testing',
  'delivering',
];

const dismissKey = (userId: string) => `floating-order-dismissed:${userId}`;

export default function FloatingOrderStatus() {
  const router = useRouter();
  const pathname = usePathname();
  const { language } = useApp();
  const { user } = useAuth();
  const isRTL = language === 'ar';
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const slideAnim = useRef(new Animated.Value(100)).current;

  // Pull the per-user "dismissed order id" from AsyncStorage so the bar
  // stays hidden after the user × it. Re-shows automatically once the
  // dismissed order is no longer active (replaced by a different one).
  useEffect(() => {
    if (!user?.id) {
      setDismissedId(null);
      return;
    }
    AsyncStorage.getItem(dismissKey(user.id))
      .then((v) => setDismissedId(v))
      .catch(() => undefined);
  }, [user?.id]);

  const checkActiveOrder = async () => {
    if (!user?.id) {
      setActiveOrder(null);
      return;
    }
    try {
      // Per-user filter: only THIS user's orders. Without this filter, an
      // admin (who has broad SELECT via RLS) would see other users' active
      // orders surface as their own — that was the "ID #a57d shows up but
      // tapping says no orders" bug.
      const { data, error } = await supabase
        .from('orders')
        .select('id, status, user_id, created_at, device_brand, device_model')
        .eq('user_id', user.id)
        .in('status', ACTIVE_STATUSES)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) {
        logger.warn('FloatingOrderStatus query failed', error);
        setActiveOrder(null);
        return;
      }
      setActiveOrder((data && data[0]) || null);
    } catch (e) {
      logger.warn('FloatingOrderStatus error', e);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    checkActiveOrder();
    // Subscribe to inserts/updates on this user's orders only
    const channel = supabase
      .channel(`floating-orders-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` },
        () => checkActiveOrder()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Hide on the orders / chat / order-details screens (redundant info there)
  useEffect(() => {
    if (!activeOrder) {
      hide();
      return;
    }
    if (dismissedId === activeOrder.id) {
      hide();
      return;
    }
    if (pathname.includes('/orders') || pathname.includes('/chat') || pathname.includes('/order-details') || pathname.includes('/admin')) {
      hide();
      return;
    }
    show();
  }, [pathname, activeOrder, dismissedId]);

  const show = () => {
    setVisible(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 240,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease),
    }).start();
  };

  const hide = () => {
    Animated.timing(slideAnim, {
      toValue: 100,
      duration: 200,
      useNativeDriver: true,
      easing: Easing.in(Easing.ease),
    }).start(() => setVisible(false));
  };

  const dismiss = async () => {
    if (!user?.id || !activeOrder?.id) return;
    setDismissedId(activeOrder.id);
    try {
      await AsyncStorage.setItem(dismissKey(user.id), activeOrder.id);
    } catch {}
  };

  if (!activeOrder || !visible) return null;

  const statusText = (status: string) => {
    switch (status) {
      case 'pending': return isRTL ? 'جاري البحث عن فني...' : 'Finding technician...';
      case 'accepted': return isRTL ? 'تم القبول' : 'Accepted';
      case 'picking_up': return isRTL ? 'الفني في الطريق إليك' : 'Technician is on the way';
      case 'diagnosing': return isRTL ? 'جاري فحص الجهاز' : 'Diagnosing';
      case 'waiting_parts': return isRTL ? 'انتظار قطع غيار' : 'Waiting for parts';
      case 'repairing': return isRTL ? 'جاري الإصلاح' : 'Repair in progress';
      case 'testing': return isRTL ? 'اختبار الجودة' : 'Quality testing';
      case 'delivering': return isRTL ? 'جاري التسليم' : 'Delivering';
      default: return isRTL ? 'طلب نشط' : 'Active order';
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'pending': return COLORS.warning;
      case 'accepted':
      case 'picking_up': return COLORS.primary;
      case 'waiting_parts': return COLORS.warning;
      default: return COLORS.info;
    }
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }, SHADOWS.medium]}>
      <View style={styles.content}>
        <TouchableOpacity
          onPress={() => router.push('/(customer)/orders')}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
          accessibilityRole="button"
        >
          <View style={[styles.iconContainer, { backgroundColor: statusColor(activeOrder.status) + '20' }]}>
            <MaterialIcons name="delivery-dining" size={24} color={statusColor(activeOrder.status)} />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.title}>
              {isRTL ? 'طلب جاري' : 'Active order'} #{activeOrder.id.slice(0, 4)}
            </Text>
            <Text style={styles.subtitle}>{statusText(activeOrder.status)}</Text>
          </View>
          <RTLMaterialIcon name="chevron-right" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={dismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'إخفاء' : 'Hide'}
        >
          <Ionicons name="close" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 108 : 98,
    left: SPACING.lg,
    right: SPACING.lg,
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.lg,
    zIndex: 1000,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  textContainer: { flex: 1 },
  title: { fontSize: 14, fontWeight: 'bold', color: COLORS.text },
  subtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 6,
  },
});
