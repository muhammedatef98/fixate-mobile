import React, { useEffect, useState, useCallback } from 'react';
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
import * as paymentService from '../services/paymentService';
import { getFriendlyError } from '../utils/errorMessages';
import ErrorState from '../components/ErrorState';

export default function WalletScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [payments, setPayments] = useState<paymentService.Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await paymentService.getMyPayments(user.id);
      setPayments(data);
    } catch (e: any) {
      setErrorMsg(getFriendlyError(e, language));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, language]);

  useEffect(() => {
    load();
  }, [load]);

  const totalSpent = payments
    .filter((p) => p.status === 'succeeded')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const statusInfo = (status: string) => {
    switch (status) {
      case 'succeeded':
        return { label: isRTL ? 'مدفوع' : 'Paid', color: COLORS.success, icon: 'check-circle' };
      case 'pending':
      case 'processing':
        return { label: isRTL ? 'قيد المعالجة' : 'Processing', color: COLORS.warning, icon: 'progress-clock' };
      case 'failed':
        return { label: isRTL ? 'فشل' : 'Failed', color: COLORS.error, icon: 'alert-circle' };
      case 'refunded':
        return { label: isRTL ? 'مسترد' : 'Refunded', color: COLORS.info, icon: 'cash-refund' };
      default:
        return { label: status, color: COLORS.textSecondary, icon: 'help-circle' };
    }
  };

  const styles = createStyles(COLORS, isRTL);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
        >
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isRTL ? 'المحفظة' : 'Wallet'}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
      >
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>
            {isRTL ? 'إجمالي المدفوعات' : 'Total spent'}
          </Text>
          <Text style={styles.balanceValue}>
            {totalSpent.toFixed(2)} {isRTL ? 'ر.س' : 'SAR'}
          </Text>
          <Text style={styles.balanceSub}>
            {payments.length} {isRTL ? 'عملية' : 'transactions'}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>
          {isRTL ? 'المعاملات الأخيرة' : 'Recent transactions'}
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : errorMsg ? (
          <ErrorState message={errorMsg} onRetry={load} />
        ) : payments.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="wallet-outline" size={64} color={COLORS.border} />
            <Text style={styles.emptyTitle}>
              {isRTL ? 'لا توجد معاملات بعد' : 'No transactions yet'}
            </Text>
            <Text style={styles.emptySub}>
              {isRTL ? 'ستظهر مدفوعاتك هنا بعد إكمال أي طلب صيانة' : 'Your payments will appear here after completing any repair'}
            </Text>
          </View>
        ) : (
          payments.map((p) => {
            const info = statusInfo(p.status);
            return (
              <TouchableOpacity
                key={p.id}
                style={styles.txnRow}
                onPress={() => router.push(`/order-details?id=${p.order_id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${info.label} ${p.amount} ${p.currency}`}
              >
                <View style={[styles.txnIcon, { backgroundColor: info.color + '15' }]}>
                  <MaterialCommunityIcons name={info.icon as any} size={22} color={info.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txnTitle}>
                    {isRTL ? 'طلب صيانة #' : 'Repair order #'}{p.order_id.slice(0, 6)}
                  </Text>
                  <Text style={styles.txnDate}>
                    {p.created_at ? new Date(p.created_at).toLocaleDateString(isRTL ? 'ar-SA' : 'en-GB') : ''}
                  </Text>
                </View>
                <View style={{ alignItems: isRTL ? 'flex-start' : 'flex-end' }}>
                  <Text style={[styles.txnAmount, { color: info.color }]}>
                    {Number(p.amount).toFixed(2)} {p.currency}
                  </Text>
                  <Text style={styles.txnStatus}>{info.label}</Text>
                </View>
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
      padding: SPACING.lg,
      backgroundColor: C.card,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    title: { fontSize: 18, fontWeight: 'bold', color: C.text },
    balanceCard: {
      backgroundColor: C.primary,
      borderRadius: BORDER_RADIUS.xl,
      padding: SPACING.xl,
      alignItems: 'center',
      marginBottom: SPACING.xl,
    },
    balanceLabel: { color: '#fff', opacity: 0.9, fontSize: 14 },
    balanceValue: { color: '#fff', fontSize: 36, fontWeight: 'bold', marginVertical: SPACING.sm },
    balanceSub: { color: '#fff', opacity: 0.8, fontSize: 12 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: C.text, marginBottom: SPACING.md, textAlign: isRTL ? 'right' : 'left' },
    empty: { alignItems: 'center', paddingVertical: 40 },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: C.text, marginTop: SPACING.md },
    emptySub: { fontSize: 13, color: C.textSecondary, textAlign: 'center', marginTop: SPACING.sm, paddingHorizontal: SPACING.lg },
    txnRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      backgroundColor: C.card,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      marginBottom: SPACING.sm,
      gap: SPACING.md,
      minHeight: 64,
    },
    txnIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    txnTitle: { fontWeight: '600', color: C.text, fontSize: 14, textAlign: isRTL ? 'right' : 'left' },
    txnDate: { color: C.textSecondary, fontSize: 12, marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
    txnAmount: { fontWeight: 'bold', fontSize: 14 },
    txnStatus: { color: C.textSecondary, fontSize: 11, marginTop: 2 },
  });
