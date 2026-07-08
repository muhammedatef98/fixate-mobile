import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { requests, auth } from '../../lib/supabase-api';
import { useApp } from '../../contexts/AppContext';
import { logger } from '../../utils/logger';
import { safeBack } from '../../utils/navigation';
import { formatAppDateOnly } from '../../lib/formatDate';
import { AdminFilterChips, type AdminFilterChip } from '../../components/admin/AdminUI';

// Status filter chips — same pill-chip style as the customer orders screen
// (reuses AdminFilterChips). RTL order: الكل · مكتملة · قيد التنفيذ · مقبولة ·
// مرفوضة · ملغاة. Each key maps directly to a real order status string.
type OrderFilterKey = 'all' | 'completed' | 'in_progress' | 'accepted' | 'rejected' | 'cancelled';

const ORDER_FILTERS: AdminFilterChip<OrderFilterKey>[] = [
  { key: 'all', ar: 'الكل', en: 'All' },
  { key: 'completed', ar: 'مكتملة', en: 'Completed' },
  { key: 'in_progress', ar: 'قيد التنفيذ', en: 'In progress' },
  { key: 'accepted', ar: 'مقبولة', en: 'Accepted' },
  { key: 'rejected', ar: 'مرفوضة', en: 'Rejected' },
  { key: 'cancelled', ar: 'ملغاة', en: 'Cancelled' },
];

// Per-status badge config (label + colour). Color-coded: accepted = orange,
// active = blue, completed = green, rejected/cancelled = red.
const STATUS_CONFIG: Record<string, { labelAr: string; labelEn: string; color: string }> = {
  accepted: { labelAr: 'مقبولة', labelEn: 'Accepted', color: '#F59E0B' },
  in_progress: { labelAr: 'قيد التنفيذ', labelEn: 'In Progress', color: '#3B82F6' },
  completed: { labelAr: 'مكتملة', labelEn: 'Completed', color: '#10B981' },
  rejected: { labelAr: 'مرفوضة', labelEn: 'Rejected', color: '#EF4444' },
  cancelled: { labelAr: 'ملغاة', labelEn: 'Cancelled', color: '#EF4444' },
};

export default function MyOrdersScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';
  const styles = makeStyles(isRTL);

  const [filter, setFilter] = useState<OrderFilterKey>('all');
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Load all of the technician's orders once; the chips filter client-side.
  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const user = await auth.getCurrentUser();
      if (!user) return;

      const allOrders = await requests.getMyOrders();
      const myOrders = allOrders.filter((o: any) => o.technician_id === user.id);

      setOrders(myOrders);
    } catch (error) {
      logger.error('Error loading orders:', error);
    }
  };

  // Derived view — chip key maps directly to the order status string.
  const visibleOrders = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await requests.updateStatus(orderId, newStatus as any);
      loadOrders();
    } catch (error) {
      logger.error('Error updating order:', error);
    }
  };

  const renderOrderCard = (order: any) => {
    if (!order || !order.id) return null;
    const statusConfig = STATUS_CONFIG[order.status];
    // A rejected order is final & read-only — mute the card and drop all
    // action buttons so it visually reads as "closed/ended" (Fix 7).
    const isRejected = order.status === 'rejected';

    return (
      <TouchableOpacity
        key={order.id}
        activeOpacity={isRejected ? 1 : 0.7}
        style={[
          styles.orderCard,
          { backgroundColor: COLORS.card },
          SHADOWS.medium,
          isRejected && styles.orderCardClosed,
        ]}
        onPress={() => {
          if (order.id) {
            // Use correct path for technician order management
            router.push({
              pathname: '/(technician)/manage-order',
              params: { id: order.id }
            });
          }
        }}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <Text style={[styles.orderTitle, { color: COLORS.text }]}>
              {order.device_brand} {order.device_model}
            </Text>
            <Text style={[styles.orderIssue, { color: COLORS.textSecondary }]} numberOfLines={2}>
              {order.issue_description}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusConfig?.color}15` }]}>
            <Text style={[styles.statusText, { color: statusConfig?.color }]}>
              {language === 'ar' ? statusConfig?.labelAr : statusConfig?.labelEn}
            </Text>
          </View>
        </View>

        <View style={styles.orderDetails}>
          <View style={styles.orderDetailItem}>
            <MaterialIcons name="location-on" size={16} color={COLORS.textSecondary} />
            <Text style={[styles.orderDetailText, { color: COLORS.textSecondary }]} numberOfLines={1}>
              {order.location || (language === 'ar' ? 'لم يحدد' : 'Not specified')}
            </Text>
          </View>
          <View style={styles.orderDetailItem}>
            <MaterialIcons name="access-time" size={16} color={COLORS.textSecondary} />
            <Text style={[styles.orderDetailText, { color: COLORS.textSecondary }]}>
              {formatAppDateOnly(order.created_at, language === 'ar')}
            </Text>
          </View>
          <View style={styles.orderDetailItem}>
            <MaterialCommunityIcons name="cash" size={16} color="#10B981" />
            <Text style={[styles.priceText, { color: '#10B981' }]}>
              {(order as any).accepted_offer_amount ?? (order as any).final_price ?? order.estimated_price} {language === 'ar' ? 'ر.س' : 'SAR'}
            </Text>
          </View>
        </View>

        {order.status === 'accepted' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#3B82F6' }]}
            onPress={() => updateOrderStatus(order.id, 'in_progress')}
          >
            <MaterialIcons name="play-arrow" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>
              {language === 'ar' ? 'بدء العمل' : 'Start Work'}
            </Text>
          </TouchableOpacity>
        )}

        {order.status === 'in_progress' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#10B981' }]}
            onPress={() => updateOrderStatus(order.id, 'completed')}
          >
            <MaterialIcons name="check" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>
              {language === 'ar' ? 'إكمال' : 'Complete'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Rejected = final & read-only: no actions, just a closed marker. */}
        {isRejected && (
          <View style={styles.closedRow}>
            <MaterialCommunityIcons name="lock-outline" size={16} color="#EF4444" />
            <Text style={styles.closedText}>
              {language === 'ar' ? 'تم إنهاء هذا الطلب (مرفوض)' : 'This request is closed (rejected)'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack('/(technician)')}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: COLORS.text }]}>
          {language === 'ar' ? 'أعمالي' : 'My Jobs'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Status filter bar — admin-style pill chips */}
      <AdminFilterChips filters={ORDER_FILTERS} value={filter} onChange={setFilter} />

      {/* Orders List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {visibleOrders.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: COLORS.card }, SHADOWS.small]}>
            <MaterialCommunityIcons name="inbox" size={48} color={COLORS.textSecondary} />
            <Text style={[styles.emptyStateText, { color: COLORS.textSecondary }]}>
              {language === 'ar' ? 'لا توجد طلبات' : 'No orders'}
            </Text>
          </View>
        ) : (
          visibleOrders.map(renderOrderCard)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (isRTL: boolean) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  orderCard: {
    padding: SPACING.l,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  // Muted, "ended" look for a final (rejected) order.
  orderCardClosed: {
    opacity: 0.6,
  },
  closedRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: '#EF444415',
  },
  closedText: {
    color: '#EF4444',
    fontSize: 12.5,
    fontWeight: '700',
  },
  orderHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  orderInfo: {
    flex: 1,
    marginRight: isRTL ? 0 : SPACING.md,
    marginLeft: isRTL ? SPACING.md : 0,
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
  },
  orderIssue: {
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    height: 'fit-content' as any,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  orderDetails: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  orderDetailItem: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  orderDetailText: {
    fontSize: 13,
    flex: 1,
  },
  priceText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  actionButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    gap: SPACING.xs,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyState: {
    padding: SPACING.xl * 2,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.xl,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
