import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Dimensions } from 'react';
import { useRouter } from 'expo-router';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { MaterialIcons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { orders as supabaseOrders, auth } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';

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

  useEffect(() => {
    loadEarnings();
  }, [selectedPeriod]);

  const loadEarnings = async () => {
    try {
      const user = await auth.getCurrentUser();
      if (!user) return;

      const allOrders = await supabaseOrders.getAll();
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
      console.error('Error loading earnings:', error);
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
            {new Date(order.updated_at).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
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

      <ScrollView showsVerticalScrollIndicator={false}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
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
    flexDirection: 'row',
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
    flexDirection: 'row',
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
    flexDirection: 'row',
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
    flexDirection: 'row',
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
