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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';
import { supabase } from '../services/supabaseClient';

interface ReportData {
  ordersByStatus: Record<string, number>;
  ordersTotal: number;
  revenueCompleted: number;
  discountGiven: number;
  techApproved: number;
  techPending: number;
  techSuspended: number;
  usersTotal: number;
  usersCustomers: number;
  usersTechnicians: number;
  listingsByStatus: Record<string, number>;
  listingsTotal: number;
  discountCodes: { code: string; used: number; limit: number | null }[];
}

const STATUS_ORDER = [
  'pending', 'confirmed', 'accepted', 'picking_up', 'diagnosing', 'quoted',
  'awaiting_payment', 'waiting_parts', 'repairing', 'testing', 'delivering',
  'completed', 'cancelled',
];

const STATUS_LABEL = (s: string, isRTL: boolean): { label: string; color: string } => {
  const map: Record<string, { ar: string; en: string; color: string }> = {
    pending:         { ar: 'قيد الانتظار', en: 'Pending',        color: '#F59E0B' },
    confirmed:       { ar: 'مؤكد',          en: 'Confirmed',      color: '#3B82F6' },
    accepted:        { ar: 'مقبول',         en: 'Accepted',       color: '#3B82F6' },
    picking_up:      { ar: 'جاري الاستلام',  en: 'Picking up',     color: '#6366F1' },
    diagnosing:      { ar: 'جاري الفحص',     en: 'Diagnosing',     color: '#6366F1' },
    quoted:          { ar: 'عرض سعر',        en: 'Quoted',         color: '#8B5CF6' },
    awaiting_payment:{ ar: 'بانتظار الدفع',  en: 'Awaiting pay',   color: '#8B5CF6' },
    waiting_parts:   { ar: 'انتظار قطع',     en: 'Waiting parts',  color: '#8B5CF6' },
    repairing:       { ar: 'جاري الإصلاح',   en: 'Repairing',      color: '#6366F1' },
    testing:         { ar: 'اختبار',         en: 'Testing',        color: '#6366F1' },
    delivering:      { ar: 'جاري التوصيل',   en: 'Delivering',     color: '#06B6D4' },
    completed:       { ar: 'مكتمل',          en: 'Completed',      color: '#16A34A' },
    cancelled:       { ar: 'ملغي',           en: 'Cancelled',      color: '#DC2626' },
  };
  const m = map[s];
  return m ? { label: isRTL ? m.ar : m.en, color: m.color } : { label: s, color: '#8A94A3' };
};

export default function AdminReportsScreen() {
  const { language, isDark } = useApp();
  const { userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const styles = createStyles(COLORS, isRTL);

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const profileLoaded = userProfile !== null;
  const isAdmin = (userProfile as any)?.is_admin === true;

  const load = useCallback(async () => {
    try {
      const [
        ordersRes,
        techRes,
        usersRes,
        listingsRes,
        codesRes,
      ] = await Promise.all([
        supabase.from('orders')
          .select('status, final_price, estimated_price, discount_amount')
          .is('deleted_at', null),
        supabase.from('technicians')
          .select('verification_status, technician_status')
          .is('deleted_at', null),
        supabase.from('users')
          .select('role')
          .is('deleted_at', null),
        supabase.from('market_listings')
          .select('status'),
        supabase.from('discount_codes')
          .select('code, used_count, usage_limit')
          .order('used_count', { ascending: false }),
      ]);

      const orders = (ordersRes.data ?? []) as any[];
      const ordersByStatus: Record<string, number> = {};
      let revenueCompleted = 0;
      let discountGiven = 0;
      for (const o of orders) {
        ordersByStatus[o.status] = (ordersByStatus[o.status] ?? 0) + 1;
        if (o.status === 'completed') {
          revenueCompleted += Number(o.final_price ?? o.estimated_price ?? 0);
        }
        discountGiven += Number(o.discount_amount ?? 0);
      }

      const techs = (techRes.data ?? []) as any[];
      const techApproved = techs.filter((t) => t.verification_status === 'approved').length;
      const techPending = techs.filter((t) => t.verification_status === 'submitted').length;
      const techSuspended = techs.filter(
        (t) => t.technician_status === 'suspended' || t.technician_status === 'excluded'
      ).length;

      const users = (usersRes.data ?? []) as any[];
      const usersTechnicians = users.filter((u) => u.role === 'technician').length;
      const usersCustomers = users.filter((u) => u.role !== 'technician').length;

      const listings = (listingsRes.data ?? []) as any[];
      const listingsByStatus: Record<string, number> = {};
      for (const l of listings) {
        listingsByStatus[l.status] = (listingsByStatus[l.status] ?? 0) + 1;
      }

      const codes = ((codesRes.data ?? []) as any[])
        .map((c) => ({
          code: c.code as string,
          used: Number(c.used_count ?? 0),
          limit: c.usage_limit != null ? Number(c.usage_limit) : null,
        }))
        .filter((c) => c.used > 0)
        .slice(0, 12);

      setData({
        ordersByStatus,
        ordersTotal: orders.length,
        revenueCompleted,
        discountGiven,
        techApproved,
        techPending,
        techSuspended,
        usersTotal: users.length,
        usersCustomers,
        usersTechnicians,
        listingsByStatus,
        listingsTotal: listings.length,
        discountCodes: codes,
      });
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
          <Text style={styles.title}>{isRTL ? 'التقارير' : 'Reports'}</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.empty}>
          <MaterialCommunityIcons name="shield-alert-outline" size={64} color={COLORS.error} />
          <Text style={styles.emptyText}>{isRTL ? 'هذه الصفحة للأدمن فقط' : 'Admins only'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const fmt = (n: number) => Number(n).toLocaleString(isRTL ? 'ar-SA' : 'en-US');
  const sar = isRTL ? 'ر.س' : 'SAR';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack('/admin')} accessibilityRole="button">
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isRTL ? 'التقارير' : 'Reports'}</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
      ) : !data ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="chart-box-outline" size={56} color={COLORS.textSecondary} />
          <Text style={styles.emptyText}>{isRTL ? 'تعذّر تحميل التقارير' : 'Could not load reports'}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 48 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={COLORS.primary}
            />
          }
        >
          {/* Headline financials */}
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, { backgroundColor: COLORS.primary }]}>
              <Text style={styles.kpiLabel}>{isRTL ? 'الإيرادات (مكتملة)' : 'Revenue (completed)'}</Text>
              <Text style={styles.kpiValue}>{fmt(data.revenueCompleted)} {sar}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: '#0EA5A4' }]}>
              <Text style={styles.kpiLabel}>{isRTL ? 'إجمالي الطلبات' : 'Total orders'}</Text>
              <Text style={styles.kpiValue}>{fmt(data.ordersTotal)}</Text>
            </View>
          </View>

          {/* Orders by status */}
          <SectionTitle icon="clipboard-list-outline" text={isRTL ? 'الطلبات حسب الحالة' : 'Orders by status'} COLORS={COLORS} isRTL={isRTL} />
          <View style={styles.card}>
            {STATUS_ORDER.filter((s) => (data.ordersByStatus[s] ?? 0) > 0).length === 0 ? (
              <Text style={styles.muted}>{isRTL ? 'لا توجد طلبات' : 'No orders'}</Text>
            ) : (
              STATUS_ORDER.filter((s) => (data.ordersByStatus[s] ?? 0) > 0).map((s) => {
                const meta = STATUS_LABEL(s, isRTL);
                const count = data.ordersByStatus[s] ?? 0;
                const pct = data.ordersTotal > 0 ? Math.round((count / data.ordersTotal) * 100) : 0;
                return (
                  <View key={s} style={styles.barRow}>
                    <View style={styles.barLabelWrap}>
                      <View style={[styles.dot, { backgroundColor: meta.color }]} />
                      <Text style={styles.barLabel}>{meta.label}</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${Math.max(pct, 3)}%`, backgroundColor: meta.color }]} />
                    </View>
                    <Text style={styles.barCount}>{fmt(count)}</Text>
                  </View>
                );
              })
            )}
          </View>

          {/* Technicians */}
          <SectionTitle icon="account-wrench-outline" text={isRTL ? 'الفنيون' : 'Technicians'} COLORS={COLORS} isRTL={isRTL} />
          <View style={styles.statRow}>
            <MiniStat label={isRTL ? 'معتمدون' : 'Approved'} value={fmt(data.techApproved)} color="#16A34A" COLORS={COLORS} />
            <MiniStat label={isRTL ? 'قيد المراجعة' : 'Pending'} value={fmt(data.techPending)} color="#F59E0B" COLORS={COLORS} />
            <MiniStat label={isRTL ? 'موقوفون' : 'Suspended'} value={fmt(data.techSuspended)} color="#DC2626" COLORS={COLORS} />
          </View>

          {/* Users */}
          <SectionTitle icon="account-group-outline" text={isRTL ? 'المستخدمون' : 'Users'} COLORS={COLORS} isRTL={isRTL} />
          <View style={styles.statRow}>
            <MiniStat label={isRTL ? 'الإجمالي' : 'Total'} value={fmt(data.usersTotal)} color="#3B82F6" COLORS={COLORS} />
            <MiniStat label={isRTL ? 'عملاء' : 'Customers'} value={fmt(data.usersCustomers)} color="#10B981" COLORS={COLORS} />
            <MiniStat label={isRTL ? 'فنيون' : 'Technicians'} value={fmt(data.usersTechnicians)} color="#8B5CF6" COLORS={COLORS} />
          </View>

          {/* Marketplace */}
          <SectionTitle icon="storefront-outline" text={isRTL ? 'السوق' : 'Marketplace'} COLORS={COLORS} isRTL={isRTL} />
          <View style={styles.card}>
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>{isRTL ? 'إجمالي الإعلانات' : 'Total listings'}</Text>
              <Text style={styles.kvVal}>{fmt(data.listingsTotal)}</Text>
            </View>
            {Object.keys(data.listingsByStatus).length === 0 ? null : (
              Object.entries(data.listingsByStatus).map(([st, n]) => (
                <View key={st} style={styles.kvRow}>
                  <Text style={styles.kvKey}>{listingStatusLabel(st, isRTL)}</Text>
                  <Text style={styles.kvVal}>{fmt(n)}</Text>
                </View>
              ))
            )}
          </View>

          {/* Discounts */}
          <SectionTitle icon="ticket-percent-outline" text={isRTL ? 'استخدام الخصومات' : 'Discount usage'} COLORS={COLORS} isRTL={isRTL} />
          <View style={styles.card}>
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>{isRTL ? 'إجمالي الخصم الممنوح' : 'Total discount given'}</Text>
              <Text style={[styles.kvVal, { color: '#DC2626' }]}>{fmt(data.discountGiven)} {sar}</Text>
            </View>
            {data.discountCodes.length === 0 ? (
              <Text style={[styles.muted, { marginTop: 6 }]}>
                {isRTL ? 'لم يُستخدم أي كود بعد' : 'No codes used yet'}
              </Text>
            ) : (
              data.discountCodes.map((c) => (
                <View key={c.code} style={styles.kvRow}>
                  <Text style={styles.kvKey} numberOfLines={1}>{c.code}</Text>
                  <Text style={styles.kvVal}>
                    {fmt(c.used)}{c.limit != null ? ` / ${fmt(c.limit)}` : ''}
                  </Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function listingStatusLabel(s: string, isRTL: boolean): string {
  const map: Record<string, { ar: string; en: string }> = {
    pending:  { ar: 'قيد المراجعة', en: 'Pending' },
    approved: { ar: 'منشورة',       en: 'Approved' },
    active:   { ar: 'نشطة',         en: 'Active' },
    rejected: { ar: 'مرفوضة',       en: 'Rejected' },
    sold:     { ar: 'مباعة',        en: 'Sold' },
  };
  const m = map[s];
  return m ? (isRTL ? m.ar : m.en) : s;
}

function SectionTitle({ icon, text, COLORS, isRTL }: any) {
  return (
    <View style={{
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 22,
      marginBottom: 10,
    }}>
      <MaterialCommunityIcons name={icon} size={18} color={COLORS.textSecondary} />
      <Text style={{
        color: COLORS.textSecondary,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}>
        {text}
      </Text>
    </View>
  );
}

function MiniStat({ label, value, color, COLORS }: any) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: COLORS.card,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 12,
      alignItems: 'center',
    }}>
      <Text style={{ color, fontSize: 22, fontWeight: '900' }}>{value}</Text>
      <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 4, textAlign: 'center' }}>{label}</Text>
    </View>
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
    empty: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { color: C.text, fontWeight: '700', marginTop: 12 },
    kpiRow: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12 },
    kpiCard: {
      flex: 1,
      borderRadius: BORDER_RADIUS.md,
      padding: 16,
    },
    kpiLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700' },
    kpiValue: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 6 },
    card: {
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: C.border,
      padding: 14,
    },
    muted: { color: C.textSecondary, fontSize: 13 },
    barRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
      marginVertical: 5,
    },
    barLabelWrap: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      width: 116,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    barLabel: { color: C.text, fontSize: 12, fontWeight: '600', flex: 1, textAlign: isRTL ? 'right' : 'left' },
    barTrack: {
      flex: 1,
      height: 8,
      borderRadius: 4,
      backgroundColor: C.border,
      overflow: 'hidden',
    },
    barFill: { height: 8, borderRadius: 4 },
    barCount: { color: C.text, fontSize: 13, fontWeight: '800', width: 38, textAlign: isRTL ? 'left' : 'right' },
    statRow: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10 },
    kvRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 7,
      gap: 12,
    },
    kvKey: { color: C.textSecondary, fontSize: 13, flex: 1, textAlign: isRTL ? 'right' : 'left' },
    kvVal: { color: C.text, fontSize: 14, fontWeight: '800' },
  });
