import React, { useState, useEffect, useRef } from 'react';
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
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import * as orderService from '../../services/orderService';
import BottomNavTech from '../../components/BottomNavTech';

const { width } = Dimensions.get('window');

export default function TechnicianHomeScreen() {
  const router = useRouter();
  const { isDark, language } = useApp();
  const { user, userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';

  const [availableOrders, setAvailableOrders] = useState<orderService.Order[]>([]);
  const [myOrders, setMyOrders] = useState<orderService.Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'available' | 'my-orders'>('available');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadOrders();
    
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      
      // Fetch available orders (pending status, no technician assigned)
      const available = await orderService.getAvailableOrders();
      setAvailableOrders(available || []);

      // Fetch technician's accepted orders
      if (user) {
        const myOrdersList = await orderService.getTechnicianOrders(user.id);
        setMyOrders(myOrdersList || []);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const handleAcceptOrder = async (orderId: string) => {
    if (!user) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'يجب تسجيل الدخول أولاً' : 'Please login first'
      );
      return;
    }

    try {
      await orderService.assignOrderToTechnician(orderId, user.id);
      await orderService.updateOrderStatus(orderId, 'accepted');
      
      Alert.alert(
        isRTL ? 'نجح!' : 'Success!',
        isRTL ? 'تم قبول الطلب بنجاح' : 'Order accepted successfully'
      );
      
      await loadOrders();
      
      // Navigate to order details
      router.push(`/(technician)/manage-order?id=${orderId}`);
    } catch (error) {
      console.error('Error accepting order:', error);
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'فشل قبول الطلب' : 'Failed to accept order'
      );
    }
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      pending: '#F59E0B',
      accepted: '#3B82F6',
      picking_up: '#8B5CF6',
      diagnosing: '#EC4899',
      repairing: '#10B981',
      delivering: '#06B6D4',
      completed: '#22C55E',
      cancelled: '#EF4444',
    };
    return colors[status] || '#6B7280';
  };

  const getStatusText = (status: string) => {
    const statusTexts: { [key: string]: { ar: string; en: string } } = {
      pending: { ar: 'قيد الانتظار', en: 'Pending' },
      accepted: { ar: 'مقبول', en: 'Accepted' },
      picking_up: { ar: 'جاري الاستلام', en: 'Picking Up' },
      diagnosing: { ar: 'جاري الفحص', en: 'Diagnosing' },
      repairing: { ar: 'جاري الإصلاح', en: 'Repairing' },
      delivering: { ar: 'جاري التوصيل', en: 'Delivering' },
      completed: { ar: 'مكتمل', en: 'Completed' },
      cancelled: { ar: 'ملغي', en: 'Cancelled' },
    };
    return isRTL ? statusTexts[status]?.ar : statusTexts[status]?.en;
  };

  const renderOrderCard = (order: orderService.Order, isAvailable: boolean = false) => (
    <TouchableOpacity
      key={order.id}
      style={[styles.orderCard, SHADOWS.neuFlat]}
      onPress={() => {
        if (isAvailable) {
          // Show order details before accepting
          Alert.alert(
            isRTL ? 'تفاصيل الطلب' : 'Order Details',
            `${order.device_brand} ${order.device_model}\n${order.issue_description || ''}\n\n${isRTL ? 'هل تريد قبول هذا الطلب؟' : 'Do you want to accept this order?'}`,
            [
              { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
              { text: isRTL ? 'قبول' : 'Accept', onPress: () => handleAcceptOrder(order.id) }
            ]
          );
        } else {
          router.push(`/(technician)/manage-order?id=${order.id}`);
        }
      }}
      activeOpacity={0.7}
    >
      <View style={styles.orderHeader}>
        <View style={styles.orderHeaderLeft}>
          <MaterialCommunityIcons 
            name={order.device_brand?.toLowerCase().includes('apple') ? 'apple' : 
                  order.device_brand?.toLowerCase().includes('samsung') ? 'android' : 
                  'cellphone'} 
            size={32} 
            color={COLORS.primary} 
          />
          <View style={styles.orderInfo}>
            <Text style={[styles.orderTitle, { color: COLORS.text }]}>
              {order.device_brand} {order.device_model}
            </Text>
            <Text style={[styles.orderSubtitle, { color: COLORS.textSecondary }]}>
              {order.issue_description || (isRTL ? 'لا يوجد وصف' : 'No description')}
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(order.status)}20` }]}>
          <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
            {getStatusText(order.status)}
          </Text>
        </View>
      </View>

      <View style={styles.orderDetails}>
        {order.address && (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={16} color={COLORS.textSecondary} />
            <Text style={[styles.detailText, { color: COLORS.textSecondary }]} numberOfLines={1}>
              {order.address}
            </Text>
          </View>
        )}
        
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color={COLORS.textSecondary} />
          <Text style={[styles.detailText, { color: COLORS.textSecondary }]}>
            {new Date(order.created_at || '').toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>

        {order.service_type && (
          <View style={styles.detailRow}>
            <MaterialCommunityIcons 
              name={order.service_type === 'mobile' ? 'account-wrench' : 'truck-delivery'} 
              size={16} 
              color={COLORS.textSecondary} 
            />
            <Text style={[styles.detailText, { color: COLORS.textSecondary }]}>
              {order.service_type === 'mobile' 
                ? (isRTL ? 'فني متنقل' : 'Mobile Service')
                : (isRTL ? 'استلام وتوصيل' : 'Pickup & Delivery')}
            </Text>
          </View>
        )}
      </View>

      {isAvailable && (
        <TouchableOpacity
          style={[styles.acceptButton, { backgroundColor: COLORS.primary }]}
          onPress={() => handleAcceptOrder(order.id)}
          activeOpacity={0.8}
        >
          <Text style={styles.acceptButtonText}>
            {isRTL ? 'قبول الطلب' : 'Accept Order'}
          </Text>
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons 
        name={activeTab === 'available' ? 'clipboard-search-outline' : 'clipboard-check-outline'} 
        size={80} 
        color={COLORS.border} 
      />
      <Text style={[styles.emptyTitle, { color: COLORS.text }]}>
        {activeTab === 'available'
          ? (isRTL ? 'لا توجد طلبات متاحة' : 'No Available Orders')
          : (isRTL ? 'لا توجد طلبات حالية' : 'No Current Orders')}
      </Text>
      <Text style={[styles.emptySubtitle, { color: COLORS.textSecondary }]}>
        {activeTab === 'available'
          ? (isRTL ? 'سيظهر هنا الطلبات الجديدة من العملاء' : 'New customer orders will appear here')
          : (isRTL ? 'الطلبات التي قبلتها ستظهر هنا' : 'Orders you accept will appear here')}
      </Text>
    </View>
  );

  const styles = createStyles(COLORS, SHADOWS, isRTL);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="wrench" size={28} color={COLORS.primary} />
          <View style={styles.headerTextContainer}>
            <Text style={[styles.headerTitle, { color: COLORS.text }]}>
              {isRTL ? 'مرحباً' : 'Welcome'}
            </Text>
            <Text style={[styles.headerSubtitle, { color: COLORS.textSecondary }]}>
              {userProfile?.name || (isRTL ? 'فني معتمد' : 'Certified Tech')}
            </Text>
          </View>
        </View>
        <TouchableOpacity 
          style={[styles.refreshButton, SHADOWS.neuSmall]}
          onPress={loadOrders}
        >
          <Ionicons name="refresh" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.statsContainer}
        contentContainerStyle={styles.statsContent}
      >
        <View style={[styles.statCard, SHADOWS.neuFlat, { backgroundColor: '#10B98120' }]}>
          <MaterialIcons name="attach-money" size={28} color="#10B981" />
          <Text style={[styles.statValue, { color: '#10B981' }]}>
            {isRTL ? '٠ ر.س' : '0 SAR'}
          </Text>
          <Text style={[styles.statLabel, { color: COLORS.textSecondary }]}>
            {isRTL ? 'أرباح اليوم' : "Today's Earnings"}
          </Text>
        </View>

        <View style={[styles.statCard, SHADOWS.neuFlat, { backgroundColor: '#3B82F620' }]}>
          <MaterialCommunityIcons name="clipboard-check" size={28} color="#3B82F6" />
          <Text style={[styles.statValue, { color: '#3B82F6' }]}>
            {myOrders.filter(o => o.status === 'completed').length}
          </Text>
          <Text style={[styles.statLabel, { color: COLORS.textSecondary }]}>
            {isRTL ? 'مكتملة' : 'Completed'}
          </Text>
        </View>

        <View style={[styles.statCard, SHADOWS.neuFlat, { backgroundColor: '#F59E0B20' }]}>
          <MaterialCommunityIcons name="clock-outline" size={28} color="#F59E0B" />
          <Text style={[styles.statValue, { color: '#F59E0B' }]}>
            {availableOrders.length}
          </Text>
          <Text style={[styles.statLabel, { color: COLORS.textSecondary }]}>
            {isRTL ? 'متاحة' : 'Available'}
          </Text>
        </View>
      </ScrollView>

      {/* Tabs */}
      <View style={[styles.tabsContainer, SHADOWS.neuFlat]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'available' && [styles.activeTab, { backgroundColor: COLORS.primary }]
          ]}
          onPress={() => setActiveTab('available')}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'available' ? '#fff' : COLORS.textSecondary }
          ]}>
            {isRTL ? `طلبات متاحة (${availableOrders.length})` : `Available (${availableOrders.length})`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'my-orders' && [styles.activeTab, { backgroundColor: COLORS.primary }]
          ]}
          onPress={() => setActiveTab('my-orders')}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'my-orders' ? '#fff' : COLORS.textSecondary }
          ]}>
            {isRTL ? `طلباتي (${myOrders.length})` : `My Orders (${myOrders.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Orders List */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={[styles.loadingText, { color: COLORS.textSecondary }]}>
              {isRTL ? 'جاري التحميل...' : 'Loading...'}
            </Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={COLORS.primary}
              />
            }
            contentContainerStyle={styles.scrollContent}
          >
            {activeTab === 'available' ? (
              availableOrders.length > 0 ? (
                availableOrders.map(order => renderOrderCard(order, true))
              ) : (
                renderEmptyState()
              )
            ) : (
              myOrders.length > 0 ? (
                myOrders.map(order => renderOrderCard(order, false))
              ) : (
                renderEmptyState()
              )
            )}
          </ScrollView>
        )}
      </Animated.View>

      <BottomNavTech currentRoute="index" />
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any, SHADOWS: any, isRTL: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerLeft: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerTextContainer: {
    alignItems: isRTL ? 'flex-end' : 'flex-start',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  statsContent: {
    gap: SPACING.md,
  },
  statCard: {
    width: 140,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
  },
  tabsContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    padding: 4,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
  },
  activeTab: {
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: 100,
  },
  orderCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  orderHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  orderHeaderLeft: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  orderInfo: {
    flex: 1,
    alignItems: isRTL ? 'flex-end' : 'flex-start',
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  orderSubtitle: {
    fontSize: 13,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  orderDetails: {
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  detailRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  detailText: {
    fontSize: 13,
    flex: 1,
  },
  acceptButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.xs,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl * 2,
    gap: SPACING.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
});
