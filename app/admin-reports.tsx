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
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';
import { supabase } from '../services/supabaseClient';

// Selectable reporting windows. Time-bound metrics (orders, revenue,
// discounts) respect this; cumulative snapshots (users, technicians) do not.
type RangeKey = '7d' | '30d' | 'month' | 'all';
const RANGES: { key: RangeKey; ar: string; en: string }[] = [
  { key: '7d', ar: 'آخر ٧ أيام', en: 'Last 7 days' },
  { key: '30d', ar: 'آخر ٣٠ يوم', en: 'Last 30 days' },
  { key: 'month', ar: 'هذا الشهر', en: 'This month' },
  { key: 'all', ar: 'كل الوقت', en: 'All time' },
];

const rangeSince = (key: RangeKey): string | null => {
  const now = new Date();
  if (key === '7d') return new Date(now.getTime() - 7 * 86400000).toISOString();
  if (key === '30d') return new Date(now.getTime() - 30 * 86400000).toISOString();
  if (key === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return null;
};

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
  const [range, setRange] = useState<RangeKey>('30d');
  const [exporting, setExporting] = useState(false);

  const profileLoaded = userProfile !== null;
  const isAdmin = (userProfile as any)?.is_admin === true;

  const load = useCallback(async () => {
    try {
      const since = rangeSince(range);
      let ordersQuery = supabase
        .from('orders')
        .select('status, final_price, estimated_price, discount_amount')
        .is('deleted_at', null);
      if (since) ordersQuery = ordersQuery.gte('created_at', since);
      const [
        ordersRes,
        techRes,
        usersRes,
        listingsRes,
        codesRes,
      ] = await Promise.all([
        ordersQuery,
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
  }, [range]);

  // Build a CSV of the current report and hand it to the OS share sheet.
  // CSV opens directly in Excel / Numbers / Google Sheets.
  const exportCsv = async () => {
    if (!data || exporting) return;
    setExporting(true);
    try {
      const rangeLabel = RANGES.find((r) => r.key === range)?.en ?? range;
      const rows: string[][] = [
        ['Fixate — Operations Report'],
        ['Range', rangeLabel],
        ['Generated', new Date().toISOString()],
        [],
        ['Metric', 'Value'],
        ['Revenue (completed)', String(data.revenueCompleted)],
        ['Total orders', String(data.ordersTotal)],
        ['Discount given', String(data.discountGiven)],
        [],
        ['Orders by status', 'Count'],
        ...STATUS_ORDER
          .filter((s) => (data.ordersByStatus[s] ?? 0) > 0)
          .map((s) => [s, String(data.ordersByStatus[s] ?? 0)]),
        [],
        ['Technicians', 'Count'],
        ['Approved', String(data.techApproved)],
        ['Pending', String(data.techPending)],
        ['Suspended', String(data.techSuspended)],
        [],
        ['Users', 'Count'],
        ['Total', String(data.usersTotal)],
        ['Customers', String(data.usersCustomers)],
        ['Technicians', String(data.usersTechnicians)],
        [],
        ['Marketplace listings', 'Count'],
        ['Total', String(data.listingsTotal)],
        ...Object.entries(data.listingsByStatus).map(([k, v]) => [k, String(v)]),
        [],
        ['Discount code', 'Used'],
        ...data.discountCodes.map((c) => [c.code, String(c.used)]),
      ];
      const csv = rows
        .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const fileUri = `${FileSystem.documentDirectory}fixate-report-${range}-${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: isRTL ? 'تصدير التقرير' : 'Export report',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert(
          isRTL ? 'غير متاح' : 'Unavailable',
          isRTL ? 'المشاركة غير متاحة على هذا الجهاز.' : 'Sharing is not available on this device.'
        );
      }
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
    } finally {
      setExporting(false);
    }
  };

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
        <TouchableOpacity
          onPress={exportCsv}
          disabled={!data || exporting}
          style={{ opacity: !data || exporting ? 0.4 : 1, padding: 4 }}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'تصدير Excel' : 'Export Excel'}
        >
          {exporting ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <MaterialCommunityIcons name="file-export-outline" size={24} color={COLORS.primary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rangeRow}
        style={{ maxHeight: 52 }}
      >
        {RANGES.map((r) => {
          const active = range === r.key;
          return (
            <TouchableOpacity
              key={r.key}
              onPress={() => setRange(r.key)}
              style={[styles.rangeChip, active && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
            >
              <Text style={[styles.rangeChipText, active && { color: '#fff' }]}>
                {isRTL ? r.ar : r.en}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

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
    rangeRow: { paddingHorizontal: SPACING.lg, gap: 8, alignItems: 'center', paddingBottom: 4 },
    rangeChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
    },
    rangeChipText: { color: C.text, fontWeight: '700', fontSize: 13 },
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
