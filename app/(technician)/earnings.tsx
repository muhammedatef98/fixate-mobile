import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Alert } from 'react-native';
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
  const [earnings, setEarnings] = useState({
    total: 0,
    orders: 0,
    average: 0,
  });
  const [orders, setOrders] = useState<any[]>([]);
  const { user } = useAuth();
  const isRTL = language === 'ar';
  const styles = makeStyles(isRTL);
  const localStyles = makeLocalStyles(isRTL);
  // Wallet state — balance from DB view, recent ledger entries, and
  // whether the backend layer is still pending (UI degrades gracefully).
  const [wallet, setWallet] = useState<{ balance: number; pendingBackend: boolean }>({ balance: 0, pendingBackend: true });
  const [walletEntries, setWalletEntries] = useState<walletService.WalletEntry[]>([]);
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const bal = await walletService.getWalletBalance(user.id);
      setWallet(bal);
      setWalletEntries(await walletService.listWalletEntries(user.id));
    })();
  }, [user?.id]);

  const handleWithdraw = async () => {
    if (!user?.id) return;
    if (wallet.balance <= 0) {
      Alert.alert(
        isRTL ? 'لا يوجد رصيد للسحب' : 'No balance to withdraw',
        isRTL ? 'الرصيد الحالي صفر. أكمل المزيد من الطلبات لجمع الأرباح.' : 'Your balance is zero. Complete more jobs to earn.'
      );
      return;
    }
    Alert.alert(
      isRTL ? 'طلب سحب الأرباح' : 'Request payout',
      isRTL
        ? `سيتم إرسال طلب سحب ${wallet.balance.toFixed(0)} ر.س للإدارة. التحويل يتم عادة خلال 1-3 أيام عمل.`
        : `A withdrawal request for ${wallet.balance.toFixed(0)} SAR will be sent to the admin team. Transfers usually arrive in 1-3 business days.`,
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'تأكيد' : 'Confirm',
          onPress: async () => {
            setWithdrawing(true);
            try {
              const res = await walletService.requestWithdrawal(
                user.id,
                wallet.balance,
                'bank_transfer'
              );
              if ((res as any).pendingBackend) {
                Alert.alert(
                  isRTL ? 'تم تسجيل الطلب' : 'Request recorded',
                  isRTL
                    ? 'تم تسجيل طلبك. يحتاج فعالة كاملة من فريق المنصة (في طور التهيئة).'
                    : 'Your request was recorded locally. Full payout pipeline is being set up by the platform team.'
                );
              } else {
                Alert.alert(
                  isRTL ? 'تم إرسال الطلب ✓' : 'Request sent ✓',
                  isRTL ? 'ستصلك رسالة عند الموافقة على التحويل.' : 'You will be notified once the transfer is approved.'
                );
              }
            } finally {
              setWithdrawing(false);
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    loadEarnings();
  }, [selectedPeriod]);

  const loadEarnings = async () => {
    try {
      const user = await auth.getCurrentUser();
      if (!user) return;

      const allOrders = await requests.getMyOrders();
      const completedOrders = allOrders.filter((o: any) => 
        o.technician_id === user.id && o.status === 'completed'
      );

      // Filter by period
      const now = new Date();
      let filteredOrders = completedOrders;

      if (selectedPeriod === 'today') {
        const today = now.toDateString();
        filteredOrders = completedOrders.filter((o: any) => 
          new Date(o.updated_at).toDateString() === today
        );
      } else if (selectedPeriod === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filteredOrders = completedOrders.filter((o: any) => 
          new Date(o.updated_at) >= weekAgo
        );
      } else if (selectedPeriod === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filteredOrders = completedOrders.filter((o: any) => 
          new Date(o.updated_at) >= monthAgo
        );
      }

      const total = filteredOrders.reduce((sum: number, o: any) => 
        sum + (o.estimated_price || 0), 0
      );
      const average = filteredOrders.length > 0 ? total / filteredOrders.length : 0;

      setEarnings({
        total,
        orders: filteredOrders.length,
        average,
      });
      setOrders(filteredOrders);
    } catch (error) {
      logger.error('Error loading earnings:', error);
    }
  };

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
            +{order.estimated_price} {language === 'ar' ? 'ر.س' : 'SAR'}
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Wallet card — balance + withdraw CTA */}
        <View style={[localStyles.walletCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
              <Text style={[localStyles.walletLabel, { color: COLORS.textSecondary }]}>
                {isRTL ? 'رصيد المحفظة' : 'Wallet balance'}
              </Text>
              <Text style={[localStyles.walletAmount, { color: COLORS.primary }]}>
                {wallet.balance.toFixed(2)} {isRTL ? 'ر.س' : 'SAR'}
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
            {earnings.total.toFixed(2)} {language === 'ar' ? 'ر.س' : 'SAR'}
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
  walletBtn: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.md,
  },
  walletBtnText: { color: '#fff', fontWeight: '700' },
  walletNote: { fontSize: 11, lineHeight: 16, marginTop: 2, textAlign: 'center' },
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
