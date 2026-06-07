import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useIsAdmin } from '../hooks/useAdminGuard';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';
import { AnimatedBackButton } from '../components/AnimatedBackButton';
import { supabase } from '../services/supabaseClient';
import {
  AdminSectionLabel,
  AdminStatTile,
  AdminActionCard,
  AdminAttentionBar,
  AdminQuickAction,
  AdminActivityRow,
  AdminEmptyState,
  adminTimeAgo,
  ADMIN_CARD_SHADOW,
} from '../components/admin/AdminUI';

interface Stats {
  totalUsers: number;
  totalTechnicians: number;
  totalOrders: number;
  totalListings: number;
  revenue: number;
  pendingVerifications: number;
  pendingListings: number;
  unreadThreads: number;
  // New: week-over-week deltas used as trend hints on stat tiles.
  newUsersThisWeek: number;
  newOrdersThisWeek: number;
  newListingsThisWeek: number;
  newTechniciansThisWeek: number;
  ordersToday: number;
  revenueToday: number;
}

type ActivityItem = {
  id: string;
  kind: 'order' | 'listing' | 'user' | 'technician';
  title: string;
  meta: string;
  time: string;
  raw: string; // ISO for sort
  onPress?: () => void;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user, userProfile, signOut } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const { isAdmin, checking: adminChecking } = useIsAdmin();
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0, totalTechnicians: 0, totalOrders: 0, totalListings: 0,
    revenue: 0, pendingVerifications: 0, pendingListings: 0, unreadThreads: 0,
    newUsersThisWeek: 0, newOrdersThisWeek: 0, newListingsThisWeek: 0,
    newTechniciansThisWeek: 0, ordersToday: 0, revenueToday: 0,
  });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const weekAgoIso = useMemo(() => new Date(Date.now() - WEEK_MS).toISOString(), []);
  const dayStartIso = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const loadStats = async () => {
    try {
      const [
        { count: totalUsers },
        { count: totalTechnicians },
        { count: totalOrders },
        { count: totalListings },
        { count: pendingVerifications },
        { count: pendingListings },
        { count: unreadThreads },
        { data: completed },
        // Week-over-week growth queries — each is a fast COUNT(head:true)
        // so the dashboard load stays within a single Promise.all batch.
        { count: newUsersThisWeek },
        { count: newOrdersThisWeek },
        { count: newListingsThisWeek },
        { count: newTechniciansThisWeek },
        { count: ordersToday },
        { data: completedToday },
        // Recent activity tails — five most recent of each type.
        { data: recentOrders },
        { data: recentListings },
        { data: recentUsers },
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('technicians').select('*', { count: 'exact', head: true }).eq('verification_status', 'approved'),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('market_listings').select('*', { count: 'exact', head: true }),
        supabase.from('technicians').select('*', { count: 'exact', head: true }).eq('verification_status', 'submitted'),
        supabase.from('market_listings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('support_threads').select('*', { count: 'exact', head: true }).eq('unread_for_admin', true),
        supabase.from('orders').select('final_price, estimated_price').eq('status', 'completed'),
        supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', weekAgoIso),
        supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', weekAgoIso),
        supabase.from('market_listings').select('*', { count: 'exact', head: true }).gte('created_at', weekAgoIso),
        supabase.from('technicians').select('*', { count: 'exact', head: true }).gte('created_at', weekAgoIso),
        supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', dayStartIso),
        supabase.from('orders').select('final_price, estimated_price').eq('status', 'completed').gte('created_at', dayStartIso),
        supabase
          .from('orders')
          .select('id, order_number, device_brand, device_model, status, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('market_listings')
          .select('id, title, status, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('users')
          .select('id, name, phone, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const revenue = (completed ?? []).reduce(
        (sum: number, o: any) => sum + Number(o.final_price ?? o.estimated_price ?? 0),
        0
      );
      const revenueToday = (completedToday ?? []).reduce(
        (sum: number, o: any) => sum + Number(o.final_price ?? o.estimated_price ?? 0),
        0
      );

      setStats({
        totalUsers: totalUsers ?? 0,
        totalTechnicians: totalTechnicians ?? 0,
        totalOrders: totalOrders ?? 0,
        totalListings: totalListings ?? 0,
        revenue,
        pendingVerifications: pendingVerifications ?? 0,
        pendingListings: pendingListings ?? 0,
        unreadThreads: unreadThreads ?? 0,
        newUsersThisWeek: newUsersThisWeek ?? 0,
        newOrdersThisWeek: newOrdersThisWeek ?? 0,
        newListingsThisWeek: newListingsThisWeek ?? 0,
        newTechniciansThisWeek: newTechniciansThisWeek ?? 0,
        ordersToday: ordersToday ?? 0,
        revenueToday,
      });

      // Merge the three "recent" queries into a single chronologically
      // sorted activity feed. We cap at six rows so the dashboard stays
      // glanceable instead of turning into an event log.
      const merged: ActivityItem[] = [
        ...((recentOrders ?? []) as any[]).map((o) => ({
          id: `o:${o.id}`,
          kind: 'order' as const,
          title:
            (o.order_number ? `#${o.order_number} · ` : '') +
            ([o.device_brand, o.device_model].filter(Boolean).join(' ') ||
              (isRTL ? 'طلب جديد' : 'New order')),
          meta: (isRTL ? 'الحالة: ' : 'Status: ') + o.status,
          time: adminTimeAgo(o.created_at, isRTL),
          raw: o.created_at,
          onPress: () => router.push({ pathname: '/admin-order-detail', params: { id: o.id } } as any),
        })),
        ...((recentListings ?? []) as any[]).map((l) => ({
          id: `l:${l.id}`,
          kind: 'listing' as const,
          title: l.title || (isRTL ? 'إعلان جديد' : 'New listing'),
          meta: (isRTL ? 'الحالة: ' : 'Status: ') + l.status,
          time: adminTimeAgo(l.created_at, isRTL),
          raw: l.created_at,
          onPress: () => router.push('/admin-market' as any),
        })),
        ...((recentUsers ?? []) as any[]).map((u) => ({
          id: `u:${u.id}`,
          kind: 'user' as const,
          title: u.name || u.phone || (isRTL ? 'مستخدم جديد' : 'New user'),
          meta: u.phone || '',
          time: adminTimeAgo(u.created_at, isRTL),
          raw: u.created_at,
          onPress: () => router.push('/admin-users' as any),
        })),
      ]
        .filter((x) => x.raw)
        .sort((a, b) => new Date(b.raw).getTime() - new Date(a.raw).getTime())
        .slice(0, 6);
      setActivity(merged);
      setLastRefresh(new Date());
    } catch {
      // non-fatal — keep prior data on screen
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadStats();
  }, [isAdmin]);

  const s = styles(COLORS, isRTL);

  if (adminChecking) {
    return (
      <SafeAreaView style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <AnimatedBackButton
            onPress={() => safeBack()}
            color={COLORS.text}
            backgroundColor={COLORS.surface ?? COLORS.background}
            size={42}
            iconSize={22}
            rtl
            accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
          />
          <Text style={[s.title, { color: COLORS.text }]}>{isRTL ? 'الإدارة' : 'Admin'}</Text>
          <View style={{ width: 32 }} />
        </View>
        <AdminEmptyState
          variant="error"
          icon="shield-alert-outline"
          title={isRTL ? 'غير مصرّح' : 'Unauthorized'}
          body={isRTL ? 'هذه الصفحة للأدمن فقط' : 'This page is restricted to admins'}
        />
      </SafeAreaView>
    );
  }

  // Total items needing the admin's attention right now. Drives the
  // attention bar visibility above the stats.
  const needsAttention =
    (stats.pendingVerifications ?? 0) +
    (stats.pendingListings ?? 0) +
    (stats.unreadThreads ?? 0);

  // Pick the most pressing destination for the attention bar's CTA.
  const attentionTarget =
    stats.unreadThreads > 0 ? '/admin-support'
      : stats.pendingVerifications > 0 ? '/admin-verifications'
      : '/admin-market';

  const greetingName =
    (userProfile as any)?.name?.split(' ')[0] ||
    (user?.email ? user.email.split('@')[0] : '') ||
    (isRTL ? 'الأدمن' : 'admin');

  const lastRefreshLabel = lastRefresh
    ? (isRTL
        ? `آخر تحديث ${lastRefresh.toLocaleTimeString('ar-SA-u-ca-gregory', { hour: '2-digit', minute: '2-digit' })}`
        : `Updated ${lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`)
    : null;

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[s.header, { borderBottomColor: COLORS.border, backgroundColor: COLORS.card }]}>
        <AnimatedBackButton
          onPress={() => safeBack('/(customer)')}
          color={COLORS.text}
          backgroundColor={COLORS.background}
          size={42}
          iconSize={22}
          rtl
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
        />
        <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 8 }}>
          <Text style={[s.title, { color: COLORS.text }]}>
            {isRTL ? 'لوحة الإدارة' : 'Admin Panel'}
          </Text>
          {lastRefreshLabel ? (
            <Text style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: '600', marginTop: 1 }}>
              {lastRefreshLabel}
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 6 }}>
          <TouchableOpacity
            onPress={() => { setRefreshing(true); loadStats(); }}
            style={[s.headerBtn, { backgroundColor: COLORS.primary + '15' }]}
            accessibilityLabel={isRTL ? 'تحديث' : 'Refresh'}
          >
            <Ionicons name="refresh" size={18} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => {
              try { await signOut(); } catch {}
              router.replace('/role-selection');
            }}
            style={[s.headerBtn, { backgroundColor: '#ef444415' }]}
            accessibilityLabel={isRTL ? 'تسجيل الخروج' : 'Sign out'}
          >
            <Ionicons name="log-out-outline" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.m, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadStats(); }}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* ── Greeting hero — admin identity + key today metrics ──── */}
        <TouchableOpacity
          onPress={() => router.push('/admin-reports' as any)}
          activeOpacity={0.9}
          style={s.hero}
        >
          <View style={[s.heroAccent, { backgroundColor: COLORS.primary }]} />
          <View style={{ flex: 1 }}>
            <Text style={s.heroEyebrow}>
              {isRTL ? `أهلاً يا ${greetingName}` : `Welcome, ${greetingName}`}
            </Text>
            <Text style={s.heroTitle}>
              {isRTL ? 'مركز التحكم اليومي' : 'Daily control center'}
            </Text>

            <View style={s.heroMetrics}>
              <View style={s.heroMetric}>
                <Text style={s.heroMetricValue}>{stats.ordersToday}</Text>
                <Text style={s.heroMetricLabel}>{isRTL ? 'طلبات اليوم' : 'Orders today'}</Text>
              </View>
              <View style={[s.heroDivider, { backgroundColor: COLORS.border }]} />
              <View style={s.heroMetric}>
                <Text style={s.heroMetricValue}>
                  {stats.revenueToday.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
                </Text>
                <Text style={s.heroMetricLabel}>{isRTL ? 'إيرادات اليوم (ر.س)' : "Today's revenue (SAR)"}</Text>
              </View>
            </View>
          </View>
          <View style={s.heroBadge}>
            <MaterialCommunityIcons name="shield-crown-outline" size={26} color={COLORS.primary} />
          </View>
        </TouchableOpacity>

        {/* ── Needs attention alert ───────────────────────────────── */}
        <AdminAttentionBar
          count={needsAttention}
          title={
            isRTL
              ? `${needsAttention} عناصر تحتاج مراجعتك`
              : `${needsAttention} items need your attention`
          }
          body={
            [
              stats.pendingVerifications > 0
                ? (isRTL ? `${stats.pendingVerifications} طلبات فنيين` : `${stats.pendingVerifications} technician applications`)
                : null,
              stats.pendingListings > 0
                ? (isRTL ? `${stats.pendingListings} إعلانات معلّقة` : `${stats.pendingListings} pending listings`)
                : null,
              stats.unreadThreads > 0
                ? (isRTL ? `${stats.unreadThreads} رسائل دعم` : `${stats.unreadThreads} unread support threads`)
                : null,
            ].filter(Boolean).join(' · ')
          }
          ctaLabel={isRTL ? 'مراجعة' : 'Review'}
          onPress={() => router.push(attentionTarget as any)}
        />

        {/* ── Quick action shortcuts — single tap to the most-used flows */}
        <AdminSectionLabel
          icon="flash-outline"
          text={isRTL ? 'إجراءات سريعة' : 'Quick actions'}
        />
        <View style={s.quickRow}>
          <AdminQuickAction
            icon="account-check-outline"
            label={isRTL ? 'الفنيون' : 'Technicians'}
            badge={stats.pendingVerifications}
            color="#8b5cf6"
            onPress={() => router.push('/admin-verifications' as any)}
          />
          <AdminQuickAction
            icon="storefront-check-outline"
            label={isRTL ? 'الإعلانات' : 'Listings'}
            badge={stats.pendingListings}
            color="#f59e0b"
            onPress={() => router.push('/admin-market' as any)}
          />
          <AdminQuickAction
            icon="forum-outline"
            label={isRTL ? 'الدعم' : 'Support'}
            badge={stats.unreadThreads}
            color="#06b6d4"
            onPress={() => router.push('/admin-support' as any)}
          />
          <AdminQuickAction
            icon="bullhorn-outline"
            label={isRTL ? 'إشعار' : 'Broadcast'}
            color="#ec4899"
            onPress={() => router.push('/admin-broadcasts' as any)}
          />
        </View>

        {/* ── Platform Overview — preserved exactly, with new trend hints */}
        <AdminSectionLabel
          icon="view-dashboard-outline"
          text={isRTL ? 'نظرة عامة على المنصة' : 'Platform Overview'}
          hint={isRTL ? 'آخر 7 أيام' : 'last 7 days'}
        />
        <View style={s.statsGrid}>
          <AdminStatTile
            icon="account-multiple" label={isRTL ? 'المستخدمون' : 'Users'}
            value={stats.totalUsers.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
            color="#10b981" loading={loading}
            hint={stats.newUsersThisWeek > 0
              ? (isRTL ? `+${stats.newUsersThisWeek} هذا الأسبوع` : `+${stats.newUsersThisWeek} this week`)
              : undefined}
            onPress={() => router.push('/admin-users' as any)}
          />
          <AdminStatTile
            icon="account-wrench" label={isRTL ? 'الفنيون' : 'Technicians'}
            value={stats.totalTechnicians.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
            color="#8b5cf6" loading={loading}
            hint={stats.newTechniciansThisWeek > 0
              ? (isRTL ? `+${stats.newTechniciansThisWeek} هذا الأسبوع` : `+${stats.newTechniciansThisWeek} this week`)
              : undefined}
            onPress={() => router.push('/admin-verifications' as any)}
          />
          <AdminStatTile
            icon="clipboard-text" label={isRTL ? 'الطلبات' : 'Orders'}
            value={stats.totalOrders.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
            color="#3b82f6" loading={loading}
            hint={stats.newOrdersThisWeek > 0
              ? (isRTL ? `+${stats.newOrdersThisWeek} هذا الأسبوع` : `+${stats.newOrdersThisWeek} this week`)
              : undefined}
            onPress={() => router.push('/admin-orders' as any)}
          />
          <AdminStatTile
            icon="storefront" label={isRTL ? 'الإعلانات' : 'Listings'}
            value={stats.totalListings.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
            color="#f59e0b" loading={loading}
            hint={stats.newListingsThisWeek > 0
              ? (isRTL ? `+${stats.newListingsThisWeek} هذا الأسبوع` : `+${stats.newListingsThisWeek} this week`)
              : undefined}
            onPress={() => router.push('/admin-market' as any)}
          />
        </View>

        {/* Revenue card — tappable, drills into reports */}
        <TouchableOpacity
          onPress={() => router.push('/admin-reports' as any)}
          activeOpacity={0.9}
          style={[s.revenueCard, { backgroundColor: COLORS.primary }]}
        >
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
              <Text style={s.revenueLabel}>
                {isRTL ? 'إجمالي الإيرادات' : 'Total revenue'}
              </Text>
              <View style={s.revenueChip}>
                <Text style={s.revenueChipText}>
                  {isRTL ? 'مكتملة' : 'Completed'}
                </Text>
              </View>
            </View>
            {loading ? (
              <ActivityIndicator
                color="#fff"
                style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start', marginTop: 6 }}
              />
            ) : (
              <Text style={s.revenueValue}>
                {stats.revenue.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}{' '}
                <Text style={{ fontSize: 14, fontWeight: '700' }}>
                  {isRTL ? 'ر.س' : 'SAR'}
                </Text>
              </Text>
            )}
            {stats.revenueToday > 0 && !loading ? (
              <Text style={s.revenueSub}>
                {isRTL
                  ? `+${stats.revenueToday.toLocaleString('ar-SA')} ر.س اليوم`
                  : `+${stats.revenueToday.toLocaleString('en-US')} SAR today`}
              </Text>
            ) : null}
          </View>
          <View style={s.revenueIconWrap}>
            <MaterialCommunityIcons name="cash-multiple" size={28} color="#fff" />
          </View>
        </TouchableOpacity>

        {/* ── Recent activity feed (new) ──────────────────────────── */}
        {activity.length > 0 ? (
          <>
            <AdminSectionLabel
              icon="pulse"
              text={isRTL ? 'النشاط الأخير' : 'Recent activity'}
            />
            {activity.map((a) => (
              <AdminActivityRow
                key={a.id}
                icon={
                  a.kind === 'order' ? 'clipboard-text-outline'
                    : a.kind === 'listing' ? 'storefront-outline'
                    : a.kind === 'technician' ? 'account-wrench-outline'
                    : 'account-plus-outline'
                }
                iconColor={
                  a.kind === 'order' ? '#3b82f6'
                    : a.kind === 'listing' ? '#f59e0b'
                    : a.kind === 'technician' ? '#8b5cf6'
                    : '#10b981'
                }
                title={a.title}
                meta={a.meta}
                time={a.time}
                onPress={a.onPress}
              />
            ))}
          </>
        ) : null}

        {/* ── Operations — every existing action card preserved ──── */}
        <AdminSectionLabel icon="cog-outline" text={isRTL ? 'العمليات' : 'Operations'} />
        <AdminActionCard
          icon="account-check" iconColor="#8b5cf6"
          title={isRTL ? 'إدارة الفنيين' : 'Technician Management'}
          subtitle={isRTL ? 'مراجعة الطلبات وتفعيل الفني المتنقل' : 'Review applications, toggle mobile technicians'}
          badge={stats.pendingVerifications}
          onPress={() => router.push('/admin-verifications')}
        />
        <AdminActionCard
          icon="clipboard-list-outline" iconColor="#3b82f6"
          title={isRTL ? 'إدارة الطلبات' : 'Orders Management'}
          subtitle={isRTL ? 'متابعة جميع طلبات الإصلاح وحالاتها' : 'Track all repair orders and their status'}
          onPress={() => router.push('/admin-orders')}
        />
        <AdminActionCard
          icon="storefront-outline" iconColor="#f59e0b"
          title={isRTL ? 'إعلانات السوق' : 'Market Listings'}
          subtitle={isRTL ? 'الموافقة على الإعلانات المعلّقة أو رفضها' : 'Approve or reject pending listings'}
          badge={stats.pendingListings}
          onPress={() => router.push('/admin-market')}
        />
        <AdminActionCard
          icon="account-group-outline" iconColor="#10b981"
          title={isRTL ? 'إدارة المستخدمين' : 'User Management'}
          subtitle={isRTL ? 'تصفّح وبحث في جميع حسابات المستخدمين' : 'Browse and search all user accounts'}
          onPress={() => router.push('/admin-users')}
        />
        <AdminActionCard
          icon="chart-box-outline" iconColor="#0ea5a4"
          title={isRTL ? 'التقارير' : 'Reports'}
          subtitle={isRTL ? 'الإيرادات، الطلبات، الفنيون، السوق، الخصومات' : 'Revenue, orders, technicians, market, discounts'}
          onPress={() => router.push('/admin-reports' as any)}
        />
        <AdminActionCard
          icon="star-outline" iconColor="#f59e0b"
          title={isRTL ? 'التقييمات والتعليقات' : 'Ratings & Reviews'}
          subtitle={isRTL ? 'متابعة تقييمات العملاء للفنيين' : 'Review customer ratings of technicians'}
          onPress={() => router.push('/admin-ratings' as any)}
        />
        <AdminActionCard
          icon="map-marker-radius" iconColor="#06b6d4"
          title={isRTL ? 'مناطق الخدمة' : 'Service Areas'}
          subtitle={isRTL ? 'إدارة المناطق، المدن، الأحياء ورسوم التوصيل' : 'Manage regions, cities, neighborhoods & delivery fees'}
          onPress={() => router.push('/admin-service-areas' as any)}
        />

        {/* ── Communication ───────────────────────────────────────── */}
        <AdminSectionLabel icon="message-text-outline" text={isRTL ? 'التواصل' : 'Communication'} />
        <AdminActionCard
          icon="forum-outline" iconColor="#06b6d4"
          title={isRTL ? 'صندوق الدعم' : 'Support inbox'}
          subtitle={isRTL ? 'محادثات الدعم مع العملاء' : 'Support conversations with customers'}
          badge={stats.unreadThreads}
          onPress={() => router.push('/admin-support')}
        />
        <AdminActionCard
          icon="bullhorn-outline" iconColor="#ec4899"
          title={isRTL ? 'الإشعارات العامة' : 'Broadcasts'}
          subtitle={isRTL ? 'إرسال إشعار لجميع المستخدمين' : 'Send a notification to all users'}
          onPress={() => router.push('/admin-broadcasts' as any)}
        />

        {/* ── Configuration ───────────────────────────────────────── */}
        <AdminSectionLabel icon="tune-variant" text={isRTL ? 'الإعدادات' : 'Configuration'} />
        <AdminActionCard
          icon="tune-vertical" iconColor="#6366f1"
          title={isRTL ? 'إعدادات المنصة' : 'Platform Settings'}
          subtitle={isRTL ? 'الرسوم، العمولة، وضع الصيانة، الإعلانات' : 'Fees, commission, maintenance mode, announcements'}
          onPress={() => router.push('/admin-platform-settings')}
        />
        <AdminActionCard
          icon="ticket-percent-outline" iconColor="#f59e0b"
          title={isRTL ? 'أكواد الخصم' : 'Discount codes'}
          subtitle={isRTL ? 'إنشاء وإدارة الأكواد الترويجية' : 'Create and manage promo codes'}
          onPress={() => router.push('/admin-discount-codes')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
    },
    headerBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },

    hero: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.lg,
      padding: 18,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: C.border,
      overflow: 'hidden',
      position: 'relative',
      ...ADMIN_CARD_SHADOW,
    },
    heroAccent: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      [isRTL ? 'right' : 'left']: 0,
      width: 3,
    },
    heroEyebrow: {
      color: C.primary, fontSize: 11, fontWeight: '800',
      letterSpacing: 0.4, textTransform: 'uppercase',
      textAlign: isRTL ? 'right' : 'left',
    },
    heroTitle: {
      color: C.text, fontSize: 20, fontWeight: '900',
      marginTop: 3, letterSpacing: -0.3,
      textAlign: isRTL ? 'right' : 'left',
    },
    heroMetrics: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 14,
      marginTop: 12,
    },
    heroMetric: { gap: 2 },
    heroMetricValue: {
      color: C.text, fontSize: 18, fontWeight: '900', letterSpacing: -0.3,
      textAlign: isRTL ? 'right' : 'left',
    },
    heroMetricLabel: {
      color: C.textSecondary, fontSize: 10.5, fontWeight: '700',
      textAlign: isRTL ? 'right' : 'left',
    },
    heroDivider: { width: 1, height: 30 },
    heroBadge: {
      width: 52, height: 52, borderRadius: 16,
      backgroundColor: C.primarySoft,
      alignItems: 'center', justifyContent: 'center',
    },

    quickRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 10,
    },

    statsGrid: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    revenueCard: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: BORDER_RADIUS.md,
      padding: 18,
      marginTop: 14,
      gap: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 14,
      elevation: 4,
    },
    revenueLabel: {
      color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700',
      textAlign: isRTL ? 'right' : 'left',
    },
    revenueValue: {
      color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 4,
      letterSpacing: -0.4,
      textAlign: isRTL ? 'right' : 'left',
    },
    revenueSub: {
      color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '700', marginTop: 4,
      textAlign: isRTL ? 'right' : 'left',
    },
    revenueChip: {
      backgroundColor: 'rgba(255,255,255,0.18)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
    },
    revenueChipText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
    revenueIconWrap: {
      width: 52, height: 52, borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center', justifyContent: 'center',
    },
  });


