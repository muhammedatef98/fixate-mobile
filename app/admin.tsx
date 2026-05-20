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
  pendingVerifications: number;
  unreadThreads: number;
  totalUsers: number;
  totalTechnicians: number;
  pendingOrders: number;
  completedOrders: number;
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user, userProfile, signOut } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [adminChecked, setAdminChecked] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Stats>({
    pendingVerifications: 0,
    unreadThreads: 0,
    totalUsers: 0,
    totalTechnicians: 0,
    pendingOrders: 0,
    completedOrders: 0,
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
        { count: pendingVerifications },
        { count: totalUsers },
        { count: totalTechnicians },
        { count: pendingOrders },
        { count: completedOrders },
        { count: unreadThreads },
      ] = await Promise.all([
        supabase.from('technicians').select('*', { count: 'exact', head: true }).eq('verification_status', 'submitted'),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('technicians').select('*', { count: 'exact', head: true }).eq('verification_status', 'approved'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('support_threads').select('*', { count: 'exact', head: true }).eq('unread_for_admin', true),
      ]);
      setStats({
        pendingVerifications: pendingVerifications ?? 0,
        unreadThreads: unreadThreads ?? 0,
        totalUsers: totalUsers ?? 0,
        totalTechnicians: totalTechnicians ?? 0,
        pendingOrders: pendingOrders ?? 0,
        completedOrders: completedOrders ?? 0,
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

  if (adminChecked === null) {
    return (
      <SafeAreaView style={[styles(COLORS, isRTL).container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles(COLORS, isRTL).container}>
        <View style={styles(COLORS, isRTL).header}>
          <TouchableOpacity onPress={() => safeBack()} style={{ padding: 6 }}>
            <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={[styles(COLORS, isRTL).title, { color: COLORS.text }]}>
            {isRTL ? 'الإدارة' : 'Admin'}
          </Text>
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
    <SafeAreaView style={styles(COLORS, isRTL).container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles(COLORS, isRTL).header}>
        <TouchableOpacity onPress={() => safeBack('/(customer)')} style={{ padding: 6 }}>
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[styles(COLORS, isRTL).title, { color: COLORS.text }]}>
          {isRTL ? 'لوحة الإدارة' : 'Admin Panel'}
        </Text>
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadStats();
            }}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Hero greeting */}
        <View style={[styles(COLORS, isRTL).hero, { backgroundColor: COLORS.primary + '15', borderColor: COLORS.primary + '30' }]}>
          <MaterialCommunityIcons name="shield-star" size={32} color={COLORS.primary} />
          <View style={{ flex: 1, marginHorizontal: 12 }}>
            <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 16 }}>
              {isRTL ? 'أهلاً، مسؤول النظام' : 'Welcome, admin'}
            </Text>
            <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 2 }}>
              {userProfile?.email || user?.email}
            </Text>
          </View>
        </View>

        {/* Stat tiles */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <StatTile
            icon="account-clock"
            label={isRTL ? 'طلبات تحقق' : 'Pending verif.'}
            value={stats.pendingVerifications}
            color="#f59e0b"
            COLORS={COLORS}
            loading={loading}
          />
          <StatTile
            icon="message-badge"
            label={isRTL ? 'دعم غير مقروء' : 'Unread support'}
            value={stats.unreadThreads}
            color="#3b82f6"
            COLORS={COLORS}
            loading={loading}
          />
          <StatTile
            icon="account-multiple"
            label={isRTL ? 'مستخدمون' : 'Users'}
            value={stats.totalUsers}
            color="#10b981"
            COLORS={COLORS}
            loading={loading}
          />
          <StatTile
            icon="account-wrench"
            label={isRTL ? 'فنيون' : 'Technicians'}
            value={stats.totalTechnicians}
            color="#8b5cf6"
            COLORS={COLORS}
            loading={loading}
          />
          <StatTile
            icon="clipboard-clock"
            label={isRTL ? 'طلبات قيد الانتظار' : 'Pending orders'}
            value={stats.pendingOrders}
            color="#ec4899"
            COLORS={COLORS}
            loading={loading}
          />
          <StatTile
            icon="check-decagram"
            label={isRTL ? 'مكتملة' : 'Completed'}
            value={stats.completedOrders}
            color="#06b6d4"
            COLORS={COLORS}
            loading={loading}
          />
        </View>

        {/* Primary actions */}
        <View style={{ marginTop: 20 }}>
          <ActionCard
            icon="account-check"
            title={isRTL ? 'مراجعة طلبات الفنيين' : 'Technician verifications'}
            subtitle={
              stats.pendingVerifications > 0
                ? (isRTL ? `${stats.pendingVerifications} طلب جديد بانتظارك` : `${stats.pendingVerifications} new submissions await you`)
                : (isRTL ? 'لا توجد طلبات معلّقة' : 'No pending submissions')
            }
            badge={stats.pendingVerifications}
            onPress={() => router.push('/admin-verifications')}
            COLORS={COLORS}
            isRTL={isRTL}
            highlight={stats.pendingVerifications > 0}
          />
          <ActionCard
            icon="forum"
            title={isRTL ? 'الدعم الفني — صندوق الوارد' : 'Support inbox'}
            subtitle={
              stats.unreadThreads > 0
                ? (isRTL ? `${stats.unreadThreads} محادثة جديدة` : `${stats.unreadThreads} new conversations`)
                : (isRTL ? 'تواصل مباشر مع العملاء' : 'Direct chat with customers')
            }
            badge={stats.unreadThreads}
            onPress={() => router.push('/admin-support')}
            COLORS={COLORS}
            isRTL={isRTL}
            highlight={stats.unreadThreads > 0}
          />
          <ActionCard
            icon="ticket-percent"
            title={isRTL ? 'أكواد الخصم' : 'Discount codes'}
            subtitle={isRTL ? 'إنشاء وإدارة الأكواد الترويجية' : 'Create and manage promo codes'}
            onPress={() => router.push('/admin-discount-codes')}
            COLORS={COLORS}
            isRTL={isRTL}
          />
          <ActionCard
            icon="storefront"
            title={isRTL ? 'سوق Fixate' : 'Fixate Market'}
            subtitle={isRTL ? 'مراجعة الإعلانات المنشورة من المستخدمين' : 'Moderate user-posted listings'}
            onPress={() => router.push('/admin-market')}
            COLORS={COLORS}
            isRTL={isRTL}
          />
          <ActionCard
            icon="bullhorn"
            title={isRTL ? 'الإشعارات والإعلانات' : 'Broadcasts'}
            subtitle={isRTL ? 'إرسال إشعار لجميع المستخدمين' : 'Send a push to all users'}
            onPress={() => router.push('/admin-broadcasts' as any)}
            COLORS={COLORS}
            isRTL={isRTL}
          />
          <ActionCard
            icon="tune-vertical"
            title={isRTL ? 'إعدادات المنصة' : 'Platform settings'}
            subtitle={
              isRTL
                ? 'الرسوم، عمولة المنصة، رسائل منطقة الخدمة'
                : 'Fees, commission rate, service-area messaging'
            }
            onPress={() => router.push('/admin-platform-settings')}
            COLORS={COLORS}
            isRTL={isRTL}
          />
        </View>
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

function StatTile({ icon, label, value, color, COLORS, loading }: any) {
  return (
    <View
      style={{
        width: '47%',
        backgroundColor: COLORS.card,
        borderRadius: BORDER_RADIUS.md,
        padding: 16,
        ...CARD_SHADOW,
      }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: color + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        <MaterialCommunityIcons name={icon} size={20} color={color} />
      </View>
      {loading ? (
        <ActivityIndicator color={color} style={{ alignSelf: 'flex-start' }} />
      ) : (
        <Text style={{ color: COLORS.text, fontSize: 22, fontWeight: '800' }}>{value}</Text>
      )}
      <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 4 }}>{label}</Text>
    </View>
  );
}

function ActionCard({ icon, title, subtitle, badge, onPress, COLORS, isRTL, highlight }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        backgroundColor: highlight ? COLORS.primary : COLORS.card,
        borderRadius: BORDER_RADIUS.md,
        padding: 16,
        marginBottom: 12,
        gap: 12,
        ...CARD_SHADOW,
      }}
      accessibilityRole="button"
    >
      <View style={{
        width: 48, height: 48, borderRadius: 12,
        backgroundColor: highlight ? '#ffffff25' : COLORS.primary + '20',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <MaterialCommunityIcons name={icon} size={24} color={highlight ? '#fff' : COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: highlight ? '#fff' : COLORS.text, fontSize: 15, fontWeight: '700' }}>
          {title}
        </Text>
        <Text style={{ color: highlight ? '#ffffffcc' : COLORS.textSecondary, fontSize: 12, marginTop: 2 }}>
          {subtitle}
        </Text>
      </View>
      {badge > 0 && (
        <View style={{
          backgroundColor: highlight ? '#ffffff' : '#ef4444',
          minWidth: 26, height: 26, borderRadius: 13,
          alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8,
        }}>
          <Text style={{ color: highlight ? COLORS.primary : '#fff', fontSize: 12, fontWeight: '800' }}>
            {badge}
          </Text>
        </View>
      )}
      <RTLMaterialIcon name="chevron-right" size={22} color={highlight ? '#fff' : COLORS.textSecondary} />
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
    hero: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: BORDER_RADIUS.md,
      padding: 16,
      marginBottom: 20,
    },
  });
