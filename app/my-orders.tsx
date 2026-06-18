import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { useOrders } from '../contexts/OrdersContext';
import { useAuth } from '../contexts/AuthContext';
import type { Order } from '../services/orderService';
import { RTLMaterialIcon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';
import InvoiceDownloadButton from '../components/InvoiceDownloadButton';

const ORDER_STATUS_CONFIG = {
  pending: {
    ar: 'قيد الانتظار',
    en: 'Pending',
    icon: 'clock-outline',
    color: '#F59E0B',
    progress: 0,
  },
  accepted: {
    ar: 'تم القبول',
    en: 'Accepted',
    icon: 'check-circle',
    color: '#10B981',
    progress: 20,
  },
  picking_up: {
    ar: 'جاري الاستلام',
    en: 'Picking Up',
    icon: 'car',
    color: '#3B82F6',
    progress: 40,
  },
  diagnosing: {
    ar: 'جاري الفحص',
    en: 'Diagnosing',
    icon: 'magnify',
    color: '#8B5CF6',
    progress: 50,
  },
  quoted: {
    ar: 'بانتظار موافقتك على السعر',
    en: 'Awaiting your approval',
    icon: 'cash-check',
    color: '#F59E0B',
    progress: 55,
  },
  awaiting_payment: {
    ar: 'بإنتظار الدفع',
    en: 'Awaiting payment',
    icon: 'credit-card-clock',
    color: '#0EA5E9',
    progress: 58,
  },
  waiting_parts: {
    ar: 'بانتظار قطع الغيار',
    en: 'Waiting for Parts',
    icon: 'package-variant',
    color: '#A855F7',
    progress: 60,
  },
  repairing: {
    ar: 'جاري الإصلاح',
    en: 'Repairing',
    icon: 'tools',
    color: '#EC4899',
    progress: 70,
  },
  testing: {
    ar: 'جاري الاختبار',
    en: 'Testing',
    icon: 'check-decagram',
    color: '#0EA5E9',
    progress: 80,
  },
  delivering: {
    ar: 'جاري التوصيل',
    en: 'Delivering',
    icon: 'truck-delivery',
    color: '#06B6D4',
    progress: 90,
  },
  completed: {
    ar: 'مكتمل',
    en: 'Completed',
    icon: 'check-all',
    color: '#10B981',
    progress: 100,
  },
  cancelled: {
    ar: 'ملغي',
    en: 'Cancelled',
    icon: 'close-circle',
    color: '#EF4444',
    progress: 0,
  },
  rejected: {
    ar: 'مرفوض',
    en: 'Rejected',
    icon: 'cancel',
    color: '#EF4444',
    progress: 0,
  },
};

export default function MyOrdersScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';

  const { orders, loading, refreshOrders } = useOrders();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  useEffect(() => {
    if (!user) {
      router.replace('/login-otp');
    }
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshOrders();
    setRefreshing(false);
  };

  const getFilteredOrders = () => {
    switch (filter) {
      case 'active':
        return orders.filter(o => !['completed', 'cancelled', 'rejected'].includes(o.status));
      case 'completed':
        return orders.filter(o => ['completed', 'cancelled', 'rejected'].includes(o.status));
      default:
        return orders;
    }
  };

  const renderOrderCard = (order: Order) => {
    const statusConfig = ORDER_STATUS_CONFIG[order.status];
    const isActive = !['completed', 'cancelled'].includes(order.status);

    return (
      <TouchableOpacity
        key={order.id}
        style={[styles.orderCard, { backgroundColor: COLORS.card }, SHADOWS.medium]}
        onPress={() => router.push(`/order-details?id=${order.id}`)}
      >
        {/* Header with Status */}
        <View style={[styles.statusBadge, { backgroundColor: `${statusConfig.color}15`, alignSelf: 'flex-start', marginBottom: SPACING.md }]}>
          <MaterialCommunityIcons name={statusConfig.icon as any} size={14} color={statusConfig.color} />
          <Text style={[styles.statusText, { color: statusConfig.color }]} numberOfLines={1}>
            {isRTL ? statusConfig.ar : statusConfig.en}
          </Text>
        </View>

        {/* Device Info */}
        <View style={styles.deviceRow}>
          <View style={[styles.deviceIconContainer, { backgroundColor: COLORS.primary + '15' }]}>
            <MaterialCommunityIcons 
              name={order.device_brand?.toLowerCase().includes('ipad') || order.device_brand?.toLowerCase().includes('tablet') ? 'tablet' : 
                    order.device_brand?.toLowerCase().includes('watch') ? 'watch' : 'cellphone'} 
              size={24} 
              color={COLORS.primary} 
            />
          </View>
          <View style={styles.deviceInfo}>
            <Text style={[styles.deviceName, { color: COLORS.text }]} numberOfLines={1}>
              {order.device_brand} {order.device_model}
            </Text>
            <Text style={[styles.orderDate, { color: COLORS.textSecondary }]}>
              {new Date(order.created_at || Date.now()).toLocaleDateString(isRTL ? 'ar' : 'en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </View>
        </View>

        {/* Issue Description */}
        <Text style={[styles.issueText, { color: COLORS.textSecondary }]} numberOfLines={2}>
          {order.issue_description}
        </Text>

        {/* Progress Bar (for active orders) */}
        {isActive && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: COLORS.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: statusConfig.color,
                    width: `${statusConfig.progress}%`,
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: COLORS.textSecondary }]}>
              {statusConfig.progress}%
            </Text>
          </View>
        )}

        {/* Service Type & Price Row */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <MaterialCommunityIcons name="wrench" size={16} color={COLORS.textSecondary} />
            <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>
              {order.service_type || (isRTL ? 'صيانة عامة' : 'General Repair')}
            </Text>
          </View>
          <View style={styles.priceTag}>
            <Text style={[styles.priceValue, { color: COLORS.primary }]}>
              {order.estimated_price ? `${order.estimated_price} ${isRTL ? 'ر.س' : 'SAR'}` : (isRTL ? 'غير محدد' : 'TBD')}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={[styles.orderFooter, { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }]}>
          {order.status === 'completed' && (
            <InvoiceDownloadButton orderId={order.id} isRTL={isRTL} COLORS={COLORS} variant="inline" />
          )}
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={[styles.detailsButton, { backgroundColor: COLORS.primary }]}
            onPress={() => router.push(`/order-details?id=${order.id}`)}
          >
            <Text style={styles.detailsButtonText}>
              {isRTL ? 'عرض التفاصيل' : 'View Details'}
            </Text>
            <MaterialCommunityIcons
              name={isRTL ? 'chevron-left' : 'chevron-right'} 
              size={18} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const filteredOrders = getFilteredOrders();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={isRTL ? 'رجوع' : 'Back'} onPress={() => safeBack()} style={styles.backButton}>
          <RTLMaterialIcon name="arrow-back" 
            size={24} 
            color={COLORS.text} 
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: COLORS.text }]}>
          {isRTL ? 'طلباتي' : 'My Orders'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {['all', 'active', 'completed'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterTab,
              filter === f && { backgroundColor: COLORS.primary },
              filter !== f && { backgroundColor: COLORS.card },
            ]}
            onPress={() => setFilter(f as any)}
          >
            <Text
              style={[
                styles.filterText,
                { color: filter === f ? '#FFFFFF' : COLORS.textSecondary },
              ]}
            >
              {isRTL
                ? f === 'all' ? 'الكل' : f === 'active' ? 'نشط' : 'مكتمل'
                : f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Completed'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Orders List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="inbox" size={64} color={COLORS.textSecondary} />
            <Text style={[styles.emptyText, { color: COLORS.textSecondary }]}>
              {isRTL ? 'لا توجد طلبات' : 'No orders found'}
            </Text>
          </View>
        ) : (
          filteredOrders.map(renderOrderCard)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  filterTab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  orderCard: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  deviceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    gap: SPACING.xs,
    // Android measures Arabic text in a flex row narrower than its content,
    // clipping "قيد الانتظار" down to "قيد". Letting the badge keep its
    // natural width (no shrink, no wrap) fixes the truncation on Android
    // without affecting iOS.
    flexShrink: 0,
    flexWrap: 'nowrap',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 0,
  },
  issueText: {
    fontSize: 14,
    marginBottom: SPACING.md,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    width: 40,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  priceTag: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  priceValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
  },
  detailsButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl * 3,
  },
  emptyText: {
    fontSize: 16,
    marginTop: SPACING.md,
  },
});
