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
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import { logger } from '../utils/logger';
import { subscribeUnique } from '../utils/realtimeChannel';
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
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const isRTL = language === 'ar';
  const COLORS = getColors(isDark);
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
    // subscribeUnique avoids the realtime "callbacks after subscribe()"
    // race: a same-named channel from a previous mount can still be
    // pending its async LEAVE, and re-mounting (Fast Refresh, layout
    // re-render, etc.) would otherwise pull that already-subscribed
    // leftover back through .channel() and throw on the next .on().
    return subscribeUnique(`floating-orders-${user.id}`, (ch) =>
      ch.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` },
        () => checkActiveOrder()
      )
    );
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

  const sColor = statusColor(activeOrder.status);

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { transform: [{ translateY: slideAnim }] },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: COLORS.card,
            borderColor: COLORS.border,
            shadowColor: isDark ? '#000' : '#0F172A',
          },
        ]}
      >
        {/* Left brand stripe in the status colour for instant recognition */}
        <View style={[styles.stripe, { backgroundColor: sColor }]} />
        <View style={[styles.content, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity
            onPress={() => router.push('/(customer)/orders')}
            style={[styles.tapArea, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'فتح الطلبات' : 'Open orders'}
          >
            <View style={[styles.iconContainer, { backgroundColor: sColor + '22' }]}>
              <MaterialIcons name="delivery-dining" size={22} color={sColor} />
            </View>
            <View style={[styles.textContainer, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
              <View style={[styles.titleRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Text style={[styles.title, { color: COLORS.text }]} numberOfLines={1}>
                  {isRTL ? 'طلب جاري' : 'Active order'}
                </Text>
                <View style={[styles.idChip, { backgroundColor: sColor + '18' }]}>
                  <Text style={[styles.idChipText, { color: sColor }]}>
                    #{activeOrder.id.slice(0, 4)}
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  styles.subtitle,
                  {
                    color: COLORS.textSecondary,
                    textAlign: isRTL ? 'right' : 'left',
                    writingDirection: isRTL ? 'rtl' : 'ltr',
                  },
                ]}
                numberOfLines={1}
              >
                {statusText(activeOrder.status)}
              </Text>
            </View>
            <RTLMaterialIcon name="chevron-right" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={dismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[styles.closeBtn, { backgroundColor: COLORS.cardAlt }]}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'إخفاء' : 'Hide'}
          >
            <Ionicons name="close" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 108 : 98,
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 1000,
  },
  card: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    elevation: 10,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  stripe: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
  },
  content: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    paddingLeft: SPACING.md + 4, // leave room for the stripe
  },
  tapArea: {
    flex: 1,
    alignItems: 'center',
    gap: SPACING.s,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: { flex: 1 },
  titleRow: {
    alignItems: 'center',
    gap: 6,
    marginBottom: 1,
  },
  title: { fontSize: 14, fontWeight: '800' },
  idChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  idChipText: { fontSize: 10, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 1 },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginStart: 6,
  },
});
