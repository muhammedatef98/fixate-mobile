import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Animated, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import { requests, auth } from '../../lib/supabase-api';
import BottomNav from '../../components/BottomNav';
import ErrorState from '../../components/ErrorState';
import { SkeletonOrderCard } from '../../components/SkeletonLoader';
import { logger } from '../../utils/logger';
import { fmtMyRequestDate } from '../../utils/dateFormat';
import { getColors, getShadows, BORDER_RADIUS } from '../../constants/theme';
import { getFriendlyError } from '../../utils/errorMessages';
import { subscribeToOrderOffers } from '../../services/offerMarketplaceService';
import { countNewPendingOffers } from '../../utils/offerStatus';
import { getOffersLastSeenMap } from '../../utils/offersSeen';
import { RTLIonicon } from '../../components/RTLIcon';
import { PressableScale } from '../../components/ui/PressableScale';
import RatingModal from '../../components/RatingModal';
import { getReviewByOrder } from '../../services/reviewService';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { subscribeUnique } from '../../utils/realtimeChannel';
import InvoiceDownloadButton from '../../components/InvoiceDownloadButton';
import { AdminFilterChips, type AdminFilterChip } from '../../components/admin/AdminUI';

// Status filter for the requests list — same pill-chip style as the admin
// orders-management screen (reuses AdminFilterChips). Each key maps to a set
// of order statuses so the six chips cover every status the app uses.
type OrderFilterKey = 'all' | 'accepted' | 'in_progress' | 'completed' | 'rejected' | 'cancelled';

const ORDER_FILTERS: AdminFilterChip<OrderFilterKey>[] = [
  { key: 'all', ar: 'الكل', en: 'All' },
  { key: 'accepted', ar: 'مقبولة', en: 'Accepted' },
  { key: 'in_progress', ar: 'قيد التنفيذ', en: 'In progress' },
  { key: 'completed', ar: 'مكتملة', en: 'Completed' },
  { key: 'rejected', ar: 'مرفوضة', en: 'Rejected' },
  { key: 'cancelled', ar: 'ملغاة', en: 'Cancelled' },
];

const IN_PROGRESS_STATUSES = [
  'pending', 'picking_up', 'diagnosing', 'quoted', 'awaiting_payment',
  'waiting_parts', 'repairing', 'testing', 'delivering',
];

const matchesOrderFilter = (status: string, key: OrderFilterKey): boolean => {
  switch (key) {
    case 'all': return true;
    case 'accepted': return status === 'accepted';
    case 'in_progress': return IN_PROGRESS_STATUSES.includes(status);
    case 'completed': return status === 'completed';
    case 'rejected': return status === 'rejected';
    case 'cancelled': return status === 'cancelled';
    default: return true;
  }
};

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
  const [filter, setFilter] = useState<OrderFilterKey>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ratingOrder, setRatingOrder] = useState<{ id: string; technician_id: string | null } | null>(null);
  // Offer-arrival signal per open order: total live offers + how many arrived
  // since the customer last opened the offers screen (meaningful, clears on
  // view — see utils/offersSeen).
  const [offerBadges, setOfferBadges] = useState<Record<string, { pending: number; fresh: number }>>({});

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    loadOrders();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
    // Filtering is now client-side (see `visibleOrders`), so we load once.
  }, []);

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
      // Load all of the user's orders; the status chips filter client-side.
      const data = await requests.getUserOrders();
      setOrders(data);
      void loadOfferBadges(data);
    } catch (error: any) {
      logger.error('Error loading orders:', error);
      setErrorMessage(getFriendlyError(error, language));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // One batched query for all open orders' live offers, joined with the
  // per-device "last seen" timestamps to derive the fresh count.
  const loadOfferBadges = async (allOrders: any[]) => {
    try {
      const openIds = allOrders
        .filter((o) => o.status === 'pending' && !o.technician_id)
        .map((o) => o.id);
      if (openIds.length === 0) {
        setOfferBadges({});
        return;
      }
      const [{ data: offerRows }, lastSeenMap] = await Promise.all([
        supabase
          .from('order_offers')
          .select('order_id, status, created_at')
          .in('order_id', openIds)
          .eq('status', 'pending'),
        getOffersLastSeenMap(openIds),
      ]);
      const badges: Record<string, { pending: number; fresh: number }> = {};
      for (const id of openIds) {
        const rows = (offerRows ?? []).filter((r: any) => r.order_id === id);
        badges[id] = {
          pending: rows.length,
          fresh: countNewPendingOffers(rows as any, lastSeenMap[id] ?? null),
        };
      }
      setOfferBadges(badges);
    } catch (e) {
      logger.warn('offer badges load failed', e);
    }
  };

  // Live offer arrivals on open orders (usually 0–3 subscriptions) so the
  // badge updates without a manual refresh. Re-runs when the open set changes.
  useEffect(() => {
    const open = orders.filter((o) => o.status === 'pending' && !o.technician_id);
    if (open.length === 0) return;
    const cleanups = open.map((o) =>
      subscribeToOrderOffers(o.id, () => void loadOfferBadges(orders))
    );
    return () => cleanups.forEach((fn) => fn());
  }, [orders.map((o) => `${o.id}:${o.status}`).join(',')]);

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending': return { label: isRTL ? 'بانتظار العروض' : 'Awaiting offers', color: COLORS.warning, icon: 'time-outline' };
      case 'accepted': return { label: isRTL ? 'مقبول' : 'Accepted', color: COLORS.info, icon: 'checkmark-circle-outline' };
      case 'picking_up': return { label: isRTL ? 'جاري الاستلام' : 'Picking up', color: COLORS.info, icon: 'car-outline' };
      case 'diagnosing': return { label: isRTL ? 'تحت الفحص' : 'Diagnosing', color: COLORS.primary, icon: 'search-outline' };
      // 'quoted' is legacy (pre payment-v2) — rendered for old rows only.
      case 'quoted': return { label: isRTL ? 'بانتظار تأكيد السعر' : 'Price confirmation', color: COLORS.warning, icon: 'pricetag-outline' };
      case 'awaiting_payment': return { label: isRTL ? 'بانتظار تأكيد الدفع' : 'Confirm payment', color: COLORS.warning, icon: 'card-outline' };
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

  // Payment architecture v2 — the accepted marketplace offer is the agreed
  // customer-facing price (legacy rows fall back to the old final_price).
  const getQuoteInfo = (order: any): { label: string; amount: string; color: string } => {
    const sar = isRTL ? 'ر.س' : 'SAR';
    const agreed = order.accepted_offer_amount ?? order.final_price;
    if (agreed != null && order.status === 'awaiting_payment') {
      return {
        label: isRTL ? 'السعر المتفق عليه — أكّد الدفع' : 'Agreed price — confirm payment',
        amount: `${agreed} ${sar}`,
        color: COLORS.warning,
      };
    }
    if (agreed != null && !['pending', 'cancelled', 'rejected'].includes(order.status)) {
      return {
        label: isRTL ? 'السعر المتفق عليه' : 'Agreed price',
        amount: `${agreed} ${sar}`,
        color: COLORS.success,
      };
    }
    if (agreed != null && order.status === 'cancelled') {
      return {
        label: isRTL ? 'السعر عند الإلغاء' : 'Price at cancellation',
        amount: `${agreed} ${sar}`,
        color: COLORS.error,
      };
    }
    // Open request — the price is set the moment the customer accepts one of
    // the technicians' offers.
    return {
      label: isRTL ? 'السعر' : 'Price',
      amount: isRTL ? 'يتحدد عند قبول أحد العروض' : 'Set when you accept an offer',
      color: COLORS.textSecondary,
    };
  };

  const styles = createStyles(COLORS, isRTL, SHADOWS);

  // Client-side status filtering for the requests list (CHANGE 2).
  const visibleOrders = orders.filter((o) => matchesOrderFilter(o.status, filter));

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{isRTL ? 'طلباتي' : 'My Orders'}</Text>
      </View>

      {/* Status filter bar — admin-style pill chips (CHANGE 2) */}
      <AdminFilterChips filters={ORDER_FILTERS} value={filter} onChange={setFilter} />

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
        ) : visibleOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="construct-outline" size={80} color={COLORS.primary} />
            <Text style={styles.emptyText}>
              {orders.length === 0
                ? (isRTL ? 'لا توجد طلبات بعد' : 'No orders yet')
                : (isRTL ? 'لا توجد طلبات بهذه الحالة' : 'No orders with this status')}
            </Text>
            <Text style={[styles.emptyText, { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 }]}>
              {isRTL ? 'اطلب فني الآن — خدمة سريعة حتى باب منزلك' : 'Request a technician — fast service to your door'}
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
            {visibleOrders.map((order) => {
              const status = getStatusInfo(order.status);
              // Exact format "١٨ يونيو، ٢٠٢٦ - ١١:٢٠ ص" (Arabic-Indic,
              // Gregorian, no weekday) so the client sees when they placed it.
              const dateTimeStr = fmtMyRequestDate(order.created_at, isRTL);
              return (
                <PressableScale
                  key={order.id}
                  to={0.985}
                  style={[styles.orderCard, { borderLeftColor: status.color, borderLeftWidth: 4 }]}
                  onPress={() => router.push(`/order-details?id=${order.id}`)}
                >
                  {/* Top: status pill + live-offers signal */}
                  <View style={styles.cardTopRow}>
                    <View style={[styles.statusPill, { backgroundColor: status.color + '15' }]}>
                      <Ionicons name={status.icon as any} size={11} color={status.color} />
                      <Text style={[styles.statusPillText, { color: status.color }]}>{status.label}</Text>
                    </View>
                    {(() => {
                      const badge = offerBadges[order.id];
                      if (!badge || badge.pending === 0) return null;
                      const hasFresh = badge.fresh > 0;
                      return (
                        <TouchableOpacity
                          onPress={() =>
                            router.push({ pathname: '/order-offers', params: { orderId: order.id } } as any)
                          }
                          style={[
                            styles.offersChip,
                            { backgroundColor: hasFresh ? COLORS.primary : COLORS.primary + '15' },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={
                            isRTL ? `${badge.pending} عروض على هذا الطلب` : `${badge.pending} offers on this request`
                          }
                        >
                          {hasFresh && <View style={styles.offersFreshDot} />}
                          <MaterialCommunityIcons
                            name="cash-multiple"
                            size={12}
                            color={hasFresh ? '#fff' : COLORS.primary}
                          />
                          <Text style={[styles.offersChipText, { color: hasFresh ? '#fff' : COLORS.primary }]}>
                            {hasFresh
                              ? isRTL ? `${badge.fresh} جديد` : `${badge.fresh} new`
                              : isRTL ? `${badge.pending} عروض` : `${badge.pending} offers`}
                          </Text>
                        </TouchableOpacity>
                      );
                    })()}
                  </View>

                  {/* Device row: icon + name */}
                  <View style={styles.cardDeviceRow}>
                    <View style={styles.deviceIcon}>
                      <MaterialCommunityIcons name="cellphone" size={22} color={COLORS.primary} />
                    </View>
                    <Text style={styles.deviceName} numberOfLines={1}>
                      {order.device_brand} {order.device_model}
                    </Text>
                  </View>

                  {/* Request date + time — visible without opening the order */}
                  <View style={styles.cardDateTimeRow}>
                    <Ionicons name="calendar-outline" size={13} color={COLORS.textSecondary} />
                    <Text style={styles.cardDateTimeText} numberOfLines={1}>
                      {dateTimeStr}
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
  offersChip: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  offersChipText: { fontSize: 11.5, fontWeight: '800' },
  offersFreshDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
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
  cardDateTimeRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  cardDateTimeText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textAlign: isRTL ? 'right' : 'left',
  },
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
