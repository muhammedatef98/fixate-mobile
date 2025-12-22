import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Switch, RefreshControl, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { MaterialIcons, Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRequests } from '../../contexts/RequestContext';
import { auth } from '../../lib/supabase';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { registerForPushNotifications, subscribeToNewRequests, unsubscribeFromNewRequests } from '../../services/localNotificationService';

const { width } = Dimensions.get('window');

export default function TechnicianDashboard() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  
  const [isOnline, setIsOnline] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState({
    todayEarnings: 0,
    completedToday: 0,
    pendingOrders: 0,
    rating: 4.9
  });

  const STAT_CARDS = [
    { 
      title: language === 'ar' ? 'أرباح اليوم' : 'Today Earnings', 
      value: `${stats.todayEarnings} ${language === 'ar' ? 'ر.س' : 'SAR'}`, 
      icon: 'wallet', 
      color: '#10B981',
      iconLib: 'FontAwesome5'
    },
    { 
      title: language === 'ar' ? 'طلبات جديدة' : 'New Orders', 
      value: stats.pendingOrders.toString(), 
      icon: 'bell-ring', 
      color: '#F59E0B',
      iconLib: 'MaterialCommunityIcons'
    },
    { 
      title: language === 'ar' ? 'مكتملة اليوم' : 'Completed Today', 
      value: stats.completedToday.toString(), 
      icon: 'check-circle', 
      color: '#3B82F6',
      iconLib: 'FontAwesome5'
    },
    { 
      title: language === 'ar' ? 'التقييم' : 'Rating', 
      value: stats.rating.toFixed(1), 
      icon: 'star', 
      color: '#EF4444',
      iconLib: 'FontAwesome5'
    },
  ];

  useEffect(() => {
    loadOrders();
    setupNotifications();
  }, []);

  const setupNotifications = async () => {
    const hasPermission = await registerForPushNotifications();
    if (hasPermission) {
      const subscription = subscribeToNewRequests('', () => {
        loadOrders(); // Refresh orders when new request arrives
      });
      return () => unsubscribeFromNewRequests(subscription);
    }
  };

  const loadOrders = async () => {
    try {
      const user = await auth.getCurrentUser();
      if (!user) return;

      // Get all orders from Supabase
      const { data: allOrders, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (!allOrders) return;
      
      // Filter pending orders (new requests)
      const pending = allOrders.filter((o: any) => o.status === 'pending');
      
      // Filter accepted orders for this technician
      const myOrders = allOrders.filter((o: any) => 
        o.technician_id === user.id && o.status !== 'pending'
      );
      
      setOrders(pending);

      // Calculate stats
      const today = new Date().toDateString();
      const completedToday = myOrders.filter((o: any) => 
        o.status === 'completed' && new Date(o.updated_at).toDateString() === today
      ).length;
      
      const todayEarnings = myOrders
        .filter((o: any) => 
          o.status === 'completed' && new Date(o.updated_at).toDateString() === today
        )
        .reduce((sum: number, o: any) => sum + (o.estimated_price || 0), 0);

      setStats({
        todayEarnings,
        completedToday,
        pendingOrders: pending.length,
        rating: 4.9 // TODO: Calculate from reviews
      });
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const handleAcceptOrder = async (orderId: string) => {
    try {
      const user = await auth.getCurrentUser();
      if (!user) return;

      const { error } = await supabase
        .from('orders')
        .update({
          status: 'accepted',
          technician_id: user.id,
        })
        .eq('id', orderId);
      
      if (error) throw error;
      
      loadOrders();
    } catch (error) {
      console.error('Error accepting order:', error);
    }
  };

  const renderStatCard = (stat: any, index: number) => {
    const IconComponent = stat.iconLib === 'FontAwesome5' ? FontAwesome5 : MaterialCommunityIcons;
    
    return (
      <View key={index} style={[styles.statCard, { backgroundColor: COLORS.card }, SHADOWS.small]}>
        <View style={[styles.statIcon, { backgroundColor: `${stat.color}15` }]}>
          <IconComponent name={stat.icon as any} size={22} color={stat.color} />
        </View>
        <Text style={[styles.statValue, { color: COLORS.text }]}>{stat.value}</Text>
        <Text style={[styles.statTitle, { color: COLORS.textSecondary }]}>{stat.title}</Text>
      </View>
    );
  };

  const renderOrderCard = (order: any) => (
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
          <Text style={[styles.orderIssue, { color: COLORS.textSecondary }]}>
            {order.issue_description}
          </Text>
        </View>
        <View style={[styles.priceTag, { backgroundColor: '#10B98115' }]}>
          <Text style={[styles.priceText, { color: '#10B981' }]}>
            {order.estimated_price} {language === 'ar' ? 'ر.س' : 'SAR'}
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
      </View>

      <View style={styles.orderActions}>
        <TouchableOpacity
          style={[styles.acceptButton, { backgroundColor: '#10B981' }]}
          onPress={() => handleAcceptOrder(order.id)}
        >
          <MaterialIcons name="check" size={20} color="#FFFFFF" />
          <Text style={styles.acceptButtonText}>
            {language === 'ar' ? 'قبول' : 'Accept'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.detailsButton, { backgroundColor: COLORS.primary + '15' }]}
          onPress={() => router.push(`/(technician)/order/${order.id}`)}
        >
          <Text style={[styles.detailsButtonText, { color: COLORS.primary }]}>
            {language === 'ar' ? 'التفاصيل' : 'Details'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: COLORS.text }]}>
              {language === 'ar' ? 'مرحباً، فني' : 'Hello, Technician'} 🔧
            </Text>
            <View style={styles.statusContainer}>
              <View style={[styles.statusDot, { backgroundColor: isOnline ? '#10B981' : '#EF4444' }]} />
              <Text style={[styles.statusText, { color: COLORS.textSecondary }]}>
                {isOnline 
                  ? (language === 'ar' ? 'متاح لاستقبال الطلبات' : 'Available for orders')
                  : (language === 'ar' ? 'غير متاح حالياً' : 'Currently unavailable')
                }
              </Text>
            </View>
          </View>
          <Switch
            value={isOnline}
            onValueChange={setIsOnline}
            trackColor={{ false: COLORS.border, true: '#A7F3D0' }}
            thumbColor={isOnline ? '#10B981' : COLORS.card}
          />
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {STAT_CARDS.map((stat, index) => renderStatCard(stat, index))}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
            {language === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}
          </Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.card }, SHADOWS.small]}
              onPress={() => router.push('/(technician)/my-orders')}
            >
              <MaterialCommunityIcons name="clipboard-list" size={24} color={COLORS.primary} />
              <Text style={[styles.actionButtonText, { color: COLORS.text }]}>
                {language === 'ar' ? 'طلباتي' : 'My Orders'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.card }, SHADOWS.small]}
              onPress={() => router.push('/(technician)/earnings')}
            >
              <MaterialCommunityIcons name="cash-multiple" size={24} color="#10B981" />
              <Text style={[styles.actionButtonText, { color: COLORS.text }]}>
                {language === 'ar' ? 'الأرباح' : 'Earnings'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.card }, SHADOWS.small]}
              onPress={() => router.push('/(technician)/profile')}
            >
              <MaterialCommunityIcons name="account-cog" size={24} color="#F59E0B" />
              <Text style={[styles.actionButtonText, { color: COLORS.text }]}>
                {language === 'ar' ? 'الإعدادات' : 'Settings'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* New Orders */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
              {language === 'ar' ? 'الطلبات الجديدة' : 'New Orders'} ({orders.length})
            </Text>
            <TouchableOpacity onPress={() => router.push('/(technician)/available-orders')}>
              <Text style={[styles.seeAllText, { color: COLORS.primary }]}>
                {language === 'ar' ? 'عرض الكل' : 'See All'}
              </Text>
            </TouchableOpacity>
          </View>

          {orders.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: COLORS.card }, SHADOWS.small]}>
              <MaterialCommunityIcons name="inbox" size={48} color={COLORS.textSecondary} />
              <Text style={[styles.emptyStateText, { color: COLORS.textSecondary }]}>
                {language === 'ar' ? 'لا توجد طلبات جديدة حالياً' : 'No new orders at the moment'}
              </Text>
            </View>
          ) : (
            orders.slice(0, 3).map(renderOrderCard)
          )}
        </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  statCard: {
    width: (width - SPACING.lg * 2 - SPACING.md) / 2,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
  },
  statTitle: {
    fontSize: 12,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  actionButton: {
    flex: 1,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
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
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
  },
  orderIssue: {
    fontSize: 14,
  },
  priceTag: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  priceText: {
    fontSize: 14,
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
  orderActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  detailsButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  detailsButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyState: {
    padding: SPACING.xl * 2,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    gap: SPACING.md,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
