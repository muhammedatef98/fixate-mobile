import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useIsAdmin } from '../hooks/useAdminGuard';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import {
  AdminScreenHeader,
  AdminFilterChips,
  AdminEmptyState,
  type AdminFilterChip,
} from '../components/admin/AdminUI';
import {
  getAccountingData,
  exportAccountingCsv,
  type AccountingData,
  type AccountingRange,
} from '../services/accountingService';
import { logger } from '../utils/logger';

const CATEGORY_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#EF4444'];

export default function AdminAccountingScreen() {
  const { language, isDark } = useApp();
  const { userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const styles = createStyles(COLORS, isRTL);

  const [range, setRange] = useState<AccountingRange>('month');
  const [data, setData] = useState<AccountingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const profileLoaded = userProfile !== null;
  const { isAdmin } = useIsAdmin();

  const fmt = useCallback(
    (n: number) => Number(n).toLocaleString(isRTL ? 'ar-SA' : 'en-US', { maximumFractionDigits: 0 }),
    [isRTL]
  );
  const sar = isRTL ? 'ر.س' : 'SAR';

  const load = useCallback(async () => {
    try {
      const d = await getAccountingData(range, isRTL);
      setData(d);
    } catch {
      // surfaced as empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range, isRTL]);

  useEffect(() => {
    if (profileLoaded && isAdmin) {
      setLoading(true);
      load();
    }
  }, [profileLoaded, isAdmin, load]);

  const onExport = async () => {
    if (!data) return;
    setExporting(true);
    try {
      await exportAccountingCsv(data, isRTL);
    } catch (e) {
      logger.warn('accounting export failed', e);
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'تعذّر تصدير التقرير' : 'Could not export the report');
    } finally {
      setExporting(false);
    }
  };

  const RANGE_FILTERS: AdminFilterChip<AccountingRange>[] = [
    { key: 'today', ar: 'اليوم', en: 'Today' },
    { key: 'week', ar: 'هذا الأسبوع', en: 'This week' },
    { key: 'month', ar: 'هذا الشهر', en: 'This month' },
    { key: 'year', ar: 'هذا العام', en: 'This year' },
    { key: 'all', ar: 'الكل', en: 'All' },
  ];

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
        <AdminScreenHeader title={isRTL ? 'المحاسبة' : 'Accounting'} />
        <AdminEmptyState
          variant="error"
          icon="shield-alert-outline"
          title={isRTL ? 'غير مصرّح' : 'Unauthorized'}
          body={isRTL ? 'هذه الصفحة للأدمن فقط' : 'Admins only'}
        />
      </SafeAreaView>
    );
  }

  const maxBucket = data ? Math.max(1, ...data.revenueBuckets.map((b) => b.revenue)) : 1;
  const totalCat = data ? data.categories.reduce((s, c) => s + c.revenue, 0) || 1 : 1;

  const KPIS = data
    ? [
        { label: isRTL ? 'إجمالي الإيرادات' : 'Total revenue', value: fmt(data.totalRevenue), icon: 'cash-multiple', color: '#10B981' },
        { label: isRTL ? 'تكلفة قطع الغيار' : 'Spare parts cost', value: fmt(data.totalSpareParts), icon: 'cog-outline', color: '#F59E0B' },
        { label: isRTL ? 'صافي الربح' : 'Net profit', value: fmt(data.netProfit), icon: 'trending-up', color: '#3B82F6' },
        { label: isRTL ? 'مدفوعات معلقة' : 'Pending payments', value: fmt(data.pendingPayments), icon: 'credit-card-clock', color: '#EF4444' },
      ]
    : [];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <AdminScreenHeader
        title={isRTL ? 'المحاسبة' : 'Accounting'}
        subtitle={data ? (isRTL ? `${data.completedCount} طلب مكتمل` : `${data.completedCount} completed`) : undefined}
        rightIcon="refresh"
        rightLabel={isRTL ? 'تحديث' : 'Refresh'}
        onRightPress={() => {
          setRefreshing(true);
          load();
        }}
      />

      <AdminFilterChips<AccountingRange> filters={RANGE_FILTERS} value={range} onChange={setRange} />

      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 48 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 48 }} />
        ) : !data || data.completedCount === 0 ? (
          <AdminEmptyState
            icon="calculator-variant-outline"
            title={isRTL ? 'لا توجد بيانات محاسبية' : 'No accounting data'}
            body={isRTL ? 'ستظهر الأرقام بعد اكتمال طلبات في هذه الفترة' : 'Figures appear once orders complete in this range'}
          />
        ) : (
          <>
            {/* KPI 2×2 grid */}
            <View style={styles.kpiGrid}>
              {KPIS.map((k) => (
                <View key={k.label} style={styles.kpiCard}>
                  <View style={[styles.kpiIcon, { backgroundColor: k.color + '18' }]}>
                    <MaterialCommunityIcons name={k.icon as any} size={20} color={k.color} />
                  </View>
                  <Text style={styles.kpiValue} numberOfLines={1}>
                    {k.value} <Text style={styles.kpiUnit}>{sar}</Text>
                  </Text>
                  <Text style={styles.kpiLabel} numberOfLines={1}>{k.label}</Text>
                </View>
              ))}
            </View>

            {/* Revenue bar chart */}
            <Text style={styles.sectionTitle}>{isRTL ? 'الإيرادات' : 'Revenue'}</Text>
            <View style={styles.card}>
              {data.revenueBuckets.length === 0 ? (
                <Text style={styles.muted}>{isRTL ? 'لا توجد بيانات' : 'No data'}</Text>
              ) : (
                <View style={[styles.chartRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  {data.revenueBuckets.map((b) => (
                    <View key={b.label} style={styles.barCol}>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            { height: `${Math.max(4, (b.revenue / maxBucket) * 100)}%`, backgroundColor: COLORS.primary },
                          ]}
                        />
                      </View>
                      <Text style={styles.barLabel} numberOfLines={1}>{b.label}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Per-technician earnings */}
            <Text style={styles.sectionTitle}>{isRTL ? 'أرباح الفنيين' : 'Technician earnings'}</Text>
            <View style={styles.card}>
              <View style={[styles.tableHead, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Text style={[styles.thName]}>{isRTL ? 'الفني' : 'Technician'}</Text>
                <Text style={styles.thNum}>{isRTL ? 'طلبات' : 'Orders'}</Text>
                <Text style={styles.thNum}>{isRTL ? 'الصافي' : 'Net'}</Text>
              </View>
              {data.technicians.map((t) => (
                <View key={t.technicianId} style={[styles.tableRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <Text style={[styles.tdName, { textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>{t.name}</Text>
                  <Text style={styles.tdNum}>{t.completedOrders}</Text>
                  <Text style={[styles.tdNum, { color: COLORS.primary, fontWeight: '800' }]}>{fmt(t.net)}</Text>
                </View>
              ))}
            </View>

            {/* Category breakdown */}
            <Text style={styles.sectionTitle}>{isRTL ? 'الإيرادات حسب الخدمة' : 'Revenue by service'}</Text>
            <View style={styles.card}>
              {data.categories.map((c, i) => {
                const pct = (c.revenue / totalCat) * 100;
                const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
                return (
                  <View key={c.label} style={{ marginBottom: 12 }}>
                    <View style={[styles.catRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                      <Text style={[styles.catLabel, { textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>{c.label}</Text>
                      <Text style={styles.catVal}>{fmt(c.revenue)} {sar} · {pct.toFixed(0)}%</Text>
                    </View>
                    <View style={styles.catTrack}>
                      <View style={[styles.catFill, { width: `${Math.max(2, pct)}%`, backgroundColor: color }]} />
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Recent transactions */}
            <Text style={styles.sectionTitle}>{isRTL ? 'أحدث المعاملات' : 'Recent transactions'}</Text>
            <View style={styles.card}>
              {data.recent.map((r) => (
                <View key={r.id} style={[styles.txnRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.txnTitle, { textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
                      {r.orderNumber} · {r.customer}
                    </Text>
                    <Text style={[styles.txnSub, { textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
                      {r.technician} · {r.date.slice(0, 10)}
                    </Text>
                  </View>
                  <Text style={styles.txnAmount}>{fmt(r.amount)} {sar}</Text>
                </View>
              ))}
            </View>

            {/* Export */}
            <TouchableOpacity style={styles.exportBtn} onPress={onExport} disabled={exporting} activeOpacity={0.85}>
              {exporting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="file-export-outline" size={20} color="#fff" />
                  <Text style={styles.exportText}>{isRTL ? 'تصدير التقرير' : 'Export report'}</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
    kpiCard: {
      width: '47%',
      flexGrow: 1,
      backgroundColor: C.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border,
      padding: 14,
    },
    kpiIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    kpiValue: { color: C.text, fontSize: 18, fontWeight: '900', textAlign: isRTL ? 'right' : 'left' },
    kpiUnit: { fontSize: 12, fontWeight: '700', color: C.textSecondary },
    kpiLabel: { color: C.textSecondary, fontSize: 12, marginTop: 4, textAlign: isRTL ? 'right' : 'left' },
    sectionTitle: { color: C.text, fontSize: 15, fontWeight: '800', marginTop: 22, marginBottom: 10, textAlign: isRTL ? 'right' : 'left' },
    card: {
      backgroundColor: C.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border,
      padding: 14,
    },
    muted: { color: C.textSecondary, fontSize: 13, textAlign: 'center', paddingVertical: 16 },
    chartRow: { alignItems: 'flex-end', height: 150, gap: 8 },
    barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
    barTrack: { width: '70%', flex: 1, justifyContent: 'flex-end', backgroundColor: C.border + '55', borderRadius: 6, overflow: 'hidden' },
    barFill: { width: '100%', borderRadius: 6 },
    barLabel: { color: C.textSecondary, fontSize: 9.5, marginTop: 6 },
    tableHead: { borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 8, marginBottom: 6 },
    thName: { flex: 1, color: C.textSecondary, fontSize: 12, fontWeight: '800', textAlign: isRTL ? 'right' : 'left' },
    thNum: { width: 64, color: C.textSecondary, fontSize: 12, fontWeight: '800', textAlign: 'center' },
    tableRow: { alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    tdName: { flex: 1, color: C.text, fontSize: 13.5, fontWeight: '600' },
    tdNum: { width: 64, color: C.text, fontSize: 13, textAlign: 'center' },
    catRow: { justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    catLabel: { flex: 1, color: C.text, fontSize: 13, fontWeight: '600' },
    catVal: { color: C.textSecondary, fontSize: 11.5, fontWeight: '700' },
    catTrack: { height: 8, borderRadius: 4, backgroundColor: C.border + '55', overflow: 'hidden' },
    catFill: { height: '100%', borderRadius: 4 },
    txnRow: { alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, gap: 10 },
    txnTitle: { color: C.text, fontSize: 13.5, fontWeight: '700' },
    txnSub: { color: C.textSecondary, fontSize: 11.5, marginTop: 2 },
    txnAmount: { color: C.primary, fontSize: 13.5, fontWeight: '800' },
    exportBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: C.primary,
      borderRadius: 14,
      paddingVertical: 14,
      marginTop: 24,
    },
    exportText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  });
