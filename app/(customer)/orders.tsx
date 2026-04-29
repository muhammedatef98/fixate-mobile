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
import { getColors } from '../../constants/theme';
import { getFriendlyError } from '../../utils/errorMessages';

export default function OrdersScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const isRTL = language === 'ar';
  const themeColors = getColors(isDark);

  const COLORS = {
    primary: themeColors.primary,
    background: themeColors.background,
    card: themeColors.card,
    text: themeColors.text,
    textSecondary: themeColors.textSecondary,
    border: themeColors.border,
    white: themeColors.card,
    warning: themeColors.warning,
    info: themeColors.info,
    success: themeColors.success,
    error: themeColors.error,
  };

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    loadOrders();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [filter]);

  // Refresh when screen comes into focus
  useEffect(() => {
    const interval = setInterval(loadOrders, 5000); // Poll every 5 seconds for real-time feel
    return () => clearInterval(interval);
  }, []);

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
          ['pending', 'accepted', 'picking_up', 'diagnosing', 'repairing', 'delivering'].includes(o.status)
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
      case 'repairing': return { label: isRTL ? 'قيد الإصلاح' : 'Repairing', color: COLORS.primary, icon: 'construct-outline' };
      case 'delivering': return { label: isRTL ? 'قيد التسليم' : 'Delivering', color: COLORS.info, icon: 'cube-outline' };
      case 'completed': return { label: isRTL ? 'مكتمل' : 'Completed', color: COLORS.success, icon: 'checkbox-outline' };
      case 'cancelled': return { label: isRTL ? 'ملغي' : 'Cancelled', color: COLORS.error, icon: 'close-circle-outline' };
      default: return { label: status, color: COLORS.textSecondary, icon: 'help-circle-outline' };
    }
  };

  const styles = createStyles(COLORS, isRTL);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      
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
            <Ionicons name="receipt-outline" size={80} color={COLORS.border} />
            <Text style={styles.emptyText}>{isRTL ? 'لا توجد طلبات حالياً' : 'No orders found'}</Text>
            <TouchableOpacity 
              style={styles.loginPromptBtn} 
              onPress={() => router.push('/login')}
            >
              <Text style={styles.loginPromptText}>{isRTL ? 'سجل الدخول لمتابعة طلباتك' : 'Login to track your orders'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            {orders.map((order) => {
              const status = getStatusInfo(order.status);
              return (
                <TouchableOpacity key={order.id} style={styles.orderCard} onPress={() => router.push(`/order-details?id=${order.id}`)}>
                  <View style={styles.orderHeader}>
                    <View style={[styles.statusBadge, { backgroundColor: status.color + '15' }]}>
                      <Ionicons name={status.icon as any} size={12} color={status.color} />
                      <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                    </View>
                    <View style={styles.deviceInfo}>
                      <View style={styles.deviceIcon}>
                        <MaterialCommunityIcons name="cellphone" size={26} color={COLORS.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.deviceName} numberOfLines={1}>{order.device_brand} {order.device_model}</Text>
                        <Text style={styles.orderDate}>{new Date(order.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</Text>
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.orderBody}>
                    <Text style={styles.issueText} numberOfLines={1}>{order.issue_description || (isRTL ? 'فحص عام' : 'General Check')}</Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>{isRTL ? 'السعر التقديري:' : 'Est. Price:'}</Text>
                      <Text style={styles.priceValue}>{order.estimated_price} {isRTL ? 'ر.س' : 'SAR'}</Text>
                    </View>
                  </View>

                  <View style={styles.orderFooter}>
                    <TouchableOpacity style={styles.detailsBtn} onPress={() => router.push(`/order-details?id=${order.id}`)}>
                      <Text style={styles.detailsBtnText}>{isRTL ? 'عرض التفاصيل' : 'View Details'}</Text>
                      <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={16} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any, isRTL: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { height: 60, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  filterBar: { flexDirection: isRTL ? 'row-reverse' : 'row', padding: 12, backgroundColor: COLORS.white, gap: 8 },
  filterTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 12, backgroundColor: '#f3f4f6' },
  activeFilterTab: { backgroundColor: COLORS.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  activeFilterText: { color: COLORS.white },
  scrollContent: { padding: 16 },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary, marginTop: 16, marginBottom: 20 },
  loginPromptBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  loginPromptText: { color: COLORS.white, fontWeight: 'bold', fontSize: 14 },
  orderCard: { backgroundColor: COLORS.white, borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  orderHeader: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  deviceInfo: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12, flex: 1 },
  deviceIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#f0fdf4', justifyContent: 'center', alignItems: 'center' },
  deviceName: { fontSize: 15, fontWeight: 'bold', color: COLORS.text, flexShrink: 1 },
  orderDate: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  statusBadge: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, position: 'absolute', top: -8, [isRTL ? 'left' : 'right']: 0 },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  orderBody: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  issueText: { fontSize: 14, color: COLORS.text, marginBottom: 12, textAlign: isRTL ? 'right' : 'left', fontWeight: '500' },
  priceRow: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 13, color: COLORS.textSecondary },
  priceValue: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary },
  orderFooter: { marginTop: 12, flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailsBtn: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  detailsBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
});
