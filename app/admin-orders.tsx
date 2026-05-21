import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';
import { supabase } from '../services/supabaseClient';

interface AdminOrder {
  id: string;
  device_brand: string;
  device_model: string;
  status: string;
  estimated_price?: number | null;
  final_price?: number | null;
  customer_phone?: string | null;
  created_at?: string | null;
}

type FilterKey = 'all' | 'pending' | 'active' | 'completed' | 'cancelled';

const STATUS_META = (s: string, isRTL: boolean): { label: string; color: string } => {
  const map: Record<string, { ar: string; en: string; color: string }> = {
    pending:       { ar: 'قيد الانتظار', en: 'Pending',     color: '#F59E0B' },
    confirmed:     { ar: 'مؤكد',         en: 'Confirmed',   color: '#3B82F6' },
    accepted:      { ar: 'مقبول',        en: 'Accepted',    color: '#3B82F6' },
    picking_up:    { ar: 'جاري الاستلام', en: 'Picking up', color: '#6366F1' },
    diagnosing:    { ar: 'جاري الفحص',   en: 'Diagnosing',  color: '#6366F1' },
    quoted:        { ar: 'عرض سعر',      en: 'Quoted',      color: '#8B5CF6' },
    waiting_parts: { ar: 'انتظار قطع',   en: 'Waiting parts', color: '#8B5CF6' },
    repairing:     { ar: 'جاري الإصلاح', en: 'Repairing',   color: '#6366F1' },
    testing:       { ar: 'اختبار',       en: 'Testing',     color: '#6366F1' },
    delivering:    { ar: 'جاري التوصيل', en: 'Delivering',  color: '#06B6D4' },
    completed:     { ar: 'مكتمل',        en: 'Completed',   color: '#16A34A' },
    cancelled:     { ar: 'ملغي',         en: 'Cancelled',   color: '#DC2626' },
  };
  const m = map[s];
  return m ? { label: isRTL ? m.ar : m.en, color: m.color } : { label: s, color: '#8A94A3' };
};

const TERMINAL = ['completed', 'cancelled'];

export default function AdminOrdersScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');

  const profileLoaded = userProfile !== null;
  const isAdmin = (userProfile as any)?.is_admin === true;

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, device_brand, device_model, status, estimated_price, final_price, customer_phone, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(150);
      if (error) throw error;
      setOrders((data ?? []) as AdminOrder[]);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (profileLoaded && isAdmin) load();
  }, [profileLoaded, isAdmin, load]);

  const styles = createStyles(COLORS, isRTL);

  const visible = orders.filter((o) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return o.status === 'pending';
    if (filter === 'completed') return o.status === 'completed';
    if (filter === 'cancelled') return o.status === 'cancelled';
    return !TERMINAL.includes(o.status) && o.status !== 'pending';
  });

  if (!profileLoaded) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => safeBack('/admin')}>
            <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{isRTL ? 'الطلبات' : 'Orders'}</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.empty}>
          <MaterialCommunityIcons name="shield-alert-outline" size={64} color={COLORS.error} />
          <Text style={{ color: COLORS.text, fontWeight: '700', marginTop: 12 }}>
            {isRTL ? 'هذه الصفحة للأدمن فقط' : 'Admins only'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const FILTERS: { key: FilterKey; ar: string; en: string }[] = [
    { key: 'all', ar: 'الكل', en: 'All' },
    { key: 'pending', ar: 'قيد الانتظار', en: 'Pending' },
    { key: 'active', ar: 'قيد التنفيذ', en: 'In progress' },
    { key: 'completed', ar: 'مكتملة', en: 'Completed' },
    { key: 'cancelled', ar: 'ملغاة', en: 'Cancelled' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack('/admin')} accessibilityRole="button">
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isRTL ? 'إدارة الطلبات' : 'Orders Management'}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={{ maxHeight: 52 }}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.filterChip, active && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
            >
              <Text style={[styles.filterChipText, active && { color: '#fff' }]}>
                {isRTL ? f.ar : f.en}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={COLORS.primary}
          />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : visible.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={56} color={COLORS.textSecondary} />
            <Text style={{ color: COLORS.text, fontWeight: '700', marginTop: 12 }}>
              {isRTL ? 'لا توجد طلبات' : 'No orders'}
            </Text>
          </View>
        ) : (
          visible.map((o) => {
            const status = STATUS_META(o.status, isRTL);
            const price = o.final_price ?? o.estimated_price ?? 0;
            return (
              <TouchableOpacity
                key={o.id}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => router.push({ pathname: '/order-details', params: { id: o.id } })}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.device} numberOfLines={1}>
                    {[o.device_brand, o.device_model].filter(Boolean).join(' ') || (isRTL ? 'طلب' : 'Order')}
                  </Text>
                  <View style={[styles.statusPill, { backgroundColor: status.color + '20' }]}>
                    <Text style={[styles.statusPillText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>
                <View style={styles.cardBottom}>
                  <Text style={styles.meta}>
                    {o.customer_phone || '—'}
                  </Text>
                  <Text style={styles.price}>
                    {Number(price).toLocaleString(isRTL ? 'ar-SA' : 'en-US')} {isRTL ? 'ر.س' : 'SAR'}
                  </Text>
                </View>
                {o.created_at && (
                  <Text style={styles.date}>
                    {new Date(o.created_at).toLocaleDateString(isRTL ? 'ar-SA' : 'en-GB')}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.m,
      paddingVertical: SPACING.m,
    },
    title: { fontSize: 20, fontWeight: '800', color: C.text },
    filterRow: { paddingHorizontal: SPACING.lg, gap: 8, alignItems: 'center' },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
    },
    filterChipText: { color: C.text, fontWeight: '700', fontSize: 13 },
    card: {
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: C.border,
      padding: 14,
      marginBottom: 12,
    },
    cardTop: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    device: { color: C.text, fontWeight: '800', fontSize: 15, flex: 1 },
    statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    statusPillText: { fontSize: 11, fontWeight: '800' },
    cardBottom: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    meta: { color: C.textSecondary, fontSize: 13 },
    price: { color: C.primary, fontWeight: '800', fontSize: 14 },
    date: { color: C.textLight, fontSize: 11, marginTop: 6, textAlign: isRTL ? 'right' : 'left' },
    empty: { alignItems: 'center', paddingVertical: 60 },
  });
