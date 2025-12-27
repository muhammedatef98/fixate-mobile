import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { requests, auth } from '../../lib/supabase-api';
import { useApp } from '../../contexts/AppContext';

const STATUS_TABS = [
  { id: 'accepted', labelAr: 'مقبولة', labelEn: 'Accepted', color: '#F59E0B' },
  { id: 'in_progress', labelAr: 'قيد التنفيذ', labelEn: 'In Progress', color: '#3B82F6' },
  { id: 'completed', labelAr: 'مكتملة', labelEn: 'Completed', color: '#10B981' },
];

export default function MyOrdersScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  
  const [selectedTab, setSelectedTab] = useState('accepted');
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [selectedTab]);

  const loadOrders = async () => {
    try {
      const user = await auth.getCurrentUser();
      if (!user) return;

      const allOrders = await requests.getAll();
      const myOrders = allOrders.filter((o: any) => 
        o.technician_id === user.id && o.status === selectedTab
      );
      
      setOrders(myOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await requests.update(orderId, { status: newStatus });
      loadOrders();
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  const renderOrderCard = (order: any) => {
    const statusConfig = STATUS_TABS.find(t => t.id === order.status);
    
    return (
      <TouchableOpacity
        key={order.id}
        style={[styles.orderCard, { backgroundColor: COLORS.card }, SHADOWS.medium]}
        onPress={() => router.push(`/(technician)/order/${order.id}`)}
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
              {new Date(order.created_at).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
            </Text>
          </View>
          <View style={styles.orderDetailItem}>
            <MaterialCommunityIcons name="cash" size={16} color="#10B981" />
            <Text style={[styles.priceText, { color: '#10B981' }]}>
              {order.estimated_price} {language === 'ar' ? 'ر.س' : 'SAR'}
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
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: COLORS.text }]}>
          {language === 'ar' ? 'طلباتي' : 'My Orders'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Status Tabs */}
      <View style={styles.tabs}>
        {STATUS_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              selectedTab === tab.id && { backgroundColor: `${tab.color}15` }
            ]}
            onPress={() => setSelectedTab(tab.id)}
          >
            <Text
              style={[
                styles.tabText,
                { color: selectedTab === tab.id ? tab.color : COLORS.textSecondary }
              ]}
            >
              {language === 'ar' ? tab.labelAr : tab.labelEn}
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
        {orders.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: COLORS.card }, SHADOWS.small]}>
            <MaterialCommunityIcons name="inbox" size={48} color={COLORS.textSecondary} />
            <Text style={[styles.emptyStateText, { color: COLORS.textSecondary }]}>
              {language === 'ar' ? 'لا توجد طلبات' : 'No orders'}
            </Text>
          </View>
        ) : (
          orders.map(renderOrderCard)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 13,
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
    marginBottom: SPACING.md,
  },
  orderInfo: {
    flex: 1,
    marginRight: SPACING.md,
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
    flexDirection: 'row',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
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
