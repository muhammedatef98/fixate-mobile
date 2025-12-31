import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { requests } from '../../lib/supabase-api';
import BottomNavTech from '../../components/BottomNavTech';
import type { Order } from '../../lib/supabase-api';

const { width } = Dimensions.get('window');

export default function TechnicianHomeScreen() {
  const router = useRouter();
  const { isDark, language } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';

  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'available' | 'my-orders'>('available');

  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadOrders();
    // Set up real-time subscription for new orders
    const subscription = requests.subscribeToOrders(() => {
      loadOrders();
    });

    return () => subscription?.unsubscribe();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      // Fetch available orders (pending status)
      const available = await requests.getAvailableOrders();
      setAvailableOrders(available || []);

      // Fetch technician's accepted orders
      const myOrdersList = await requests.getMyOrders();
      setMyOrders(myOrdersList || []);

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    try {
      const user = await auth.getCurrentUser();
      if (!user) return;
      await requests.acceptOrder(orderId);
      loadOrders();
      // Navigate to manage order screen
      router.push({
        pathname: '/(technician)/manage-order',
        params: { id: orderId }
      });
    } catch (error) {
      console.error('Error accepting order:', error);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      pending: '#F59E0B',
      accepted: '#3B82F6',
      picking_up: '#8B5CF6',
      diagnosing: '#06B6D4',
      repairing: '#EC4899',
      delivering: '#10B981',
      completed: '#10B981',
    };
    return colors[status] || '#6B7280';
  };

  const styles = createStyles(COLORS, SHADOWS, isRTL);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: COLORS.card, borderBottomColor: COLORS.border }]}>
        <View style={styles.headerInfo}>
          <Text style={[styles.greeting, { color: COLORS.text }]}>
            {isRTL ? 'أهلاً بك' : 'Welcome Back'}
          </Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
            <Text style={[styles.statusText, { color: COLORS.textSecondary }]}>
              {isRTL ? 'متصل' : 'Online'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push('/profile')}>
          <View style={[styles.profileIcon, { backgroundColor: COLORS.primary + '20' }]}>
            <MaterialIcons name="account-circle" size={32} color={COLORS.primary} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: COLORS.card }, SHADOWS.small]}>
          <View style={[styles.statIconContainer, { backgroundColor: '#FEF3C7' }]}>
            <MaterialCommunityIcons name="briefcase-check" size={24} color="#F59E0B" />
          </View>
          <Text style={[styles.statValue, { color: COLORS.text }]}>{myOrders.length}</Text>
          <Text style={[styles.statLabel, { color: COLORS.textSecondary }]}>
            {isRTL ? 'طلباتي' : 'My Orders'}
          </Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: COLORS.card }, SHADOWS.small]}>
          <View style={[styles.statIconContainer, { backgroundColor: '#DBEAFE' }]}>
            <MaterialCommunityIcons name="star" size={24} color="#3B82F6" />
          </View>
          <Text style={[styles.statValue, { color: COLORS.text }]}>4.8</Text>
          <Text style={[styles.statLabel, { color: COLORS.textSecondary }]}>
            {isRTL ? 'التقييم' : 'Rating'}
          </Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: COLORS.card }, SHADOWS.small]}>
          <View style={[styles.statIconContainer, { backgroundColor: '#ECFDF5' }]}>
            <MaterialCommunityIcons name="cash" size={24} color="#10B981" />
          </View>
          <Text style={[styles.statValue, { color: COLORS.text }]}>2,450</Text>
          <Text style={[styles.statLabel, { color: COLORS.textSecondary }]}>
            {isRTL ? 'هذا الأسبوع' : 'This Week'}
          </Text>
        </View>
      </View>

      {/* Tab Switcher */}
      <View style={[styles.tabContainer, { backgroundColor: COLORS.card, borderBottomColor: COLORS.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'available' && [styles.activeTab, { borderBottomColor: COLORS.primary }],
          ]}
          onPress={() => setActiveTab('available')}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'available' ? COLORS.primary : COLORS.textSecondary,
                fontWeight: activeTab === 'available' ? '700' : '500',
              },
            ]}
          >
            {isRTL ? 'الطلبات المتاحة' : 'Available Orders'}
          </Text>
          <View style={[styles.badge, { backgroundColor: COLORS.primary }]}>
            <Text style={styles.badgeText}>{availableOrders.length}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'my-orders' && [styles.activeTab, { borderBottomColor: COLORS.primary }],
          ]}
          onPress={() => setActiveTab('my-orders')}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'my-orders' ? COLORS.primary : COLORS.textSecondary,
                fontWeight: activeTab === 'my-orders' ? '700' : '500',
              },
            ]}
          >
            {isRTL ? 'طلباتي' : 'My Orders'}
          </Text>
          <View style={[styles.badge, { backgroundColor: COLORS.primary }]}>
            <Text style={styles.badgeText}>{myOrders.length}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Orders List */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : activeTab === 'available' ? (
          <Animated.View style={[styles.ordersContainer, { opacity: fadeAnim }]}>
            {availableOrders.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="inbox-outline" size={64} color={COLORS.textSecondary} />
                <Text style={[styles.emptyText, { color: COLORS.textSecondary }]}>
                  {isRTL ? 'لا توجد طلبات متاحة الآن' : 'No available orders'}
                </Text>
              </View>
            ) : (
              availableOrders.map((order) => (
                <TouchableOpacity
                  key={order.id}
                  style={[styles.orderCard, { backgroundColor: COLORS.card }, SHADOWS.small]}
                  onPress={() => router.push({
                    pathname: '/order-details',
                    params: { id: order.id }
                  })}
                >
                  <View style={styles.orderHeader}>
                    <View style={styles.deviceInfo}>
                      <View style={[styles.deviceIconContainer, { backgroundColor: COLORS.primary + '20' }]}>
                        <MaterialCommunityIcons name="cellphone" size={24} color={COLORS.primary} />
                      </View>
                      <View>
                        <Text style={[styles.deviceName, { color: COLORS.text }]}>
                          {order.device_brand} {order.device_model}
                        </Text>
                        <Text style={[styles.orderId, { color: COLORS.textSecondary }]}>
                          #{order.id?.slice(0, 8)}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.priceBadge, { backgroundColor: getStatusColor(order.status) + '20' }]}>
                      <Text style={[styles.priceText, { color: getStatusColor(order.status) }]}>
                        {order.estimated_price} {isRTL ? 'ر.س' : 'SAR'}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.divider, { backgroundColor: COLORS.border }]} />

                  <View style={styles.orderFooter}>
                    <View style={styles.locationRow}>
                      <Ionicons name="location-outline" size={16} color={COLORS.textSecondary} />
                      <Text style={[styles.locationText, { color: COLORS.textSecondary }]}>
                        {order.customer_city || (isRTL ? 'الرياض' : 'Riyadh')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.acceptButton, { backgroundColor: COLORS.primary }]}
                      onPress={() => handleAcceptOrder(order.id!)}
                    >
                      <MaterialIcons name="check" size={18} color="#fff" />
                      <Text style={styles.acceptButtonText}>
                        {isRTL ? 'قبول' : 'Accept'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </Animated.View>
        ) : (
          <Animated.View style={[styles.ordersContainer, { opacity: fadeAnim }]}>
            {myOrders.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="clipboard-outline" size={64} color={COLORS.textSecondary} />
                <Text style={[styles.emptyText, { color: COLORS.textSecondary }]}>
                  {isRTL ? 'لم تقبل أي طلبات بعد' : 'No accepted orders yet'}
                </Text>
              </View>
            ) : (
              myOrders.map((order) => (
                <TouchableOpacity
                  key={order.id}
                  style={[styles.orderCard, { backgroundColor: COLORS.card }, SHADOWS.small]}
                  onPress={() => router.push({
                    pathname: '/order-details',
                    params: { id: order.id }
                  })}
                >
                  <View style={styles.orderHeader}>
                    <View style={styles.deviceInfo}>
                      <View style={[styles.deviceIconContainer, { backgroundColor: COLORS.primary + '20' }]}>
                        <MaterialCommunityIcons name="cellphone" size={24} color={COLORS.primary} />
                      </View>
                      <View>
                        <Text style={[styles.deviceName, { color: COLORS.text }]}>
                          {order.device_brand} {order.device_model}
                        </Text>
                        <Text style={[styles.orderId, { color: COLORS.textSecondary }]}>
                          #{order.id?.slice(0, 8)}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '20' }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                        {isRTL ? 'قيد المعالجة' : 'Processing'}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.divider, { backgroundColor: COLORS.border }]} />

                  <View style={styles.orderFooter}>
                    <View style={styles.locationRow}>
                      <Ionicons name="location-outline" size={16} color={COLORS.textSecondary} />
                      <Text style={[styles.locationText, { color: COLORS.textSecondary }]}>
                        {order.customer_city || (isRTL ? 'الرياض' : 'Riyadh')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.viewButton, { borderColor: COLORS.primary }]}
                      onPress={() => router.push({
                        pathname: '/chat',
                        params: { orderId: order.id, otherUserName: isRTL ? 'العميل' : 'Customer' }
                      })}
                    >
                      <MaterialIcons name="chat" size={18} color={COLORS.primary} />
                      <Text style={[styles.viewButtonText, { color: COLORS.primary }]}>
                        {isRTL ? 'محادثة' : 'Chat'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </Animated.View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNavTech />
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any, SHADOWS: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      padding: SPACING.lg,
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
    },
    headerInfo: { alignItems: isRTL ? 'flex-end' : 'flex-start' },
    greeting: { fontSize: 22, fontWeight: 'bold' },
    statusRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      marginTop: 4,
      gap: 6,
    },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusText: { fontSize: 13, fontWeight: '500' },
    profileIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },

    statsContainer: {
      flexDirection: 'row',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.lg,
      gap: SPACING.md,
    },
    statCard: {
      flex: 1,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
    },
    statIconContainer: {
      width: 44,
      height: 44,
      borderRadius: BORDER_RADIUS.md,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    statValue: { fontSize: 18, fontWeight: 'bold' },
    statLabel: { fontSize: 12, marginTop: 4 },

    tabContainer: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      paddingHorizontal: SPACING.lg,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: SPACING.md,
      borderBottomWidth: 3,
      borderBottomColor: 'transparent',
      gap: SPACING.sm,
    },
    activeTab: {},
    tabText: { fontSize: 15 },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 12,
      minWidth: 24,
      alignItems: 'center',
    },
    badgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

    scrollView: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
    ordersContainer: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.lg },

    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
    emptyText: { fontSize: 16, marginTop: SPACING.lg },

    orderCard: {
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
      marginBottom: SPACING.lg,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    orderHeader: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: SPACING.md,
      gap: SPACING.sm,
    },
    deviceInfo: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: SPACING.md,
      flex: 1,
      flexShrink: 1,
    },
    deviceIconContainer: {
      width: 44,
      height: 44,
      borderRadius: BORDER_RADIUS.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    deviceName: { fontSize: 16, fontWeight: 'bold', flexWrap: 'wrap' },
    orderId: { fontSize: 12, marginTop: 2 },

    priceBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, minWidth: 80, alignItems: 'center' },
    priceText: { fontWeight: 'bold', fontSize: 14 },

    statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, minWidth: 90, alignItems: 'center' },
    statusText: { fontWeight: 'bold', fontSize: 12 },

    divider: { height: 1, marginVertical: SPACING.md },

    orderFooter: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    locationRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 4,
    },
    locationText: { fontSize: 12 },

    acceptButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
    },
    acceptButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },

    viewButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1.5,
    },
    viewButtonText: { fontWeight: '600', fontSize: 13 },
  });
