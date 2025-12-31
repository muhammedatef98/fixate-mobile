import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, StatusBar, Animated, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import { requests, auth } from '../../lib/supabase-api';
import BottomNav from '../../components/BottomNav';

export default function OrdersScreen() {
  const router = useRouter();
  const { language } = useApp();
  const isRTL = language === 'ar';
  
  const COLORS = {
    primary: '#10b981',
    background: '#f9fafb',
    card: '#ffffff',
    text: '#1f2937',
    textSecondary: '#6b7280',
    border: '#e5e7eb',
    white: '#ffffff',
    warning: '#f59e0b',
    info: '#3b82f6',
    success: '#10b981',
  };

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    loadOrders();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [filter]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const currentUser = await auth.getCurrentUser();
      if (!currentUser) {
        setOrders([]);
        setLoading(false);
        return;
      }
      const data = await requests.getUserOrders();
      let filteredData = data;
      if (filter === 'active') {
        filteredData = data.filter((o: any) => ['pending', 'confirmed', 'in_progress'].includes(o.status));
      } else if (filter === 'completed') {
        filteredData = data.filter((o: any) => ['completed', 'cancelled'].includes(o.status));
      }
      setOrders(filteredData);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending': return { label: isRTL ? 'قيد الانتظار' : 'Pending', color: COLORS.warning, icon: 'time-outline' };
      case 'confirmed': return { label: isRTL ? 'مؤكد' : 'Confirmed', color: COLORS.info, icon: 'checkmark-circle-outline' };
      case 'in_progress': return { label: isRTL ? 'جاري الإصلاح' : 'Repairing', color: COLORS.primary, icon: 'construct-outline' };
      case 'completed': return { label: isRTL ? 'مكتمل' : 'Completed', color: COLORS.success, icon: 'checkbox-outline' };
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
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
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
                    <View style={styles.deviceInfo}>
                      <View style={styles.deviceIcon}>
                        <MaterialCommunityIcons name="cellphone" size={24} color={COLORS.primary} />
                      </View>
                      <View>
                        <Text style={styles.deviceName}>{order.device_brand} {order.device_model}</Text>
                        <Text style={styles.orderDate}>{new Date(order.created_at).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}</Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: status.color + '15' }]}>
                      <Ionicons name={status.icon as any} size={14} color={status.color} />
                      <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
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
  orderCard: { backgroundColor: COLORS.white, borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  orderHeader: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  deviceInfo: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 },
  deviceIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#f9fafb', justifyContent: 'center', alignItems: 'center' },
  deviceName: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  orderDate: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  statusBadge: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  orderBody: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f9fafb', borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  issueText: { fontSize: 14, color: COLORS.text, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' },
  priceRow: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 13, color: COLORS.textSecondary },
  priceValue: { fontSize: 15, fontWeight: 'bold', color: COLORS.primary },
  orderFooter: { marginTop: 12, alignItems: isRTL ? 'flex-start' : 'flex-end' },
  detailsBtn: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 },
  detailsBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
});
