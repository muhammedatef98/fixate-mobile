import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { useOrders } from '../../contexts/OrdersContext';
import { supabase } from '../../services/supabaseClient';
import { RTLMaterialIcon } from '../../components/RTLIcon';
import NotificationBell from '../../components/NotificationBell';
import {
  ORDER_STATUS_LABELS_AR,
  ORDER_STATUS_LABELS_EN,
  isTerminalStatus,
} from '../../types/order';

export default function TechnicianDashboard() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user, userProfile } = useAuth();
  const { orders, loading, refreshOrders } = useOrders();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';
  const styles = makeStyles(COLORS, isRTL);

  const [rating, setRating] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('technicians')
      .select('rating')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setRating(data?.rating != null ? Number(data.rating) : null));
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshOrders();
    setRefreshing(false);
  };

  // ── Derived stats ───────────────────────────────────────
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const todayJobs = orders.filter(
    (o) => o.created_at && new Date(o.created_at) >= startOfDay
  ).length;
  const completed = orders.filter((o) => o.status === 'completed');
  const monthEarnings = completed
    .filter((o) => {
      const d = new Date(o.updated_at ?? o.created_at ?? 0);
      return d >= startOfMonth;
    })
    .reduce((sum, o) => sum + Number(o.final_price ?? o.estimated_price ?? 0), 0);

  const activeJob = orders.find((o) => !isTerminalStatus(o.status));
  const recentJobs = orders.filter((o) => isTerminalStatus(o.status)).slice(0, 5);

  const firstName = userProfile?.name?.split(' ')[0] || (isRTL ? 'كابتن' : 'Captain');
  const fmt = (n: number) => n.toLocaleString(isRTL ? 'ar-SA' : 'en-US');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting} numberOfLines={1}>
              {isRTL ? `أهلاً، كابتن ${firstName} 🔧` : `Hello, Captain ${firstName} 🔧`}
            </Text>
            <Text style={styles.greetingSub}>
              {isRTL ? 'إليك ملخّص يومك' : "Here's your day at a glance"}
            </Text>
          </View>
          <NotificationBell style={[styles.bellBtn, SHADOWS.small]} color={COLORS.text} />
        </View>

        {/* Stats row */}
        <View style={styles.statsGrid}>
          <StatTile
            icon="briefcase-clock" color="#3B82F6"
            label={isRTL ? 'مهام اليوم' : "Today's jobs"}
            value={fmt(todayJobs)} COLORS={COLORS} SHADOWS={SHADOWS}
          />
          <StatTile
            icon="check-decagram" color="#10B981"
            label={isRTL ? 'إجمالي المكتملة' : 'Total completed'}
            value={fmt(completed.length)} COLORS={COLORS} SHADOWS={SHADOWS}
          />
          <StatTile
            icon="cash-multiple" color="#F59E0B"
            label={isRTL ? 'أرباح الشهر' : 'Earnings this month'}
            value={`${fmt(monthEarnings)} ${isRTL ? 'ر.س' : 'SAR'}`}
            COLORS={COLORS} SHADOWS={SHADOWS}
          />
          <StatTile
            icon="star" color="#EC4899"
            label={isRTL ? 'التقييم' : 'Rating'}
            value={rating != null && rating > 0 ? rating.toFixed(1) : '—'}
            COLORS={COLORS} SHADOWS={SHADOWS}
          />
        </View>

        {/* Active job */}
        <Text style={styles.sectionTitle}>{isRTL ? 'المهمة الحالية' : 'Active job'}</Text>
        {activeJob ? (
          <View style={[styles.activeCard, SHADOWS.medium]}>
            <View style={styles.activeTop}>
              <View style={[styles.statusDot, { backgroundColor: COLORS.primary }]} />
              <Text style={styles.activeStatus}>
                {(isRTL ? ORDER_STATUS_LABELS_AR : ORDER_STATUS_LABELS_EN)[activeJob.status]}
              </Text>
            </View>
            <Text style={styles.activeDevice} numberOfLines={1}>
              {[activeJob.device_brand, activeJob.device_model].filter(Boolean).join(' ') ||
                (isRTL ? 'طلب إصلاح' : 'Repair job')}
            </Text>
            {!!activeJob.issue_description && (
              <Text style={styles.activeIssue} numberOfLines={2}>{activeJob.issue_description}</Text>
            )}
            {!!activeJob.location && (
              <View style={styles.activeMetaRow}>
                <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
                <Text style={styles.activeMeta} numberOfLines={1}>{activeJob.location}</Text>
              </View>
            )}
            <View style={styles.activeActions}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: COLORS.primary }]}
                onPress={() =>
                  router.push({ pathname: '/(technician)/manage-order', params: { id: activeJob.id } })
                }
              >
                <MaterialCommunityIcons name="wrench" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>{isRTL ? 'إدارة المهمة' : 'Manage job'}</Text>
              </TouchableOpacity>
              {!!activeJob.customer_phone && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnAlt, { borderColor: COLORS.border }]}
                  onPress={() => Linking.openURL(`tel:${activeJob.customer_phone}`)}
                >
                  <Ionicons name="call" size={18} color={COLORS.primary} />
                  <Text style={[styles.actionBtnText, { color: COLORS.primary }]}>
                    {isRTL ? 'اتصال' : 'Call'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          <View style={[styles.emptyCard, SHADOWS.small]}>
            <MaterialCommunityIcons name="coffee-outline" size={32} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>
              {isRTL ? 'لا توجد مهمة نشطة حالياً' : 'No active job right now'}
            </Text>
            <TouchableOpacity
              style={[styles.findBtn, { backgroundColor: COLORS.primary }]}
              onPress={() => router.push('/(technician)/available-orders')}
            >
              <Text style={styles.findBtnText}>
                {isRTL ? 'تصفّح الطلبات المتاحة' : 'Browse available jobs'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick navigation */}
        <Text style={styles.sectionTitle}>{isRTL ? 'وصول سريع' : 'Quick access'}</Text>
        <View style={styles.quickRow}>
          <QuickNav
            icon="calendar-check" color="#3B82F6"
            label={isRTL ? 'جدولي' : 'My Schedule'}
            onPress={() => router.push('/(technician)/my-orders')}
            COLORS={COLORS} SHADOWS={SHADOWS}
          />
          <QuickNav
            icon="wallet" color="#10B981"
            label={isRTL ? 'الأرباح' : 'Earnings'}
            onPress={() => router.push('/(technician)/earnings')}
            COLORS={COLORS} SHADOWS={SHADOWS}
          />
          <QuickNav
            icon="account-circle" color="#8B5CF6"
            label={isRTL ? 'حسابي' : 'Profile'}
            onPress={() => router.push('/(technician)/profile')}
            COLORS={COLORS} SHADOWS={SHADOWS}
          />
        </View>

        {/* Support & help */}
        <Text style={styles.sectionTitle}>{isRTL ? 'الدعم والمساعدة' : 'Support & help'}</Text>
        <TouchableOpacity
          style={[styles.supportCard, SHADOWS.small]}
          activeOpacity={0.85}
          onPress={() => router.push('/support-chat')}
        >
          <View style={styles.supportIcon}>
            <MaterialCommunityIcons name="headset" size={22} color="#10B981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.supportTitle}>
              {isRTL ? 'تواصل مع فريق الدعم' : 'Contact the support team'}
            </Text>
            <Text style={styles.supportSub}>
              {isRTL
                ? 'واجهت مشكلة في طلب أو تحتاج مساعدة؟ راسلنا مباشرة.'
                : 'Hit a problem with a job or need help? Message us directly.'}
            </Text>
          </View>
          <RTLMaterialIcon name="chevron-right" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {/* Recent jobs */}
        <Text style={styles.sectionTitle}>{isRTL ? 'آخر المهام' : 'Recent jobs'}</Text>
        {recentJobs.length === 0 ? (
          <View style={[styles.emptyCard, SHADOWS.small]}>
            <Text style={styles.emptyText}>
              {isRTL ? 'لا يوجد سجل مهام بعد' : 'No job history yet'}
            </Text>
          </View>
        ) : (
          <View style={styles.recentList}>
            {recentJobs.map((o, i) => (
              <TouchableOpacity
                key={o.id}
                style={[styles.recentRow, i < recentJobs.length - 1 && styles.recentRowBorder]}
                onPress={() =>
                  router.push({ pathname: '/(technician)/manage-order', params: { id: o.id } })
                }
              >
                <View
                  style={[
                    styles.recentIcon,
                    { backgroundColor: (o.status === 'completed' ? COLORS.success : COLORS.error) + '18' },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={o.status === 'completed' ? 'check' : 'close'}
                    size={18}
                    color={o.status === 'completed' ? COLORS.success : COLORS.error}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentDevice} numberOfLines={1}>
                    {[o.device_brand, o.device_model].filter(Boolean).join(' ') ||
                      (isRTL ? 'طلب' : 'Job')}
                  </Text>
                  <Text style={styles.recentMeta}>
                    {(isRTL ? ORDER_STATUS_LABELS_AR : ORDER_STATUS_LABELS_EN)[o.status]}
                    {o.created_at
                      ? ` · ${new Date(o.created_at).toLocaleDateString(isRTL ? 'ar-SA' : 'en-GB')}`
                      : ''}
                  </Text>
                </View>
                <Text style={styles.recentPrice}>
                  {fmt(Number(o.final_price ?? o.estimated_price ?? 0))} {isRTL ? 'ر.س' : 'SAR'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {loading && orders.length === 0 && (
          <Text style={styles.loadingHint}>{isRTL ? 'جاري التحميل…' : 'Loading…'}</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatTile({ icon, color, label, value, COLORS, SHADOWS }: any) {
  return (
    <View style={[tileStyles(COLORS).tile, SHADOWS.small]}>
      <View style={[tileStyles(COLORS).iconWrap, { backgroundColor: color + '18' }]}>
        <MaterialCommunityIcons name={icon} size={18} color={color} />
      </View>
      <Text style={tileStyles(COLORS).value} numberOfLines={1}>{value}</Text>
      <Text style={tileStyles(COLORS).label} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function QuickNav({ icon, color, label, onPress, COLORS, SHADOWS }: any) {
  return (
    <TouchableOpacity style={[tileStyles(COLORS).quick, SHADOWS.small]} onPress={onPress} activeOpacity={0.8}>
      <View style={[tileStyles(COLORS).quickIcon, { backgroundColor: color + '18' }]}>
        <MaterialCommunityIcons name={icon} size={24} color={color} />
      </View>
      <Text style={tileStyles(COLORS).quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const tileStyles = (C: any) =>
  StyleSheet.create({
    tile: {
      width: '47%',
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.md,
      padding: 14,
    },
    iconWrap: {
      width: 34, height: 34, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    },
    value: { color: C.text, fontSize: 18, fontWeight: '800' },
    label: { color: C.textSecondary, fontSize: 12, marginTop: 2 },
    quick: {
      flex: 1,
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.md,
      paddingVertical: 16,
      alignItems: 'center',
      gap: 8,
    },
    quickIcon: {
      width: 48, height: 48, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center',
    },
    quickLabel: { color: C.text, fontSize: 13, fontWeight: '700' },
  });

const makeStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: SPACING.m,
      paddingTop: SPACING.l,
      paddingBottom: SPACING.s,
    },
    greeting: { fontSize: 21, fontWeight: '800', color: C.text, textAlign: isRTL ? 'right' : 'left' },
    greetingSub: { fontSize: 13, color: C.textSecondary, marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
    bellBtn: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: C.card, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: C.border,
    },
    statsGrid: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      flexWrap: 'wrap',
      gap: 12,
      paddingHorizontal: SPACING.m,
      paddingTop: SPACING.m,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: C.text,
      paddingHorizontal: SPACING.m,
      marginTop: SPACING.l,
      marginBottom: SPACING.s,
      textAlign: isRTL ? 'right' : 'left',
    },
    activeCard: {
      marginHorizontal: SPACING.m,
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.m,
      gap: 4,
    },
    activeTop: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 },
    statusDot: { width: 9, height: 9, borderRadius: 5 },
    activeStatus: { color: C.primary, fontWeight: '800', fontSize: 13 },
    activeDevice: { color: C.text, fontWeight: '800', fontSize: 17, marginTop: 4, textAlign: isRTL ? 'right' : 'left' },
    activeIssue: { color: C.textSecondary, fontSize: 13, lineHeight: 19, textAlign: isRTL ? 'right' : 'left' },
    activeMetaRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    activeMeta: { color: C.textSecondary, fontSize: 12, flex: 1, textAlign: isRTL ? 'right' : 'left' },
    activeActions: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10, marginTop: 12 },
    actionBtn: {
      flex: 1,
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: BORDER_RADIUS.md,
    },
    actionBtnAlt: { backgroundColor: 'transparent', borderWidth: 1 },
    actionBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
    emptyCard: {
      marginHorizontal: SPACING.m,
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.l,
      alignItems: 'center',
      gap: 10,
    },
    emptyText: { color: C.textSecondary, fontSize: 14, textAlign: 'center' },
    findBtn: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: BORDER_RADIUS.md, marginTop: 4 },
    findBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
    quickRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 12,
      paddingHorizontal: SPACING.m,
    },
    supportCard: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: SPACING.m,
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.md,
      padding: 14,
    },
    supportIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: '#10B98118',
      alignItems: 'center',
      justifyContent: 'center',
    },
    supportTitle: {
      color: C.text,
      fontSize: 14,
      fontWeight: '800',
      textAlign: isRTL ? 'right' : 'left',
    },
    supportSub: {
      color: C.textSecondary,
      fontSize: 12,
      marginTop: 2,
      textAlign: isRTL ? 'right' : 'left',
    },
    recentList: {
      marginHorizontal: SPACING.m,
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.md,
      overflow: 'hidden',
    },
    recentRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
    },
    recentRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    recentIcon: {
      width: 36, height: 36, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
    },
    recentDevice: { color: C.text, fontWeight: '700', fontSize: 14, textAlign: isRTL ? 'right' : 'left' },
    recentMeta: { color: C.textSecondary, fontSize: 11, marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
    recentPrice: { color: C.primary, fontWeight: '800', fontSize: 13 },
    loadingHint: { color: C.textSecondary, textAlign: 'center', marginTop: 20 },
  });
