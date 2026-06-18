import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Modal,
  TextInput,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Quick, soft expand/collapse for accordions and section toggles. Spring-y
// enough to feel alive but capped at ~180ms so it never blocks the next tap.
const SOFT_LAYOUT = {
  duration: 180,
  create:  { type: 'easeInEaseOut' as const, property: 'opacity' as const },
  update:  { type: 'spring' as const, springDamping: 0.85 },
  delete:  { type: 'easeInEaseOut' as const, property: 'opacity' as const },
};
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  exportReportXlsx,
  type ExportOrderRow,
  type ExportTechnicianRow,
  type ExportMarketRow,
} from '../services/reportExportService';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useIsAdmin } from '../hooks/useAdminGuard';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';
import { AnimatedBackButton } from '../components/AnimatedBackButton';
import { AdminFilterChips, type AdminFilterChip } from '../components/admin/AdminUI';
import { supabase } from '../services/supabaseClient';

// Selectable reporting windows. Time-bound metrics (orders, revenue,
// discounts) respect this; cumulative snapshots (users, technicians) do not.
// FEAT-10 — range options aligned with the admin-orders filter bar:
// Today / This week / This month / This year / Custom.
type RangeKey = 'today' | 'week' | 'month' | 'year' | 'custom';
const RANGES: { key: RangeKey; ar: string; en: string }[] = [
  { key: 'today', ar: 'اليوم', en: 'Today' },
  { key: 'week', ar: 'هذا الأسبوع', en: 'This week' },
  { key: 'month', ar: 'هذا الشهر', en: 'This month' },
  { key: 'year', ar: 'هذا العام', en: 'This year' },
  { key: 'custom', ar: 'مخصص', en: 'Custom' },
];

const rangeSince = (key: RangeKey, customFromIso?: string | null): string | null => {
  const now = new Date();
  if (key === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (key === 'week') return new Date(now.getTime() - 7 * 86400000).toISOString();
  if (key === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  if (key === 'year') return new Date(now.getFullYear(), 0, 1).toISOString();
  if (key === 'custom') return customFromIso ?? null;
  return null;
};

const rangeUntil = (key: RangeKey, customToIso?: string | null): string | null => {
  if (key !== 'custom') return null;
  return customToIso ?? null;
};

// Default custom range: last 30 days, end-of-today.
const todayIso = (): string => new Date().toISOString().slice(0, 10);
const daysAgoIso = (n: number): string =>
  new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

interface BreakdownRow {
  key: string;
  label: string;
  count: number;
  total: number;
}

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
  // New KPI extensions
  avgOrderValue: number;
  topTechnician: { name: string; count: number } | null;
  // New breakdown tables
  byCity: BreakdownRow[];
  byCategory: BreakdownRow[];
  byTechnician: BreakdownRow[];
  // Raw orders kept in memory for Excel export — bounded by the date range.
  rawOrders: any[];
  rawListings: any[];
  rangeFromIso: string;
  rangeToIso: string;
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
    awaiting_payment:{ ar: 'بإنتظار الدفع',  en: 'Awaiting pay',   color: '#8B5CF6' },
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
  const [range, setRange] = useState<RangeKey>('month');
  const [exporting, setExporting] = useState(false);
  const [customFrom, setCustomFrom] = useState<string>(daysAgoIso(30));
  const [customTo, setCustomTo] = useState<string>(todayIso());
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [expandedBreakdown, setExpandedBreakdown] = useState<
    'city' | 'category' | 'technician' | null
  >('city');

  const profileLoaded = userProfile !== null;
  const { isAdmin } = useIsAdmin();

  const load = useCallback(async () => {
    try {
      const since = rangeSince(range, customFrom ? `${customFrom}T00:00:00.000Z` : null);
      const until = rangeUntil(range, customTo ? `${customTo}T23:59:59.999Z` : null);
      // Full-row orders query — used both for aggregates and for the
      // Excel export's Orders sheet. We `select('*')` because the orders
      // schema isn't reflected in TS here and we'd rather pluck fields
      // defensively than break on a missing column.
      let ordersQuery = supabase
        .from('orders')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (since) ordersQuery = ordersQuery.gte('created_at', since);
      if (until) ordersQuery = ordersQuery.lte('created_at', until);
      const [
        ordersRes,
        techRes,
        usersRes,
        listingsRes,
        codesRes,
      ] = await Promise.all([
        ordersQuery,
        supabase.from('technicians')
          .select('verification_status, technician_status, user_id')
          .is('deleted_at', null),
        supabase.from('users')
          .select('id, name, phone, role')
          .is('deleted_at', null),
        supabase.from('market_listings')
          .select('status, category'),
        supabase.from('discount_codes')
          .select('code, used_count, usage_limit')
          .order('used_count', { ascending: false }),
      ]);

      const orders = (ordersRes.data ?? []) as any[];
      const ordersByStatus: Record<string, number> = {};
      let revenueCompleted = 0;
      let discountGiven = 0;
      let completedCount = 0;
      // Breakdown accumulators keyed by the chosen grouping.
      const byCityMap: Record<string, { count: number; total: number }> = {};
      const byCategoryMap: Record<string, { count: number; total: number }> = {};
      const byTechnicianMap: Record<string, { count: number; total: number }> = {};
      const pickPrice = (o: any): number =>
        Number(o.final_price ?? o.estimated_price ?? 0);
      const pickCity = (o: any): string =>
        (o.delivery_area ?? o.city ?? o.delivery_city ?? '—') as string;
      const pickCategory = (o: any): string =>
        (o.service_id ?? o.service_type ?? o.category ?? o.device_brand ?? '—') as string;
      for (const o of orders) {
        ordersByStatus[o.status] = (ordersByStatus[o.status] ?? 0) + 1;
        const price = pickPrice(o);
        if (o.status === 'completed') {
          revenueCompleted += price;
          completedCount += 1;
        }
        discountGiven += Number(o.discount_amount ?? 0);
        // City
        const cityKey = String(pickCity(o));
        const cityRow = byCityMap[cityKey] ?? { count: 0, total: 0 };
        cityRow.count += 1;
        cityRow.total += price;
        byCityMap[cityKey] = cityRow;
        // Category
        const catKey = String(pickCategory(o));
        const catRow = byCategoryMap[catKey] ?? { count: 0, total: 0 };
        catRow.count += 1;
        catRow.total += price;
        byCategoryMap[catKey] = catRow;
        // Technician — count completed orders per technician + their earnings
        if (o.technician_id) {
          const tKey = String(o.technician_id);
          const tRow = byTechnicianMap[tKey] ?? { count: 0, total: 0 };
          if (o.status === 'completed') {
            tRow.count += 1;
            tRow.total += price;
          }
          byTechnicianMap[tKey] = tRow;
        }
      }
      const avgOrderValue = completedCount > 0 ? revenueCompleted / completedCount : 0;

      const techs = (techRes.data ?? []) as any[];
      const techApproved = techs.filter((t) => t.verification_status === 'approved').length;
      const techPending = techs.filter((t) => t.verification_status === 'submitted').length;
      const techSuspended = techs.filter(
        (t) => t.technician_status === 'suspended' || t.technician_status === 'excluded'
      ).length;

      const users = (usersRes.data ?? []) as any[];
      const usersTechnicians = users.filter((u) => u.role === 'technician').length;
      const usersCustomers = users.filter((u) => u.role !== 'technician').length;
      const userById: Record<string, { name: string; phone: string }> = {};
      for (const u of users) {
        userById[u.id] = { name: u.name ?? '', phone: u.phone ?? '' };
      }
      // technicians.user_id -> users.name; some deployments use technician_id
      // == users.id directly, so we fall back to that.
      const techUserById: Record<string, string> = {};
      for (const t of (techRes.data ?? []) as any[]) {
        if (t.user_id && userById[t.user_id]) techUserById[t.user_id] = userById[t.user_id].name;
      }
      const resolveTechName = (technicianId: string): string => {
        // Try direct user lookup (common case where technician_id == user id).
        if (userById[technicianId]?.name) return userById[technicianId].name;
        if (techUserById[technicianId]) return techUserById[technicianId];
        return technicianId.slice(0, 8);
      };

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

      const toBreakdownRows = (
        map: Record<string, { count: number; total: number }>,
        label: (k: string) => string
      ): BreakdownRow[] =>
        Object.entries(map)
          .map(([k, v]) => ({ key: k, label: label(k), count: v.count, total: v.total }))
          .sort((a, b) => b.count - a.count);

      const byCity = toBreakdownRows(byCityMap, (k) => k);
      const byCategory = toBreakdownRows(byCategoryMap, (k) => k);
      const byTechnician = toBreakdownRows(byTechnicianMap, (k) => resolveTechName(k));

      const topTechnician =
        byTechnician.length > 0
          ? { name: byTechnician[0].label, count: byTechnician[0].count }
          : null;

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
        avgOrderValue,
        topTechnician,
        byCity,
        byCategory,
        byTechnician,
        rawOrders: orders,
        rawListings: listings,
        rangeFromIso: since ?? '',
        rangeToIso: until ?? new Date().toISOString(),
      });
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range, customFrom, customTo]);

  // Build a multi-sheet Excel workbook and hand it to the OS share sheet.
  const exportExcel = async () => {
    if (!data || exporting) return;
    setExporting(true);
    try {
      // Map raw orders → flat rows for the Orders sheet, plucking fields
      // defensively (schema isn't guaranteed across deployments).
      const orderRows: ExportOrderRow[] = data.rawOrders.map((o: any) => ({
        id: String(o.id ?? ''),
        customer: String(o.customer_name ?? o.customer_id ?? ''),
        device: [o.device_brand, o.device_model].filter(Boolean).join(' '),
        issue: String(o.issue_description ?? o.issue ?? ''),
        status: String(o.status ?? ''),
        city: String(o.delivery_area ?? o.city ?? o.delivery_city ?? ''),
        delivery_fee: Number(o.delivery_fee ?? 0),
        estimated_price: Number(o.final_price ?? o.estimated_price ?? 0),
        created_at: String(o.created_at ?? ''),
      }));
      const technicianRows: ExportTechnicianRow[] = data.byTechnician.map((t) => ({
        name: t.label,
        completed_orders: t.count,
        total_earned: t.total,
      }));
      // Market sheet: cross category + status counts.
      const marketCounts: Record<string, number> = {};
      for (const l of data.rawListings as any[]) {
        const key = `${l.category ?? '—'}||${l.status ?? '—'}`;
        marketCounts[key] = (marketCounts[key] ?? 0) + 1;
      }
      const marketRows: ExportMarketRow[] = Object.entries(marketCounts).map(([k, v]) => {
        const [category, status] = k.split('||');
        return { category, status, count: v };
      });
      await exportReportXlsx({
        isRTL,
        summary: {
          rangeFromIso: data.rangeFromIso,
          rangeToIso: data.rangeToIso,
          revenueCompleted: data.revenueCompleted,
          totalOrders: data.ordersTotal,
          avgOrderValue: data.avgOrderValue,
          topTechnicianName: data.topTechnician?.name ?? '',
          topTechnicianCount: data.topTechnician?.count ?? 0,
        },
        orders: orderRows,
        technicians: technicianRows,
        market: marketRows,
      });
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
          <AnimatedBackButton
            onPress={() => safeBack('/admin')}
            color={COLORS.text}
            backgroundColor={COLORS.surface ?? COLORS.background}
            size={42}
            iconSize={22}
            rtl
            accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
          />
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
        <AnimatedBackButton
          onPress={() => safeBack('/admin')}
          color={COLORS.text}
          backgroundColor={COLORS.surface ?? COLORS.background}
          size={42}
          iconSize={22}
          rtl
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
        />
        <Text style={styles.title}>{isRTL ? 'التقارير' : 'Reports'}</Text>
        <TouchableOpacity
          onPress={exportExcel}
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

      {/* FEAT-04 — identical pill/chip bar to the order-management screen.
          Tapping "Custom" still opens the date-range modal. */}
      <AdminFilterChips<RangeKey>
        filters={RANGES as AdminFilterChip<RangeKey>[]}
        value={range}
        onChange={(k) => {
          setRange(k);
          if (k === 'custom') setCustomModalOpen(true);
        }}
      />

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
          {/* Headline KPIs — horizontal scroller. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingVertical: 2 }}
          >
            <View style={[styles.kpiCard, { backgroundColor: COLORS.primary, minWidth: 200 }]}>
              <View style={styles.kpiIconWrap}>
                <MaterialCommunityIcons name="cash-multiple" size={22} color="#fff" />
              </View>
              <Text style={styles.kpiLabel}>{isRTL ? 'إجمالي الإيرادات' : 'Total Revenue'}</Text>
              <Text style={styles.kpiValue}>{fmt(data.revenueCompleted)} {sar}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: '#0EA5A4', minWidth: 180 }]}>
              <View style={styles.kpiIconWrap}>
                <MaterialCommunityIcons name="clipboard-text-multiple-outline" size={22} color="#fff" />
              </View>
              <Text style={styles.kpiLabel}>{isRTL ? 'إجمالي الطلبات' : 'Total Orders'}</Text>
              <Text style={styles.kpiValue}>{fmt(data.ordersTotal)}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: '#6366F1', minWidth: 200 }]}>
              <View style={styles.kpiIconWrap}>
                <MaterialCommunityIcons name="chart-line-variant" size={22} color="#fff" />
              </View>
              <Text style={styles.kpiLabel}>{isRTL ? 'متوسط قيمة الطلب' : 'Avg Order Value'}</Text>
              <Text style={styles.kpiValue}>{fmt(Math.round(data.avgOrderValue))} {sar}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: '#F59E0B', minWidth: 220 }]}>
              <View style={styles.kpiIconWrap}>
                <MaterialCommunityIcons name="trophy-outline" size={22} color="#fff" />
              </View>
              <Text style={styles.kpiLabel}>{isRTL ? 'أفضل فني' : 'Top Technician'}</Text>
              <Text style={[styles.kpiValue, { fontSize: 18 }]} numberOfLines={1}>
                {data.topTechnician?.name ?? '—'}
              </Text>
              <Text style={[styles.kpiLabel, { marginTop: 2 }]}>
                {data.topTechnician ? `${fmt(data.topTechnician.count)} ${isRTL ? 'طلب' : 'orders'}` : ''}
              </Text>
            </View>
          </ScrollView>

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

          {/* Breakdown tables — collapsible. Only one open at a time
              keeps the screen short on small devices. */}
          <SectionTitle icon="table" text={isRTL ? 'التفصيلات' : 'Breakdowns'} COLORS={COLORS} isRTL={isRTL} />
          <BreakdownAccordion
            label={isRTL ? 'بالمدينة' : 'By City'}
            icon="map-marker-outline"
            rows={data.byCity}
            isOpen={expandedBreakdown === 'city'}
            onToggle={() => {
              LayoutAnimation.configureNext(SOFT_LAYOUT);
              setExpandedBreakdown((p) => (p === 'city' ? null : 'city'));
            }}
            COLORS={COLORS}
            isRTL={isRTL}
            showTotal
            sar={sar}
            fmt={fmt}
          />
          <BreakdownAccordion
            label={isRTL ? 'بالفئة' : 'By Category'}
            icon="shape-outline"
            rows={data.byCategory}
            isOpen={expandedBreakdown === 'category'}
            onToggle={() => {
              LayoutAnimation.configureNext(SOFT_LAYOUT);
              setExpandedBreakdown((p) => (p === 'category' ? null : 'category'));
            }}
            COLORS={COLORS}
            isRTL={isRTL}
            sar={sar}
            fmt={fmt}
          />
          <BreakdownAccordion
            label={isRTL ? 'بالفني' : 'By Technician'}
            icon="account-wrench"
            rows={data.byTechnician}
            isOpen={expandedBreakdown === 'technician'}
            onToggle={() => {
              LayoutAnimation.configureNext(SOFT_LAYOUT);
              setExpandedBreakdown((p) => (p === 'technician' ? null : 'technician'));
            }}
            COLORS={COLORS}
            isRTL={isRTL}
            showTotal
            sar={sar}
            fmt={fmt}
          />

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

      {/* Custom date range modal — used when the user picks the 'Custom'
          chip. Plain text inputs in ISO format keep the bundle slim
          (no native picker dep). */}
      <Modal
        visible={customModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomModalOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: '#00000088',
            justifyContent: 'center',
            paddingHorizontal: 20,
          }}
        >
          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: BORDER_RADIUS.lg,
              padding: 16,
              gap: 10,
            }}
          >
            <Text
              style={{
                color: COLORS.text,
                fontSize: 15,
                fontWeight: '800',
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {isRTL ? 'فترة مخصصة' : 'Custom range'}
            </Text>
            <Text style={{ color: COLORS.textSecondary, fontSize: 12, textAlign: isRTL ? 'right' : 'left' }}>
              {isRTL ? 'YYYY-MM-DD' : 'YYYY-MM-DD'}
            </Text>
            <Text style={{ color: COLORS.textSecondary, fontSize: 11, textAlign: isRTL ? 'right' : 'left' }}>
              {isRTL ? 'من' : 'From'}
            </Text>
            <TextInput
              value={customFrom}
              onChangeText={setCustomFrom}
              placeholder="2025-01-01"
              placeholderTextColor={COLORS.textSecondary}
              autoCapitalize="none"
              style={{
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: BORDER_RADIUS.sm,
                paddingHorizontal: 10,
                paddingVertical: 8,
                color: COLORS.text,
                textAlign: isRTL ? 'right' : 'left',
              }}
            />
            <Text style={{ color: COLORS.textSecondary, fontSize: 11, textAlign: isRTL ? 'right' : 'left' }}>
              {isRTL ? 'إلى' : 'To'}
            </Text>
            <TextInput
              value={customTo}
              onChangeText={setCustomTo}
              placeholder={todayIso()}
              placeholderTextColor={COLORS.textSecondary}
              autoCapitalize="none"
              style={{
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: BORDER_RADIUS.sm,
                paddingHorizontal: 10,
                paddingVertical: 8,
                color: COLORS.text,
                textAlign: isRTL ? 'right' : 'left',
              }}
            />
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 6,
              }}
            >
              <TouchableOpacity
                onPress={() => setCustomModalOpen(false)}
                style={{ paddingVertical: 8, paddingHorizontal: 14 }}
              >
                <Text style={{ color: COLORS.textSecondary, fontWeight: '700' }}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setCustomModalOpen(false);
                  load();
                }}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: BORDER_RADIUS.sm,
                  backgroundColor: COLORS.primary,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  {isRTL ? 'تطبيق' : 'Apply'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function BreakdownAccordion({
  label,
  icon,
  rows,
  isOpen,
  onToggle,
  COLORS,
  isRTL,
  showTotal,
  sar,
  fmt,
}: {
  label: string;
  icon: string;
  rows: BreakdownRow[];
  isOpen: boolean;
  onToggle: () => void;
  COLORS: any;
  isRTL: boolean;
  showTotal?: boolean;
  sar: string;
  fmt: (n: number) => string;
}) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.card,
        borderRadius: 16,
        marginTop: 10,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
      }}
    >
      <TouchableOpacity
        onPress={onToggle}
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 14,
          gap: 10,
          backgroundColor: COLORS.surface ?? COLORS.background,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
        }}
      >
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
          <MaterialCommunityIcons name={icon as any} size={18} color={COLORS.primary} />
          <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 14 }}>{label}</Text>
          <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>· {rows.length}</Text>
        </View>
        <MaterialCommunityIcons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={COLORS.textSecondary}
        />
      </TouchableOpacity>
      {isOpen && (
        <View style={{ paddingHorizontal: 12, paddingBottom: 10, gap: 6 }}>
          {rows.length === 0 ? (
            <Text style={{ color: COLORS.textSecondary, fontSize: 13, paddingVertical: 6 }}>
              {isRTL ? 'لا توجد بيانات' : 'No data'}
            </Text>
          ) : (
            rows.map((r) => (
              <View
                key={r.key}
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 6,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: COLORS.border,
                  gap: 10,
                }}
              >
                <Text
                  style={{ color: COLORS.text, flex: 1, fontSize: 13, textAlign: isRTL ? 'right' : 'left' }}
                  numberOfLines={1}
                >
                  {r.label}
                </Text>
                <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '800', minWidth: 36, textAlign: 'center' }}>
                  {fmt(r.count)}
                </Text>
                {showTotal && (
                  <Text style={{ color: COLORS.textSecondary, fontSize: 12, minWidth: 90, textAlign: isRTL ? 'left' : 'right' }}>
                    {fmt(Math.round(r.total))} {sar}
                  </Text>
                )}
              </View>
            ))
          )}
        </View>
      )}
    </View>
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
      marginTop: 24,
      marginBottom: 12,
      paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.border,
    }}>
      <MaterialCommunityIcons name={icon} size={18} color={COLORS.primary} />
      <Text style={{
        color: COLORS.text,
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        flex: 1,
        textAlign: isRTL ? 'right' : 'left',
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
      borderRadius: 20,
      padding: 18,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    kpiIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
      alignSelf: isRTL ? 'flex-end' : 'flex-start',
    },
    kpiLabel: {
      color: 'rgba(255,255,255,0.9)',
      fontSize: 12,
      fontWeight: '700',
      textAlign: isRTL ? 'right' : 'left',
    },
    kpiValue: {
      color: '#fff',
      fontSize: 26,
      fontWeight: '900',
      marginTop: 6,
      letterSpacing: -0.4,
      textAlign: isRTL ? 'right' : 'left',
    },
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
