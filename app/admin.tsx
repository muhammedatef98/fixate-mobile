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

interface CityInsight {
  city: string;
  orders: number;
  deliveryTotal: number;
}

interface TechLeaderRow {
  name: string;
  completed: number;
}

interface PlatformHealth {
  avgCompletionHours: number | null;
  cancellationRate: number | null; // 0..100
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
  // Operations insights (Task 5) — populated by the same loadStats pass so
  // they never lag the rest of the dashboard. Each defaults to an empty
  // shape so the cards render "—" placeholders until data arrives.
  const [topCities, setTopCities] = useState<CityInsight[]>([]);
  const [topTechs, setTopTechs] = useState<TechLeaderRow[]>([]);
  const [health, setHealth] = useState<PlatformHealth>({
    avgCompletionHours: null,
    cancellationRate: null,
  });

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

      // Operations insights — one bounded query, three derived cards.
      // We pull only the columns each card actually needs, so the
      // payload stays small even on healthy deployments.
      try {
        const ninetyDaysAgoIso = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const startOfMonthIso = new Date(
          new Date().getFullYear(),
          new Date().getMonth(),
          1
        ).toISOString();
        const { data: opsOrders } = await supabase
          .from('orders')
          .select('*')
          .gte('created_at', ninetyDaysAgoIso);
        const rows = (opsOrders ?? []) as any[];

        // ── Card 1: top 3 cities by order count (all rows in 90d) ─────
        const cityAgg: Record<string, { orders: number; deliveryTotal: number }> = {};
        for (const o of rows) {
          const city = String(o.delivery_area ?? o.city ?? o.delivery_city ?? '—');
          if (!cityAgg[city]) cityAgg[city] = { orders: 0, deliveryTotal: 0 };
          cityAgg[city].orders += 1;
          cityAgg[city].deliveryTotal += Number(o.delivery_fee ?? 0);
        }
        const topCitiesArr = Object.entries(cityAgg)
          .map(([city, v]) => ({ city, orders: v.orders, deliveryTotal: v.deliveryTotal }))
          .sort((a, b) => b.orders - a.orders)
          .slice(0, 3);

        // ── Card 2: top 3 technicians by completed orders this month ──
        const techCount: Record<string, number> = {};
        const techIdsThisMonth = new Set<string>();
        for (const o of rows) {
          if (
            o.status === 'completed' &&
            o.technician_id &&
            o.created_at &&
            o.created_at >= startOfMonthIso
          ) {
            techCount[o.technician_id] = (techCount[o.technician_id] ?? 0) + 1;
            techIdsThisMonth.add(o.technician_id);
          }
        }
        // Resolve names — one batched users lookup keyed on the ids we saw.
        let techNames: Record<string, string> = {};
        if (techIdsThisMonth.size > 0) {
          const { data: techUsers } = await supabase
            .from('users')
            .select('id, name')
            .in('id', Array.from(techIdsThisMonth));
          for (const u of (techUsers ?? []) as any[]) {
            techNames[u.id] = u.name ?? '';
          }
        }
        const topTechsArr = Object.entries(techCount)
          .map(([id, completed]) => ({ name: techNames[id] || id.slice(0, 8), completed }))
          .sort((a, b) => b.completed - a.completed)
          .slice(0, 3);

        // ── Card 3: platform health (90d window) ──────────────────────
        let completionMs = 0;
        let completionCount = 0;
        let cancelled = 0;
        for (const o of rows) {
          if (o.status === 'completed' && o.created_at && o.updated_at) {
            const a = new Date(o.created_at).getTime();
            const b = new Date(o.updated_at).getTime();
            if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
              completionMs += b - a;
              completionCount += 1;
            }
          }
          if (o.status === 'cancelled') cancelled += 1;
        }
        const avgHours =
          completionCount > 0 ? completionMs / completionCount / (1000 * 60 * 60) : null;
        const cancelRate = rows.length > 0 ? (cancelled / rows.length) * 100 : null;

        setTopCities(topCitiesArr);
        setTopTechs(topTechsArr);
        setHealth({ avgCompletionHours: avgHours, cancellationRate: cancelRate });
      } catch {
        // Cards stay on prior values / placeholders; main dashboard
        // still loaded fine.
      }

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
          <TouchableOpacity onPress={() => safeBack()} style={{ padding: 6 }}>
            <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
          </TouchableOpacity>
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
        ? `آخر تحديث ${lastRefresh.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`
        : `Updated ${lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`)
    : null;

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => safeBack('/(customer)')} style={{ padding: 6 }}>
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[s.title, { color: COLORS.text }]}>{isRTL ? 'لوحة الإدارة' : 'Admin Panel'}</Text>
        </View>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 4 }}>
          <TouchableOpacity
            onPress={() => { setRefreshing(true); loadStats(); }}
            style={{ padding: 6 }}
            accessibilityLabel={isRTL ? 'تحديث' : 'Refresh'}
          >
            <Ionicons name="refresh" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => {
              try { await signOut(); } catch {}
              router.replace('/role-selection');
            }}
            style={{ padding: 6 }}
            accessibilityLabel={isRTL ? 'تسجيل الخروج' : 'Sign out'}
          >
            <Ionicons name="log-out-outline" size={22} color="#ef4444" />
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
        {/* ── Greeting hero — admin identity + last refresh stamp ──── */}
        <View style={s.hero}>
          <View style={{ flex: 1 }}>
            <Text style={s.heroEyebrow}>
              {isRTL ? `أهلاً يا ${greetingName}` : `Welcome, ${greetingName}`}
            </Text>
            <Text style={s.heroTitle}>
              {isRTL ? 'مركز التحكم اليومي' : 'Daily control center'}
            </Text>
            <Text style={s.heroBody} numberOfLines={2}>
              {isRTL
                ? `${stats.ordersToday} طلب اليوم · ${stats.revenueToday.toLocaleString('ar-SA')} ر.س`
                : `${stats.ordersToday} orders today · ${stats.revenueToday.toLocaleString('en-US')} SAR`}
            </Text>
            {lastRefreshLabel ? (
              <View style={s.heroStamp}>
                <Ionicons name="time-outline" size={11} color={COLORS.textLight} />
                <Text style={s.heroStampText}>{lastRefreshLabel}</Text>
              </View>
            ) : null}
          </View>
          <View style={s.heroBadge}>
            <MaterialCommunityIcons name="shield-crown-outline" size={28} color={COLORS.primary} />
          </View>
        </View>

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

        {/* Revenue card — preserved verbatim, slightly elevated visually */}
        <View style={[s.revenueCard, { backgroundColor: COLORS.primary }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.revenueLabel}>
              {isRTL ? 'إجمالي الإيرادات (طلبات مكتملة)' : 'Total revenue (completed orders)'}
            </Text>
            {loading ? (
              <ActivityIndicator color="#fff" style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start', marginTop: 6 }} />
            ) : (
              <Text style={s.revenueValue}>
                {stats.revenue.toLocaleString(isRTL ? 'ar-SA' : 'en-US')} {isRTL ? 'ر.س' : 'SAR'}
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
          <MaterialCommunityIcons name="cash-multiple" size={42} color="rgba(255,255,255,0.35)" />
        </View>

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

        {/* ── Operations insights — inline data cards (Task 5) ─────── */}
        <InsightCard
          icon="map-marker-multiple-outline"
          iconColor="#0EA5A4"
          title={isRTL ? 'إيرادات بالمدينة' : 'Revenue by City'}
          subtitle={isRTL ? 'أفضل 3 مدن — آخر 90 يوم' : 'Top 3 cities — last 90 days'}
          onPress={() => router.push('/admin-reports' as any)}
          COLORS={COLORS}
          isRTL={isRTL}
          rows={
            topCities.length === 0
              ? [{ left: '—', mid: '', right: '' }]
              : topCities.map((c) => ({
                  left: c.city,
                  mid: `${c.orders} ${isRTL ? 'طلب' : 'orders'}`,
                  right: `${Math.round(c.deliveryTotal)} ${isRTL ? 'ر.س' : 'SAR'}`,
                }))
          }
        />
        <InsightCard
          icon="trophy-outline"
          iconColor="#F59E0B"
          title={isRTL ? 'أفضل الفنيين' : 'Technician Leaderboard'}
          subtitle={isRTL ? 'أكثر الفنيين إنجازاً هذا الشهر' : 'Most completed orders this month'}
          onPress={() => router.push('/admin-users' as any)}
          COLORS={COLORS}
          isRTL={isRTL}
          rows={
            topTechs.length === 0
              ? [{ left: '—', mid: '', right: '' }]
              : topTechs.map((t, i) => ({
                  left: `${i + 1}.  ${t.name}`,
                  mid: '',
                  right: `${t.completed} ${isRTL ? 'مكتمل' : 'completed'}`,
                }))
          }
        />
        <InsightCard
          icon="heart-pulse"
          iconColor="#EC4899"
          title={isRTL ? 'صحة المنصة' : 'Platform Health'}
          subtitle={isRTL ? 'نافذة 90 يوم' : '90-day window'}
          onPress={() => router.push('/admin-reports' as any)}
          COLORS={COLORS}
          isRTL={isRTL}
          rows={[
            {
              left: isRTL ? 'متوسط زمن الإنجاز' : 'Avg completion time',
              mid: '',
              right:
                health.avgCompletionHours == null
                  ? '—'
                  : `${health.avgCompletionHours.toFixed(1)} ${isRTL ? 'ساعة' : 'h'}`,
            },
            {
              left: isRTL ? 'معدل الإلغاء' : 'Cancellation rate',
              mid: '',
              right:
                health.cancellationRate == null
                  ? '—'
                  : `${health.cancellationRate.toFixed(1)}%`,
            },
          ]}
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
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: C.background,
    },
    title: { fontSize: 20, fontWeight: '800' },

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
      ...ADMIN_CARD_SHADOW,
    },
    heroEyebrow: {
      color: C.primary, fontSize: 12, fontWeight: '800',
      letterSpacing: 0.4, textTransform: 'uppercase',
      textAlign: isRTL ? 'right' : 'left',
    },
    heroTitle: {
      color: C.text, fontSize: 20, fontWeight: '900',
      marginTop: 4, letterSpacing: -0.3,
      textAlign: isRTL ? 'right' : 'left',
    },
    heroBody: {
      color: C.textSecondary, fontSize: 13, marginTop: 4, fontWeight: '600',
      textAlign: isRTL ? 'right' : 'left',
    },
    heroStamp: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center', gap: 4, marginTop: 10,
    },
    heroStampText: { color: C.textLight, fontSize: 11, fontWeight: '700' },
    heroBadge: {
      width: 56, height: 56, borderRadius: 18,
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
  });

function InsightCard({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
  rows,
  COLORS,
  isRTL,
}: {
  icon: string;
  iconColor: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  rows: { left: string; mid: string; right: string }[];
  COLORS: any;
  isRTL: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        backgroundColor: COLORS.card,
        borderRadius: BORDER_RADIUS.md,
        padding: 14,
        marginBottom: 10,
        gap: 10,
        ...ADMIN_CARD_SHADOW,
      }}
      accessibilityRole="button"
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 12,
            backgroundColor: iconColor + '20',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MaterialCommunityIcons name={icon as any} size={22} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: COLORS.text,
              fontSize: 15,
              fontWeight: '700',
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              color: COLORS.textSecondary,
              fontSize: 12,
              marginTop: 2,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {subtitle}
          </Text>
        </View>
      </View>
      <View style={{ gap: 6 }}>
        {rows.map((r, i) => (
          <View
            key={i}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
              borderTopColor: COLORS.border,
              paddingTop: i === 0 ? 0 : 6,
              gap: 8,
            }}
          >
            <Text
              style={{
                color: COLORS.text,
                fontSize: 13,
                fontWeight: '600',
                flex: 1,
                textAlign: isRTL ? 'right' : 'left',
              }}
              numberOfLines={1}
            >
              {r.left}
            </Text>
            {r.mid ? (
              <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>{r.mid}</Text>
            ) : null}
            <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '800' }}>
              {r.right}
            </Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

