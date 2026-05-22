import React, { useEffect, useState } from 'react';
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
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon, RTLMaterialIcon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';
import { supabase } from '../services/supabaseClient';

interface Stats {
  totalUsers: number;
  totalTechnicians: number;
  totalOrders: number;
  totalListings: number;
  revenue: number;
  pendingVerifications: number;
  pendingListings: number;
  unreadThreads: number;
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user, userProfile, signOut } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [adminChecked, setAdminChecked] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalTechnicians: 0,
    totalOrders: 0,
    totalListings: 0,
    revenue: 0,
    pendingVerifications: 0,
    pendingListings: 0,
    unreadThreads: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setAdminChecked(false);
      return;
    }
    Promise.resolve(supabase.from('users').select('is_admin').eq('id', user.id).maybeSingle())
      .then(({ data }: any) => !cancelled && setAdminChecked(data?.is_admin === true))
      .catch(() => !cancelled && setAdminChecked(false));
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const metaAdmin = (user?.user_metadata as any)?.is_admin === true;
  const isAdmin = adminChecked === true || (userProfile as any)?.is_admin === true || metaAdmin;

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
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('technicians').select('*', { count: 'exact', head: true }).eq('verification_status', 'approved'),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('market_listings').select('*', { count: 'exact', head: true }),
        supabase.from('technicians').select('*', { count: 'exact', head: true }).eq('verification_status', 'submitted'),
        supabase.from('market_listings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('support_threads').select('*', { count: 'exact', head: true }).eq('unread_for_admin', true),
        supabase.from('orders').select('final_price, estimated_price').eq('status', 'completed'),
      ]);
      const revenue = (completed ?? []).reduce(
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
      });
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadStats();
  }, [isAdmin]);

  const s = styles(COLORS, isRTL);

  if (adminChecked === null) {
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
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <MaterialCommunityIcons name="shield-alert-outline" size={64} color="#ef4444" />
          <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: '700', marginTop: 12 }}>
            {isRTL ? 'غير مصرّح' : 'Unauthorized'}
          </Text>
          <Text style={{ color: COLORS.textSecondary, textAlign: 'center', marginTop: 8 }}>
            {isRTL ? 'هذه الصفحة للأدمن فقط' : 'This page is restricted to admins'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => safeBack('/(customer)')} style={{ padding: 6 }}>
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[s.title, { color: COLORS.text }]}>{isRTL ? 'لوحة الإدارة' : 'Admin Panel'}</Text>
        <TouchableOpacity
          onPress={async () => {
            try { await signOut(); } catch {}
            router.replace('/role-selection');
          }}
          style={{ padding: 6 }}
        >
          <Ionicons name="log-out-outline" size={22} color="#ef4444" />
        </TouchableOpacity>
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
        {/* ── Platform Overview ───────────────────────────── */}
        <SectionLabel icon="view-dashboard-outline" text={isRTL ? 'نظرة عامة على المنصة' : 'Platform Overview'} COLORS={COLORS} isRTL={isRTL} />
        <View style={s.statsGrid}>
          <StatTile icon="account-multiple" label={isRTL ? 'المستخدمون' : 'Users'} value={stats.totalUsers} color="#10b981" COLORS={COLORS} loading={loading} />
          <StatTile icon="account-wrench" label={isRTL ? 'الفنيون' : 'Technicians'} value={stats.totalTechnicians} color="#8b5cf6" COLORS={COLORS} loading={loading} />
          <StatTile icon="clipboard-text" label={isRTL ? 'الطلبات' : 'Orders'} value={stats.totalOrders} color="#3b82f6" COLORS={COLORS} loading={loading} />
          <StatTile icon="storefront" label={isRTL ? 'الإعلانات' : 'Listings'} value={stats.totalListings} color="#f59e0b" COLORS={COLORS} loading={loading} />
        </View>
        <View style={[s.revenueCard, { backgroundColor: COLORS.primary }]}>
          <View>
            <Text style={s.revenueLabel}>{isRTL ? 'إجمالي الإيرادات (طلبات مكتملة)' : 'Total revenue (completed orders)'}</Text>
            {loading ? (
              <ActivityIndicator color="#fff" style={{ alignSelf: 'flex-start', marginTop: 6 }} />
            ) : (
              <Text style={s.revenueValue}>
                {stats.revenue.toLocaleString(isRTL ? 'ar-SA' : 'en-US')} {isRTL ? 'ر.س' : 'SAR'}
              </Text>
            )}
          </View>
          <MaterialCommunityIcons name="cash-multiple" size={40} color="rgba(255,255,255,0.35)" />
        </View>

        {/* ── Operations ──────────────────────────────────── */}
        <SectionLabel icon="cog-outline" text={isRTL ? 'العمليات' : 'Operations'} COLORS={COLORS} isRTL={isRTL} />
        <ActionCard
          icon="account-check" iconColor="#8b5cf6"
          title={isRTL ? 'إدارة الفنيين' : 'Technician Management'}
          subtitle={isRTL ? 'مراجعة الطلبات وتفعيل الفني المتنقل' : 'Review applications, toggle mobile technicians'}
          badge={stats.pendingVerifications}
          onPress={() => router.push('/admin-verifications')}
          COLORS={COLORS} isRTL={isRTL}
        />
        <ActionCard
          icon="clipboard-list-outline" iconColor="#3b82f6"
          title={isRTL ? 'إدارة الطلبات' : 'Orders Management'}
          subtitle={isRTL ? 'متابعة جميع طلبات الإصلاح وحالاتها' : 'Track all repair orders and their status'}
          onPress={() => router.push('/admin-orders')}
          COLORS={COLORS} isRTL={isRTL}
        />
        <ActionCard
          icon="storefront-outline" iconColor="#f59e0b"
          title={isRTL ? 'إعلانات السوق' : 'Market Listings'}
          subtitle={isRTL ? 'الموافقة على الإعلانات المعلّقة أو رفضها' : 'Approve or reject pending listings'}
          badge={stats.pendingListings}
          onPress={() => router.push('/admin-market')}
          COLORS={COLORS} isRTL={isRTL}
        />
        <ActionCard
          icon="account-group-outline" iconColor="#10b981"
          title={isRTL ? 'إدارة المستخدمين' : 'User Management'}
          subtitle={isRTL ? 'تصفّح وبحث في جميع حسابات المستخدمين' : 'Browse and search all user accounts'}
          onPress={() => router.push('/admin-users')}
          COLORS={COLORS} isRTL={isRTL}
        />
        <ActionCard
          icon="chart-box-outline" iconColor="#0ea5a4"
          title={isRTL ? 'التقارير' : 'Reports'}
          subtitle={isRTL ? 'الإيرادات، الطلبات، الفنيون، السوق، الخصومات' : 'Revenue, orders, technicians, market, discounts'}
          onPress={() => router.push('/admin-reports' as any)}
          COLORS={COLORS} isRTL={isRTL}
        />

        {/* ── Communication ───────────────────────────────── */}
        <SectionLabel icon="message-text-outline" text={isRTL ? 'التواصل' : 'Communication'} COLORS={COLORS} isRTL={isRTL} />
        <ActionCard
          icon="forum-outline" iconColor="#06b6d4"
          title={isRTL ? 'صندوق الدعم' : 'Support inbox'}
          subtitle={isRTL ? 'محادثات الدعم مع العملاء' : 'Support conversations with customers'}
          badge={stats.unreadThreads}
          onPress={() => router.push('/admin-support')}
          COLORS={COLORS} isRTL={isRTL}
        />
        <ActionCard
          icon="bullhorn-outline" iconColor="#ec4899"
          title={isRTL ? 'الإشعارات العامة' : 'Broadcasts'}
          subtitle={isRTL ? 'إرسال إشعار لجميع المستخدمين' : 'Send a notification to all users'}
          onPress={() => router.push('/admin-broadcasts' as any)}
          COLORS={COLORS} isRTL={isRTL}
        />

        {/* ── Configuration ───────────────────────────────── */}
        <SectionLabel icon="tune-variant" text={isRTL ? 'الإعدادات' : 'Configuration'} COLORS={COLORS} isRTL={isRTL} />
        <ActionCard
          icon="tune-vertical" iconColor="#6366f1"
          title={isRTL ? 'إعدادات المنصة' : 'Platform Settings'}
          subtitle={isRTL ? 'الرسوم، العمولة، وضع الصيانة، الإعلانات' : 'Fees, commission, maintenance mode, announcements'}
          onPress={() => router.push('/admin-platform-settings')}
          COLORS={COLORS} isRTL={isRTL}
        />
        <ActionCard
          icon="ticket-percent-outline" iconColor="#f59e0b"
          title={isRTL ? 'أكواد الخصم' : 'Discount codes'}
          subtitle={isRTL ? 'إنشاء وإدارة الأكواد الترويجية' : 'Create and manage promo codes'}
          onPress={() => router.push('/admin-discount-codes')}
          COLORS={COLORS} isRTL={isRTL}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
};

function SectionLabel({ icon, text, COLORS, isRTL }: any) {
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 22,
        marginBottom: 12,
      }}
    >
      <MaterialCommunityIcons name={icon} size={18} color={COLORS.textSecondary} />
      <Text
        style={{
          color: COLORS.textSecondary,
          fontSize: 12,
          fontWeight: '800',
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        {text}
      </Text>
    </View>
  );
}

function StatTile({ icon, label, value, color, COLORS, loading }: any) {
  return (
    <View
      style={{
        width: '47.5%',
        backgroundColor: COLORS.card,
        borderRadius: BORDER_RADIUS.md,
        padding: 14,
        ...CARD_SHADOW,
      }}
    >
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: color + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        <MaterialCommunityIcons name={icon} size={19} color={color} />
      </View>
      {loading ? (
        <ActivityIndicator color={color} style={{ alignSelf: 'flex-start' }} />
      ) : (
        <Text style={{ color: COLORS.text, fontSize: 22, fontWeight: '800' }}>{value}</Text>
      )}
      <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function ActionCard({ icon, iconColor, title, subtitle, badge, onPress, COLORS, isRTL }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        backgroundColor: COLORS.card,
        borderRadius: BORDER_RADIUS.md,
        padding: 14,
        marginBottom: 10,
        gap: 12,
        ...CARD_SHADOW,
      }}
      accessibilityRole="button"
    >
      <View style={{
        width: 46, height: 46, borderRadius: 12,
        backgroundColor: (iconColor ?? COLORS.primary) + '20',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <MaterialCommunityIcons name={icon} size={23} color={iconColor ?? COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: COLORS.text, fontSize: 15, fontWeight: '700', textAlign: isRTL ? 'right' : 'left' }}>
          {title}
        </Text>
        <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 2, textAlign: isRTL ? 'right' : 'left' }}>
          {subtitle}
        </Text>
      </View>
      {badge > 0 && (
        <View style={{
          backgroundColor: '#ef4444',
          minWidth: 24, height: 24, borderRadius: 12,
          alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7,
        }}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{badge}</Text>
        </View>
      )}
      <RTLMaterialIcon name="chevron-right" size={22} color={COLORS.textSecondary} />
    </TouchableOpacity>
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
    title: { fontSize: 22, fontWeight: '800' },
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
      marginTop: 12,
    },
    revenueLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
    revenueValue: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 4 },
  });
