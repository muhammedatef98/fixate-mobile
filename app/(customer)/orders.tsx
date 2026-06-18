import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, StatusBar, Animated, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import { requests, auth } from '../../lib/supabase-api';
import BottomNav from '../../components/BottomNav';
import ErrorState from '../../components/ErrorState';
import { SkeletonOrderCard } from '../../components/SkeletonLoader';
import { logger } from '../../utils/logger';
import { getColors, getShadows, BORDER_RADIUS } from '../../constants/theme';
import { getFriendlyError } from '../../utils/errorMessages';
import { RTLIonicon } from '../../components/RTLIcon';
import { PressableScale } from '../../components/ui/PressableScale';
import RatingModal from '../../components/RatingModal';
import { getReviewByOrder } from '../../services/reviewService';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { subscribeUnique } from '../../utils/realtimeChannel';
import InvoiceDownloadButton from '../../components/InvoiceDownloadButton';

export default function OrdersScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const isRTL = language === 'ar';
  const themeColors = getColors(isDark);
  const SHADOWS = getShadows(isDark);

  const COLORS = {
    primary: themeColors.primary,
    primarySoft: themeColors.primarySoft,
    background: themeColors.background,
    card: themeColors.card,
    cardAlt: themeColors.cardAlt,
    text: themeColors.text,
    textSecondary: themeColors.textSecondary,
    border: themeColors.border,
    white: themeColors.card,
    warning: themeColors.warning,
    info: themeColors.info,
    success: themeColors.success,
    error: themeColors.error,
  };

  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ratingOrder, setRatingOrder] = useState<{ id: string; technician_id: string | null } | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    loadOrders();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [filter]);

  // Realtime subscription replaces 5s polling. subscribeUnique guards
  // against the "callbacks after subscribe()" race on re-mount.
  useEffect(() => {
    if (!user?.id) return;
    return subscribeUnique(`orders-user-${user.id}`, (ch) =>
      ch.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` },
        () => loadOrders()
      )
    );
  }, [user?.id]);

  // After loading, prompt for rating on the first completed un-reviewed order
  useEffect(() => {
    if (!user?.id || orders.length === 0) return;
    const candidate = orders.find((o) => o.status === 'completed' && o.technician_id);
    if (!candidate) return;
    (async () => {
      const existing = await getReviewByOrder(candidate.id, user.id);
      if (!existing) {
        setRatingOrder({ id: candidate.id, technician_id: candidate.technician_id });
      }
    })();
  }, [orders, user?.id]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const currentUser = await auth.getCurrentUser();
      if (!currentUser) {
        setOrders([]);
        setLoading(false);
        return;
      }
      const data = await requests.getUserOrders();
      let filteredData = data;
      if (filter === 'active') {
        filteredData = data.filter((o: any) =>
          ['pending', 'accepted', 'picking_up', 'diagnosing', 'quoted', 'waiting_parts', 'repairing', 'testing', 'delivering'].includes(o.status)
        );
      } else if (filter === 'completed') {
        filteredData = data.filter((o: any) => ['completed', 'cancelled'].includes(o.status));
      }
      setOrders(filteredData);
    } catch (error: any) {
      logger.error('Error loading orders:', error);
      setErrorMessage(getFriendlyError(error, language));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending': return { label: isRTL ? 'قيد الانتظار' : 'Pending', color: COLORS.warning, icon: 'time-outline' };
      case 'accepted': return { label: isRTL ? 'مقبول' : 'Accepted', color: COLORS.info, icon: 'checkmark-circle-outline' };
      case 'picking_up': return { label: isRTL ? 'جاري الاستلام' : 'Picking up', color: COLORS.info, icon: 'car-outline' };
      case 'diagnosing': return { label: isRTL ? 'تحت الفحص' : 'Diagnosing', color: COLORS.primary, icon: 'search-outline' };
      case 'quoted': return { label: isRTL ? 'بانتظار موافقتك على السعر' : 'Awaiting your approval', color: COLORS.warning, icon: 'pricetag-outline' };
      case 'awaiting_payment': return { label: isRTL ? 'بإنتظار الدفع' : 'Awaiting payment', color: COLORS.warning, icon: 'card-outline' };
      case 'waiting_parts': return { label: isRTL ? 'انتظار قطع غيار' : 'Waiting parts', color: COLORS.warning, icon: 'time-outline' };
      case 'repairing': return { label: isRTL ? 'قيد الإصلاح' : 'Repairing', color: COLORS.primary, icon: 'construct-outline' };
      case 'testing': return { label: isRTL ? 'اختبار الجودة' : 'Testing', color: COLORS.primary, icon: 'flask-outline' };
      case 'delivering': return { label: isRTL ? 'قيد التسليم' : 'Delivering', color: COLORS.info, icon: 'cube-outline' };
      case 'completed': return { label: isRTL ? 'مكتمل' : 'Completed', color: COLORS.success, icon: 'checkbox-outline' };
      case 'cancelled': return { label: isRTL ? 'ملغي' : 'Cancelled', color: COLORS.error, icon: 'close-circle-outline' };
      case 'rejected': return { label: isRTL ? 'مرفوض' : 'Rejected', color: COLORS.error, icon: 'close-circle-outline' };
      default: return { label: status, color: COLORS.textSecondary, icon: 'help-circle-outline' };
    }
  };

  // Statuses the order moves into once the customer ACCEPTS the quotation.
  const POST_QUOTE_ACCEPTED = ['awaiting_payment', 'waiting_parts', 'repairing', 'testing', 'delivering', 'completed'];

  // Reflects the real quotation decision rather than a generic estimate.
  const getQuoteInfo = (order: any): { label: string; amount: string; color: string } => {
    const sar = isRTL ? 'ر.س' : 'SAR';
    const quote = order.final_price;
    if (quote != null && order.status === 'quoted') {
      return {
        label: isRTL ? 'عرض سعر بانتظار قرارك' : 'Quote — awaiting your decision',
        amount: `${quote} ${sar}`,
        color: COLORS.warning,
      };
    }
    if (quote != null && POST_QUOTE_ACCEPTED.includes(order.status)) {
      return {
        label: isRTL ? 'عرض السعر المقبول' : 'Accepted quote',
        amount: `${quote} ${sar}`,
        color: COLORS.success,
      };
    }
    if (quote != null && order.status === 'cancelled') {
      return {
        label: isRTL ? 'عرض السعر المرفوض' : 'Rejected quote',
        amount: `${quote} ${sar}`,
        color: COLORS.error,
      };
    }
    // No quotation issued yet — show a clear "not determined" placeholder.
    // The pre-quote `estimated_price` is just an internal upper-bound used
    // for routing/loyalty, not a price the customer should be anchored on.
    // Surfacing it as a "starting price" was misleading: customers read it
    // as a real charge before the technician even inspects the device.
    return {
      label: isRTL ? 'السعر' : 'Price',
      amount: isRTL ? 'لم يتم التحديد بعد' : 'Not determined yet',
      color: COLORS.textSecondary,
    };
  };

  const styles = createStyles(COLORS, isRTL, SHADOWS);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{isRTL ? 'طلباتي' : 'My Orders'}</Text>
      </View>

      <View style={styles.filterBar}>
        {['all', 'active', 'completed'].map((f) => (
          <TouchableOpacity 
            key={f} 
            style={[styles.filterTab, filter === f && styles.activeFilterTab]}
            onPress={() => setFilter(f as any)}
          >
            <Text style={[styles.filterText, filter === f && styles.activeFilterText]}>
              {f === 'all' ? (isRTL ? 'الكل' : 'All') : f === 'active' ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'مكتمل' : 'Done')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadOrders} colors={[COLORS.primary]} />}
      >
        {loading ? (
          <View style={{ paddingTop: 16 }}>
            <SkeletonOrderCard />
            <SkeletonOrderCard />
            <SkeletonOrderCard />
          </View>
        ) : errorMessage ? (
          <ErrorState message={errorMessage} onRetry={loadOrders} />
        ) : orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="construct-outline" size={80} color={COLORS.primary} />
            <Text style={styles.emptyText}>
              {isRTL ? 'لا توجد طلبات بعد' : 'No orders yet'}
            </Text>
            <Text style={[styles.emptyText, { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 }]}>
              {isRTL ? 'اطلب فني الآن — يصلك خلال 30 دقيقة' : 'Request a technician — arrives within 30 minutes'}
            </Text>
            <TouchableOpacity
              style={styles.loginPromptBtn}
              onPress={() => router.push(user ? '/request' : '/login-otp')}
              accessibilityRole="button"
              accessibilityLabel={isRTL ? 'اطلب صيانة الآن' : 'Request repair now'}
            >
              <Text style={styles.loginPromptText}>
                {user ? (isRTL ? 'اطلب صيانة الآن' : 'Request repair now') : (isRTL ? 'سجل الدخول' : 'Login')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            {orders.map((order) => {
              const status = getStatusInfo(order.status);
              const dateStr = new Date(order.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
              return (
                <PressableScale
                  key={order.id}
                  to={0.985}
                  style={[styles.orderCard, { borderLeftColor: status.color, borderLeftWidth: 4 }]}
                  onPress={() => router.push(`/order-details?id=${order.id}`)}
                >
                  {/* Top: status pill on the lead side, date at the trailing edge */}
                  <View style={styles.cardTopRow}>
                    <View style={[styles.statusPill, { backgroundColor: status.color + '15' }]}>
                      <Ionicons name={status.icon as any} size={11} color={status.color} />
                      <Text style={[styles.statusPillText, { color: status.color }]}>{status.label}</Text>
                    </View>
                    <Text style={styles.cardDate}>{dateStr}</Text>
                  </View>

                  {/* Device row: icon + name + chevron */}
                  <View style={styles.cardDeviceRow}>
                    <View style={styles.deviceIcon}>
                      <MaterialCommunityIcons name="cellphone" size={22} color={COLORS.primary} />
                    </View>
                    <Text style={styles.deviceName} numberOfLines={1}>
                      {order.device_brand} {order.device_model}
                    </Text>
                  </View>

                  {/* Issue line */}
                  <Text style={styles.issueText} numberOfLines={2}>
                    {order.issue_description || (isRTL ? 'فحص عام' : 'General check')}
                  </Text>

                  {/* Price + CTA row — reflects the real quotation decision */}
                  <View style={styles.cardBottomRow}>
                    {(() => {
                      const q = getQuoteInfo(order);
                      return (
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.priceLabel, { color: q.color }]} numberOfLines={1}>
                            {q.label}
                          </Text>
                          <Text style={[styles.priceValue, { color: q.color }]}>
                            {q.amount}
                          </Text>
                        </View>
                      );
                    })()}
                    <View style={styles.detailsBtn}>
                      <Text style={styles.detailsBtnText}>{isRTL ? 'عرض التفاصيل' : 'View details'}</Text>
                      <RTLIonicon name="chevron-forward" size={14} color={COLORS.primary} />
                    </View>
                  </View>

                  {order.status === 'completed' && (
                    <View style={{ marginTop: 10, alignItems: isRTL ? 'flex-start' : 'flex-end' }}>
                      <InvoiceDownloadButton orderId={order.id} isRTL={isRTL} COLORS={COLORS} variant="inline" />
                    </View>
                  )}
                </PressableScale>
              );
            })}
          </Animated.View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNav />
      <RatingModal
        visible={!!ratingOrder}
        orderId={ratingOrder?.id ?? ''}
        technicianId={ratingOrder?.technician_id ?? null}
        onClose={() => setRatingOrder(null)}
        onSubmitted={() => setRatingOrder(null)}
      />
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any, isRTL: boolean, SHADOWS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, backgroundColor: COLORS.background },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text, textAlign: isRTL ? 'right' : 'left' },
  filterBar: { flexDirection: isRTL ? 'row-reverse' : 'row', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.background, gap: 8 },
  filterTab: { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: 999, backgroundColor: COLORS.cardAlt },
  activeFilterTab: { backgroundColor: COLORS.primary },
  filterText: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary },
  activeFilterText: { color: '#fff' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary, marginTop: 16, marginBottom: 20 },
  loginPromptBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 24, minHeight: 48, justifyContent: 'center', borderRadius: BORDER_RADIUS.sm, ...SHADOWS.small },
  loginPromptText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  orderCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    padding: 16,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  cardTopRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statusPill: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  cardDate: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500' },
  cardDeviceRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  deviceIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: isRTL ? 'right' : 'left',
  },
  issueText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
    marginBottom: 12,
    textAlign: isRTL ? 'right' : 'left',
  },
  cardBottomRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  priceLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
    textAlign: isRTL ? 'right' : 'left',
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
    textAlign: isRTL ? 'right' : 'left',
  },
  detailsBtn: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  detailsBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
});
