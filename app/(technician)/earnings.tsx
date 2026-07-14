import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { MaterialIcons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { requests, auth } from '../../lib/supabase-api';
import { useApp } from '../../contexts/AppContext';
import { logger } from '../../utils/logger';
import * as walletService from '../../services/walletService';
import { useAuth } from '../../contexts/AuthContext';
import { formatAppDate } from '../../lib/formatDate';
import { Riyal } from '../../components/Riyal';

const { width } = Dimensions.get('window');

const PERIOD_TABS = [
  { id: 'today', labelAr: 'اليوم', labelEn: 'Today' },
  { id: 'week', labelAr: 'الأسبوع', labelEn: 'Week' },
  { id: 'month', labelAr: 'الشهر', labelEn: 'Month' },
  { id: 'all', labelAr: 'الكل', labelEn: 'All' },
];

export default function EarningsScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  // All completed jobs, fetched once; the period tabs filter this client-side
  // (they're the same dataset sliced by date, so re-fetching per tab was waste).
  const [completed, setCompleted] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const isRTL = language === 'ar';
  const styles = makeStyles(isRTL);
  const localStyles = makeLocalStyles(isRTL);
  const [wallet, setWallet] = useState<{ balance: number; pendingBackend: boolean }>({ balance: 0, pendingBackend: true });

  const load = useCallback(async () => {
    try {
      const currentUser = await auth.getCurrentUser();
      if (!currentUser) return;
      const [allOrders, bal] = await Promise.all([
        requests.getMyOrders(),
        walletService.getWalletBalance(currentUser.id),
      ]);
      setCompleted(
        (allOrders as any[]).filter(
          (o) => o.technician_id === currentUser.id && o.status === 'completed'
        )
      );
      setWallet(bal);
    } catch (error) {
      logger.error('Error loading earnings:', error);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Earnings basis = the accepted offer (payment v2), minus the technician's
  // internal spare-part cost; legacy rows fall back to the old quote/estimate.
  const netOf = (o: any): number =>
    Math.max(
      0,
      Number(o.accepted_offer_amount ?? o.final_price ?? o.estimated_price ?? 0) -
        Number(o.spare_parts_cost ?? 0)
    );

  // Period filtering + totals, recomputed from the single fetched dataset.
  const { orders, earnings } = useMemo(() => {
    const now = Date.now();
    const cutoff =
      selectedPeriod === 'week' ? now - 7 * 24 * 60 * 60 * 1000
      : selectedPeriod === 'month' ? now - 30 * 24 * 60 * 60 * 1000
      : null;
    const today = new Date().toDateString();
    const filtered = completed.filter((o) => {
      if (selectedPeriod === 'today') return new Date(o.updated_at).toDateString() === today;
      if (cutoff !== null) return new Date(o.updated_at).getTime() >= cutoff;
      return true; // 'all'
    });
    const total = filtered.reduce((sum, o) => sum + netOf(o), 0);
    return {
      orders: filtered,
      earnings: { total, orders: filtered.length, average: filtered.length > 0 ? total / filtered.length : 0 },
    };
  }, [completed, selectedPeriod]);

  const renderEarningCard = (order: any) => (
    <View
      key={order.id}
      style={[styles.earningCard, { backgroundColor: COLORS.card }, SHADOWS.small]}
    >
      <View style={styles.earningHeader}>
        <View style={styles.earningInfo}>
          <Text style={[styles.earningTitle, { color: COLORS.text }]}>
            {order.device_brand} {order.device_model}
          </Text>
          <Text style={[styles.earningDate, { color: COLORS.textSecondary }]}>
            {formatAppDate(order.updated_at, isRTL)}
          </Text>
        </View>
        <View style={[styles.earningAmount, { backgroundColor: '#10B98115' }]}>
          <Text style={[styles.earningAmountText, { color: '#10B981' }]}>
            +{netOf(order)} <Riyal />
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: COLORS.text }]}>
          {language === 'ar' ? 'الأرباح' : 'Earnings'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />
        }
      >
        {/* Wallet card — balance + withdraw CTA */}
        <View style={[localStyles.walletCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
              <Text style={[localStyles.walletLabel, { color: COLORS.textSecondary }]}>
                {isRTL ? 'رصيد المحفظة' : 'Wallet balance'}
              </Text>
              <Text style={[localStyles.walletAmount, { color: COLORS.primary }]}>
                {wallet.balance.toFixed(2)} <Riyal />
              </Text>
            </View>
            <MaterialCommunityIcons name="wallet-outline" size={36} color={COLORS.primary} />
          </View>
          {/* Withdrawal / payout request flow removed per product direction —
              the technician earnings surface is intentionally non-admin-style.
              Payouts are handled out-of-band by the operations team. */}
        </View>

        {/* Total Earnings Card */}
        <View style={[styles.totalCard, { backgroundColor: '#10B981' }, SHADOWS.large]}>
          <MaterialCommunityIcons name="cash-multiple" size={48} color="#FFFFFF" />
          <Text style={styles.totalLabel}>
            {language === 'ar' ? 'إجمالي الأرباح' : 'Total Earnings'}
          </Text>
          <Text style={styles.totalAmount}>
            {earnings.total.toFixed(2)} <Riyal />
          </Text>
          <View style={styles.totalStats}>
            <View style={styles.totalStatItem}>
              <Text style={styles.totalStatValue}>{earnings.orders}</Text>
              <Text style={styles.totalStatLabel}>
                {language === 'ar' ? 'طلب' : 'Orders'}
              </Text>
            </View>
            <View style={styles.totalStatDivider} />
            <View style={styles.totalStatItem}>
              <Text style={styles.totalStatValue}>{earnings.average.toFixed(0)}</Text>
              <Text style={styles.totalStatLabel}>
                {language === 'ar' ? 'متوسط' : 'Average'}
              </Text>
            </View>
          </View>
        </View>

        {/* Period Tabs */}
        <View style={styles.tabs}>
          {PERIOD_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tab,
                selectedPeriod === tab.id && [
                  styles.tabActive,
                  { backgroundColor: COLORS.primary }
                ]
              ]}
              onPress={() => setSelectedPeriod(tab.id)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: selectedPeriod === tab.id ? '#FFFFFF' : COLORS.textSecondary }
                ]}
              >
                {language === 'ar' ? tab.labelAr : tab.labelEn}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: COLORS.card }, SHADOWS.small]}>
            <FontAwesome5 name="shopping-bag" size={24} color="#3B82F6" />
            <Text style={[styles.statValue, { color: COLORS.text }]}>
              {earnings.orders}
            </Text>
            <Text style={[styles.statLabel, { color: COLORS.textSecondary }]}>
              {language === 'ar' ? 'طلبات مكتملة' : 'Completed Orders'}
            </Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: COLORS.card }, SHADOWS.small]}>
            <FontAwesome5 name="chart-line" size={24} color="#10B981" />
            <Text style={[styles.statValue, { color: COLORS.text }]}>
              {earnings.average.toFixed(0)}
            </Text>
            <Text style={[styles.statLabel, { color: COLORS.textSecondary }]}>
              {language === 'ar' ? 'متوسط الربح' : 'Average Earning'}
            </Text>
          </View>
        </View>

        {/* Earnings History */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
            {language === 'ar' ? 'سجل الأرباح' : 'Earnings History'}
          </Text>
          
          {orders.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: COLORS.card }, SHADOWS.small]}>
              <MaterialCommunityIcons name="inbox" size={48} color={COLORS.textSecondary} />
              <Text style={[styles.emptyStateText, { color: COLORS.textSecondary }]}>
                {language === 'ar' ? 'لا توجد أرباح في هذه الفترة' : 'No earnings in this period'}
              </Text>
            </View>
          ) : (
            orders.map(renderEarningCard)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeLocalStyles = (isRTL: boolean) => StyleSheet.create({
  walletCard: {
    margin: SPACING.lg,
    marginBottom: 0,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: 12,
  },
  walletLabel: { fontSize: 13, fontWeight: '600' },
  walletAmount: { fontSize: 28, fontWeight: '800', marginTop: 4 },
});

const makeStyles = (isRTL: boolean) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalCard: {
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.xl,
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center',
  },
  totalLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: SPACING.md,
    opacity: 0.9,
  },
  totalAmount: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: 'bold',
    marginTop: SPACING.xs,
  },
  totalStats: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    marginTop: SPACING.xl,
    gap: SPACING.xl,
  },
  totalStatItem: {
    alignItems: 'center',
  },
  totalStatValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  totalStatLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: SPACING.xs,
    opacity: 0.9,
  },
  totalStatDivider: {
    width: 1,
    backgroundColor: '#FFFFFF',
    opacity: 0.3,
  },
  tabs: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  tabActive: {},
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  statCard: {
    flex: 1,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: SPACING.md,
  },
  earningCard: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
  },
  earningHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  earningInfo: {
    flex: 1,
  },
  earningTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  earningDate: {
    fontSize: 12,
  },
  earningAmount: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  earningAmountText: {
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
