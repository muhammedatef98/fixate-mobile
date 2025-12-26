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
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { requests, auth } from '../lib/supabase-api';
import type { Order } from '../lib/supabase-api';

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
  repairing: {
    ar: 'جاري الإصلاح',
    en: 'Repairing',
    icon: 'tools',
    color: '#EC4899',
    progress: 70,
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
};

export default function MyOrdersScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const user = await auth.getCurrentUser();
      if (!user) {
        router.replace('/login');
        return;
      }

      const userOrders = await requests.getUserRequests(user.id);
      setOrders(userOrders);
    } catch (error) {
      logger.error('Error loading orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const getFilteredOrders = () => {
    switch (filter) {
      case 'active':
        return orders.filter(o => !['completed', 'cancelled'].includes(o.status));
      case 'completed':
        return orders.filter(o => ['completed', 'cancelled'].includes(o.status));
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
        {/* Header */}
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <Text style={[styles.deviceName, { color: COLORS.text }]}>
              {order.device_brand} {order.device_model}
            </Text>
            <Text style={[styles.orderDate, { color: COLORS.textSecondary }]}>
              {new Date(order.created_at).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusConfig.color}15` }]}>
            <MaterialCommunityIcons name={statusConfig.icon as any} size={16} color={statusConfig.color} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {isRTL ? statusConfig.ar : statusConfig.en}
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

        {/* Footer */}
        <View style={styles.orderFooter}>
          <View style={styles.priceContainer}>
            <Text style={[styles.priceLabel, { color: COLORS.textSecondary }]}>
              {isRTL ? 'السعر التقديري' : 'Estimated Price'}
            </Text>
            <Text style={[styles.priceValue, { color: COLORS.primary }]}>
              {order.estimated_price} {isRTL ? 'ر.س' : 'SAR'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.detailsButton, { backgroundColor: COLORS.primary }]}
            onPress={() => router.push(`/order-details?id=${order.id}`)}
          >
            <Text style={styles.detailsButtonText}>
              {isRTL ? 'التفاصيل' : 'Details'}
            </Text>
            <MaterialIcons 
              name={isRTL ? 'arrow-back' : 'arrow-forward'} 
              size={16} 
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons 
            name={isRTL ? 'arrow-forward' : 'arrow-back'} 
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
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  orderInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
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
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
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
    textAlign: 'right',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceContainer: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
    marginBottom: SPACING.xs,
  },
  priceValue: {
    fontSize: 18,
    fontWeight: 'bold',
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
