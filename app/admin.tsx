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
  newUsersThisWeek: number;
  newOrdersThisWeek: number;
  newListingsThisWeek: number;
  newTechniciansThisWeek: number;
  ordersToday: number;
  revenueToday: number;
  // New
  pendingOrders: number;
  unassignedPendingOrders: number;
  techniciansOnline: number;
  techniciansOffline: number;
  revenueThisMonth: number;
}

type ActivityItem = {
  id: string;
  kind: 'order' | 'listing' | 'user' | 'technician';
  title: string;
  meta: string;
  time: string;
  raw: string;
  onPress?: () => void;
};

type RecentOrderRow = {
  id: string;
  order_number: string | null;
  device_brand: string | null;
  device_model: string | null;
  status: string;
  created_at: string;
  customer_name: string;
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
    pendingOrders: 0, unassignedPendingOrders: 0,
    techniciansOnline: 0, techniciansOffline: 0, revenueThisMonth: 0,
  });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [recentOrdersDetailed, setRecentOrdersDetailed] = useState<RecentOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const weekAgoIso = useMemo(() => new Date(Date.now() - WEEK_MS).toISOString(), []);
  const dayStartIso = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
  }, []);
  const monthStartIso = useMemo(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.toISOString();
  }, []);
  const onlineCutoffIso = useMemo(() =>
    new Date(Date.now() - 5 * 60 * 1000).toISOString()
  , []);

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
        { count: newUsersThisWeek },
        { count: newOrdersThisWeek },
        { count: newListingsThisWeek },
        { count: newTechniciansThisWeek },
        { count: ordersToday },
        { data: completedToday },
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
        supabase.from('orders').select('id, order_number, device_brand, device_model, status, created_at, user_id').order('created_at', { ascending: false }).limit(5),
        supabase.from('market_listings').select('id, title, status, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('users').select('id, name, phone, created_at').order('created_at', { ascending: false }).limit(5),
      ]);

      const revenue = (completed ?? []).reduce(
        (sum: number, o: any) => sum + Number(o.final_price ?? o.estimated_price ?? 0), 0
      );
      const revenueToday = (completedToday ?? []).reduce(
        (sum: number, o: any) => sum + Number(o.final_price ?? o.estimated_price ?? 0), 0
      );

      // ── Second pass: new metrics ──────────────────────────────────
      const [
        { count: pendingOrders },
        { count: unassignedPendingOrders },
        { count: techniciansOnline },
        { data: completedThisMonth },
      ] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending').is('technician_id', null),
        supabase.from('technician_locations').select('*', { count: 'exact', head: true }).gte('updated_at', onlineCutoffIso),
        supabase.from('orders').select('final_price, estimated_price').eq('status', 'completed').gte('created_at', monthStartIso),
      ]);

      const revenueThisMonth = (completedThisMonth ?? []).reduce(
        (sum: number, o: any) => sum + Number(o.final_price ?? o.estimated_price ?? 0), 0
      );

      // Resolve customer names for the recent orders strip
      const orderRows = (recentOrders ?? []) as any[];
      const userIds = [...new Set(orderRows.map((o) => o.user_id).filter(Boolean))] as string[];
      let nameMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: uRows } = await supabase.from('users').select('id, name').in('id', userIds);
        for (const u of (uRows ?? []) as any[]) nameMap[u.id] = u.name ?? '';
      }
      const detailedOrders: RecentOrderRow[] = orderRows.map((o) => ({
        id: o.id,
        order_number: o.order_number ?? null,
        device_brand: o.device_brand ?? null,
        device_model: o.device_model ?? null,
        status: o.status,
        created_at: o.created_at,
        customer_name: nameMap[o.user_id] ?? '',
      }));
      setRecentOrdersDetailed(detailedOrders);

      // Total online vs offline (approved techs)
      const totalApproved = totalTechnicians ?? 0;
      const online = techniciansOnline ?? 0;
      const offline = Math.max(0, totalApproved - online);

      setStats({
        totalUsers: totalUsers ?? 0,
        totalTechnicians: totalApproved,
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
        pendingOrders: pendingOrders ?? 0,
        unassignedPendingOrders: unassignedPendingOrders ?? 0,
        techniciansOnline: online,
        techniciansOffline: offline,
        revenueThisMonth,
      });

      const merged: ActivityItem[] = [
        ...((recentOrders ?? []) as any[]).map((o) => ({
          id: `o:${o.id}`, kind: 'order' as const,
          title: (o.order_number ? `#${o.order_number} · ` : '') + ([o.device_brand, o.device_model].filter(Boolean).join(' ') || (isRTL ? 'طلب جديد' : 'New order')),
          meta: (isRTL ? 'الحالة: ' : 'Status: ') + o.status,
          time: adminTimeAgo(o.created_at, isRTL), raw: o.created_at,
          onPress: () => router.push({ pathname: '/admin-order-detail', params: { id: o.id } } as any),
        })),
        ...((recentListings ?? []) as any[]).map((l) => ({
          id: `l:${l.id}`, kind: 'listing' as const,
          title: l.title || (isRTL ? 'إعلان جديد' : 'New listing'),
          meta: (isRTL ? 'الحالة: ' : 'Status: ') + l.status,
          time: adminTimeAgo(l.created_at, isRTL), raw: l.created_at,
          onPress: () => router.push('/admin-market' as any),
        })),
        ...((recentUsers ?? []) as any[]).map((u) => ({
          id: `u:${u.id}`, kind: 'user' as const,
          title: u.name || u.phone || (isRTL ? 'مستخدم جديد' : 'New user'),
          meta: u.phone || '', time: adminTimeAgo(u.created_at, isRTL), raw: u.created_at,
          onPress: () => router.push('/admin-users' as any),
        })),
      ].filter((x) => x.raw).sort((a, b) => new Date(b.raw).getTime() - new Date(a.raw).getTime()).slice(0, 6);
      setActivity(merged);
      setLastRefresh(new Date());
    } catch { /* keep prior data */ } finally {
      setLoading(false); setRefreshing(false);
    }
  };

  useEffect(() => { if (isAdmin) loadStats(); }, [isAdmin]);

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
        <AdminEmptyState variant="error" icon="shield-alert-outline"
          title={isRTL ? 'غير مصرّح' : 'Unauthorized'}
          body={isRTL ? 'هذه الصفحة للأدمن فقط' : 'This page is restricted to admins'}
        />
      </SafeAreaView>
    );
  }

  const needsAttention = (stats.pendingVerifications ?? 0) + (stats.pendingListings ?? 0) + (stats.unreadThreads ?? 0);
  const attentionTarget = stats.unreadThreads > 0 ? '/admin-support' : stats.pendingVerifications > 0 ? '/admin-verifications' : '/admin-market';
  const greetingName = (userProfile as any)?.name?.split(' ')[0] || (user?.email ? user.email.split('@')[0] : '') || (isRTL ? 'الأدمن' : 'admin');
  const lastRefreshLabel = lastRefresh
    ? (isRTL
      ? `آخر تحديث ${lastRefresh.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`
      : `Updated ${lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`)
    : null;

  const onlinePercent = (stats.techniciansOnline + stats.techniciansOffline) > 0
    ? Math.round((stats.techniciansOnline / (stats.techniciansOnline + stats.techniciansOffline)) * 100)
    : 0;

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
          <TouchableOpacity onPress={() => { setRefreshing(true); loadStats(); }} style={{ padding: 6 }}>
            <Ionicons name="refresh" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={async () => { try { await signOut(); } catch {} router.replace('/role-selection'); }} style={{ padding: 6 }}>
            <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.m, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadStats(); }} tintColor={COLORS.primary} />}
      >
        {/* Hero */}
        <View style={s.hero}>
          <View style={{ flex: 1 }}>
            <Text style={s.heroEyebrow}>{isRTL ? `أهلاً يا ${greetingName}` : `Welcome, ${greetingName}`}</Text>
            <Text style={s.heroTitle}>{isRTL ? 'مركز التحكم اليومي' : 'Daily control center'}</Text>
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

        {/* ── NEW: Unassigned orders alert ──────────────────────── */}
        {stats.unassignedPendingOrders > 0 && (
          <TouchableOpacity
            style={s.alertBanner}
            onPress={() => router.push('/admin-orders' as any)}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
              <View style={s.alertDot} />
              <Text style={s.alertText}>
                {isRTL
                  ? `${stats.unassignedPendingOrders} طلبات جديدة بدون فني — اضغط للمراجعة`
                  : `${stats.unassignedPendingOrders} new unassigned orders — tap to review`}
              </Text>
            </View>
            <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color="#fff" />
          </TouchableOpacity>
        )}

        {/* ── NEW: Quick stats bar ──────────────────────────────── */}
        <View style={s.quickStatsRow}>
          <QuickStat
            label={isRTL ? 'طلبات اليوم' : 'Orders today'}
            value={String(stats.ordersToday)}
            color="#3b82f6" COLORS={COLORS} isRTL={isRTL}
          />
          <QuickStat
            label={isRTL ? 'فنيون أونلاين' : 'Techs online'}
            value={String(stats.techniciansOnline)}
            color="#10b981" COLORS={COLORS} isRTL={isRTL}
          />
          <QuickStat
            label={isRTL ? 'طلبات معلّقة' : 'Pending'}
            value={String(stats.pendingOrders)}
            color="#f59e0b" COLORS={COLORS} isRTL={isRTL}
          />
          <QuickStat
            label={isRTL ? 'إيرادات الشهر' : 'Revenue MTD'}
            value={`${stats.revenueThisMonth.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}`}
            color="#8b5cf6" COLORS={COLORS} isRTL={isRTL}
          />
        </View>

        {/* ── NEW: Technician online summary ────────────────────── */}
        <View style={[s.onlineSummary, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
            <View style={[s.onlineDot, { backgroundColor: '#10b981' }]} />
            <Text style={[s.onlineTitle, { color: COLORS.text }]}>
              {isRTL ? 'حالة الفنيين' : 'Technician Status'}
            </Text>
          </View>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 16, marginTop: 8 }}>
            <Text style={{ color: '#10b981', fontWeight: '800', fontSize: 14 }}>
              {stats.techniciansOnline} {isRTL ? 'أونلاين' : 'online'}
            </Text>
            <Text style={{ color: COLORS.textSecondary, fontWeight: '700', fontSize: 14 }}>
              {stats.techniciansOffline} {isRTL ? 'أوفلاين' : 'offline'}
            </Text>
            <View style={[s.onlinePill, { backgroundColor: '#10b981' + '20' }]}>
              <Text style={{ color: '#10b981', fontWeight: '800', fontSize: 12 }}>{onlinePercent}%</Text>
            </View>
          </View>
        </View>

        {/* ── NEW: Recent orders strip ─────────────────────────── */}
        {recentOrdersDetailed.length > 0 && (
          <>
            <AdminSectionLabel icon="receipt-outline" text={isRTL ? 'آخر الطلبات' : 'Recent orders'} />
            {recentOrdersDetailed.map((o) => {
              const tone = statusTone(o.status);
              return (
                <TouchableOpacity
                  key={o.id}
                  style={[s.recentOrderRow, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}
                  onPress={() => router.push({ pathname: '/admin-order-detail', params: { id: o.id } } as any)}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.recentOrderTitle, { color: COLORS.text }]} numberOfLines={1}>
                      {[o.device_brand, o.device_model].filter(Boolean).join(' ') || (isRTL ? 'طلب' : 'Order')}
                      {o.order_number ? `  ·  #${o.order_number}` : ''}
                    </Text>
                    {o.customer_name ? (
                      <Text style={[s.recentOrderMeta, { color: COLORS.textSecondary }]}>{o.customer_name}</Text>
                    ) : null}
                  </View>
                  <View style={{ alignItems: isRTL ? 'flex-start' : 'flex-end', gap: 4 }}>
                    <View style={[s.statusChip, { backgroundColor: tone + '22' }]}>
                      <Text style={{ color: tone, fontSize: 11, fontWeight: '800' }}>
                        {localizedStatus(o.status, isRTL)}
                      </Text>
                    </View>
                    <Text style={{ color: COLORS.textLight, fontSize: 11 }}>
                      {adminTimeAgo(o.created_at, isRTL)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* Attention bar */}
        <AdminAttentionBar
          count={needsAttention}
          title={isRTL ? `${needsAttention} عناصر تحتاج مراجعتك` : `${needsAttention} items need your attention`}
          body={[
            stats.pendingVerifications > 0 ? (isRTL ? `${stats.pendingVerifications} طلبات فنيين` : `${stats.pendingVerifications} technician applications`) : null,
            stats.pendingListings > 0 ? (isRTL ? `${stats.pendingListings} إعلانات معلّقة` : `${stats.pendingListings} pending listings`) : null,
            stats.unreadThreads > 0 ? (isRTL ? `${stats.unreadThreads} رسائل دعم` : `${stats.unreadThreads} unread support threads`) : null,
          ].filter(Boolean).join(' · ')}
          ctaLabel={isRTL ? 'مراجعة' : 'Review'}
          onPress={() => router.push(attentionTarget as any)}
        />

        {/* Quick actions */}
        <AdminSectionLabel icon="flash-outline" text={isRTL ? 'إجراءات سريعة' : 'Quick actions'} />
        <View style={s.quickRow}>
          <AdminQuickAction icon="account-check-outline" label={isRTL ? 'الفنيون' : 'Technicians'} badge={stats.pendingVerifications} color="#8b5cf6" onPress={() => router.push('/admin-verifications' as any)} />
          <AdminQuickAction icon="storefront-check-outline" label={isRTL ? 'الإعلانات' : 'Listings'} badge={stats.pendingListings} color="#f59e0b" onPress={() => router.push('/admin-market' as any)} />
          <AdminQuickAction icon="forum-outline" label={isRTL ? 'الدعم' : 'Support'} badge={stats.unreadThreads} color="#06b6d4" onPress={() => router.push('/admin-support' as any)} />
          <AdminQuickAction icon="bullhorn-outline" label={isRTL ? 'إشعار' : 'Broadcast'} color="#ec4899" onPress={() => router.push('/admin-broadcasts' as any)} />
        </View>

        {/* Platform Overview */}
        <AdminSectionLabel icon="view-dashboard-outline" text={isRTL ? 'نظرة عامة على المنصة' : 'Platform Overview'} hint={isRTL ? 'آخر 7 أيام' : 'last 7 days'} />
        <View style={s.statsGrid}>
          <AdminStatTile icon="account-multiple" label={isRTL ? 'المستخدمون' : 'Users'} value={stats.totalUsers.toLocaleString(isRTL ? 'ar-SA' : 'en-US')} color="#10b981" loading={loading} hint={stats.newUsersThisWeek > 0 ? (isRTL ? `+${stats.newUsersThisWeek} هذا الأسبوع` : `+${stats.newUsersThisWeek} this week`) : undefined} onPress={() => router.push('/admin-users' as any)} />
          <AdminStatTile icon="account-wrench" label={isRTL ? 'الفنيون' : 'Technicians'} value={stats.totalTechnicians.toLocaleString(isRTL ? 'ar-SA' : 'en-US')} color="#8b5cf6" loading={loading} hint={stats.newTechniciansThisWeek > 0 ? (isRTL ? `+${stats.newTechniciansThisWeek} هذا الأسبوع` : `+${stats.newTechniciansThisWeek} this week`) : undefined} onPress={() => router.push('/admin-verifications' as any)} />
          <AdminStatTile icon="clipboard-text" label={isRTL ? 'الطلبات' : 'Orders'} value={stats.totalOrders.toLocaleString(isRTL ? 'ar-SA' : 'en-US')} color="#3b82f6" loading={loading} hint={stats.newOrdersThisWeek > 0 ? (isRTL ? `+${stats.newOrdersThisWeek} هذا الأسبوع` : `+${stats.newOrdersThisWeek} this week`) : undefined} onPress={() => router.push('/admin-orders' as any)} />
          <AdminStatTile icon="storefront" label={isRTL ? 'الإعلانات' : 'Listings'} value={stats.totalListings.toLocaleString(isRTL ? 'ar-SA' : 'en-US')} color="#f59e0b" loading={loading} hint={stats.newListingsThisWeek > 0 ? (isRTL ? `+${stats.newListingsThisWeek} هذا الأسبوع` : `+${stats.newListingsThisWeek} this week`) : undefined} onPress={() => router.push('/admin-market' as any)} />
        </View>

        {/* Revenue card */}
        <View style={[s.revenueCard, { backgroundColor: COLORS.primary }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.revenueLabel}>{isRTL ? 'إجمالي الإيرادات (طلبات مكتملة)' : 'Total revenue (completed orders)'}</Text>
            {loading ? <ActivityIndicator color="#fff" style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start', marginTop: 6 }} /> : (
              <Text style={s.revenueValue}>{stats.revenue.toLocaleString(isRTL ? 'ar-SA' : 'en-US')} {isRTL ? 'ر.س' : 'SAR'}</Text>
            )}
            {stats.revenueToday > 0 && !loading ? (
              <Text style={s.revenueSub}>{isRTL ? `+${stats.revenueToday.toLocaleString('ar-SA')} ر.س اليوم` : `+${stats.revenueToday.toLocaleString('en-US')} SAR today`}</Text>
            ) : null}
          </View>
          <MaterialCommunityIcons name="cash-multiple" size={42} color="rgba(255,255,255,0.35)" />
        </View>

        {/* Activity feed */}
        {activity.length > 0 ? (
          <>
            <AdminSectionLabel icon="pulse" text={isRTL ? 'النشاط الأخير' : 'Recent activity'} />
            {activity.map((a) => (
              <AdminActivityRow key={a.id}
                icon={a.kind === 'order' ? 'clipboard-text-outline' : a.kind === 'listing' ? 'storefront-outline' : a.kind === 'technician' ? 'account-wrench-outline' : 'account-plus-outline'}
                iconColor={a.kind === 'order' ? '#3b82f6' : a.kind === 'listing' ? '#f59e0b' : a.kind === 'technician' ? '#8b5cf6' : '#10b981'}
                title={a.title} meta={a.meta} time={a.time} onPress={a.onPress}
              />
            ))}
          </>
        ) : null}

        {/* Operations */}
        <AdminSectionLabel icon="cog-outline" text={isRTL ? 'العمليات' : 'Operations'} />
        <AdminActionCard icon="account-check" iconColor="#8b5cf6" title={isRTL ? 'إدارة الفنيين' : 'Technician Management'} subtitle={isRTL ? 'مراجعة الطلبات وتفعيل الفني المتنقل' : 'Review applications, toggle mobile technicians'} badge={stats.pendingVerifications} onPress={() => router.push('/admin-verifications')} />
        <AdminActionCard icon="clipboard-list-outline" iconColor="#3b82f6" title={isRTL ? 'إدارة الطلبات' : 'Orders Management'} subtitle={isRTL ? 'متابعة جميع طلبات الإصلاح وحالاتها' : 'Track all repair orders and their status'} onPress={() => router.push('/admin-orders')} />
        <AdminActionCard icon="storefront-outline" iconColor="#f59e0b" title={isRTL ? 'إعلانات السوق' : 'Market Listings'} subtitle={isRTL ? 'الموافقة على الإعلانات المعلّقة أو رفضها' : 'Approve or reject pending listings'} badge={stats.pendingListings} onPress={() => router.push('/admin-market')} />
        <AdminActionCard icon="account-group-outline" iconColor="#10b981" title={isRTL ? 'إدارة المستخدمين' : 'User Management'} subtitle={isRTL ? 'تصفّح وبحث في جميع حسابات المستخدمين' : 'Browse and search all user accounts'} onPress={() => router.push('/admin-users')} />
        <AdminActionCard icon="chart-box-outline" iconColor="#0ea5a4" title={isRTL ? 'التقارير' : 'Reports'} subtitle={isRTL ? 'الإيرادات، الطلبات، الفنيون، السوق، الخصومات' : 'Revenue, orders, technicians, market, discounts'} onPress={() => router.push('/admin-reports' as any)} />
        <AdminActionCard icon="star-outline" iconColor="#f59e0b" title={isRTL ? 'التقييمات والتعليقات' : 'Ratings & Reviews'} subtitle={isRTL ? 'متابعة تقييمات العملاء للفنيين' : 'Review customer ratings of technicians'} onPress={() => router.push('/admin-ratings' as any)} />

        {/* Communication */}
        <AdminSectionLabel icon="message-text-outline" text={isRTL ? 'التواصل' : 'Communication'} />
        <AdminActionCard icon="forum-outline" iconColor="#06b6d4" title={isRTL ? 'صندوق الدعم' : 'Support inbox'} subtitle={isRTL ? 'محادثات الدعم مع العملاء' : 'Support conversations with customers'} badge={stats.unreadThreads} onPress={() => router.push('/admin-support')} />
        <AdminActionCard icon="bullhorn-outline" iconColor="#ec4899" title={isRTL ? 'الإشعارات العامة' : 'Broadcasts'} subtitle={isRTL ? 'إرسال إشعار لجميع المستخدمين' : 'Send a notification to all users'} onPress={() => router.push('/admin-broadcasts' as any)} />

        {/* Configuration */}
        <AdminSectionLabel icon="tune-variant" text={isRTL ? 'الإعدادات' : 'Configuration'} />
        <AdminActionCard icon="tune-vertical" iconColor="#6366f1" title={isRTL ? 'إعدادات المنصة' : 'Platform Settings'} subtitle={isRTL ? 'الرسوم، العمولة، وضع الصيانة، الإعلانات' : 'Fees, commission, maintenance mode, announcements'} onPress={() => router.push('/admin-platform-settings')} />
        <AdminActionCard icon="ticket-percent-outline" iconColor="#f59e0b" title={isRTL ? 'أكواد الخصم' : 'Discount codes'} subtitle={isRTL ? 'إنشاء وإدارة الأكواد الترويجية' : 'Create and manage promo codes'} onPress={() => router.push('/admin-discount-codes')} />
        {/* NEW: Delivery zones */}
        <AdminActionCard
          icon="map-marker-radius-outline" iconColor="#0ea5a4"
          title={isRTL ? 'مناطق التوصيل' : 'Delivery zones'}
          subtitle={isRTL ? 'إدارة المدن والأحياء وتسعيرة التوصيل' : 'Manage cities, neighborhoods & delivery fees'}
          onPress={() => router.push('/admin-delivery-zones' as any)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function statusTone(status: string): string {
  switch (status) {
    case 'completed': return '#10b981';
    case 'cancelled': return '#ef4444';
    case 'pending':   return '#f59e0b';
    case 'accepted':  return '#3b82f6';
    case 'in_progress': return '#8b5cf6';
    default:          return '#6b7280';
  }
}

function localizedStatus(status: string, isRTL: boolean): string {
  const map: Record<string, [string, string]> = {
    pending:     ['معلّق', 'Pending'],
    accepted:    ['مقبول', 'Accepted'],
    in_progress: ['جاري', 'In Progress'],
    completed:   ['مكتمل', 'Completed'],
    cancelled:   ['ملغي', 'Cancelled'],
  };
  const pair = map[status];
  if (!pair) return status;
  return isRTL ? pair[0] : pair[1];
}

function QuickStat({ label, value, color, COLORS, isRTL }: { label: string; value: string; color: string; COLORS: any; isRTL: boolean }) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: COLORS.card,
      borderRadius: BORDER_RADIUS.md,
      padding: 10,
      alignItems: 'center',
      borderTopWidth: 3,
      borderTopColor: color,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.border,
    }}>
      <Text style={{ color, fontSize: 18, fontWeight: '900' }}>{value}</Text>
      <Text style={{ color: COLORS.textSecondary, fontSize: 10, fontWeight: '700', textAlign: 'center', marginTop: 2 }} numberOfLines={2}>{label}</Text>
    </View>
  );
}

const styles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.background },
    title: { fontSize: 20, fontWeight: '800' },
    hero: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 14, backgroundColor: C.card, borderRadius: BORDER_RADIUS.lg, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: C.border, ...ADMIN_CARD_SHADOW },
    heroEyebrow: { color: C.primary, fontSize: 12, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', textAlign: isRTL ? 'right' : 'left' },
    heroTitle: { color: C.text, fontSize: 20, fontWeight: '900', marginTop: 4, letterSpacing: -0.3, textAlign: isRTL ? 'right' : 'left' },
    heroBody: { color: C.textSecondary, fontSize: 13, marginTop: 4, fontWeight: '600', textAlign: isRTL ? 'right' : 'left' },
    heroStamp: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4, marginTop: 10 },
    heroStampText: { color: C.textLight, fontSize: 11, fontWeight: '700' },
    heroBadge: { width: 56, height: 56, borderRadius: 18, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
    // New alert banner
    alertBanner: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ef4444', borderRadius: BORDER_RADIUS.md, padding: 12, marginBottom: 12, gap: 10 },
    alertDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
    alertText: { color: '#fff', fontWeight: '800', fontSize: 13, flex: 1, textAlign: isRTL ? 'right' : 'left' },
    // Quick stats bar
    quickStatsRow: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, marginBottom: 12 },
    // Online summary
    onlineSummary: { borderRadius: BORDER_RADIUS.md, padding: 14, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth },
    onlineDot: { width: 10, height: 10, borderRadius: 5 },
    onlineTitle: { fontSize: 14, fontWeight: '800' },
    onlinePill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
    // Recent order rows
    recentOrderRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', borderRadius: BORDER_RADIUS.sm, padding: 12, marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, gap: 12 },
    recentOrderTitle: { fontSize: 14, fontWeight: '700', textAlign: isRTL ? 'right' : 'left' },
    recentOrderMeta: { fontSize: 12, marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
    statusChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    quickRow: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10 },
    statsGrid: { flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 12 },
    revenueCard: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: BORDER_RADIUS.md, padding: 18, marginTop: 14, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 14, elevation: 4 },
    revenueLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700', textAlign: isRTL ? 'right' : 'left' },
    revenueValue: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 4, letterSpacing: -0.4, textAlign: isRTL ? 'right' : 'left' },
    revenueSub: { color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '700', marginTop: 4, textAlign: isRTL ? 'right' : 'left' },
  });

