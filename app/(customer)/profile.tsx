import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  StatusBar,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import BottomNav from '../../components/BottomNav';
import { useLoyalty } from '../../contexts/LoyaltyContext';
import { auth } from '../../lib/supabase-api';
import { supabase } from '../../services/supabaseClient';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { RTLIonicon } from '../../components/RTLIcon';
import { PressableScale } from '../../components/ui/PressableScale';
import Avatar from '../../components/Avatar';

interface MenuRow {
  id: string;
  icon: any;
  iconColor?: string;
  labelAr: string;
  labelEn: string;
  hintAr?: string;
  hintEn?: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user, userProfile, signOut } = useAuth();
  const { summary: loyaltySummary, enabled: loyaltyEnabled } = useLoyalty();
  const isRTL = language === 'ar';
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);

  const [stats, setStats] = useState({ total: 0, completed: 0, addresses: 0 });
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
    loadStats();
  }, [user?.id]);

  const loadStats = async () => {
    if (!user?.id) return;
    try {
      const [{ count: total }, { count: completed }, { count: addresses }] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'completed'),
        supabase.from('user_addresses').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);
      setStats({ total: total ?? 0, completed: completed ?? 0, addresses: addresses ?? 0 });
    } catch {}
  };

  const handleLogout = () => {
    Alert.alert(
      isRTL ? 'تسجيل الخروج' : 'Sign out',
      isRTL ? 'هل أنت متأكد من تسجيل الخروج؟' : 'Are you sure you want to sign out?',
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'خروج' : 'Sign out',
          style: 'destructive',
          onPress: async () => {
            try { await signOut(); } catch {}
            try { await auth.signOut(); } catch {}
            router.replace('/role-selection');
          },
        },
      ]
    );
  };

  const goto = (route: string) => router.push(route as any);

  // Loyalty row is conditionally inserted — feature-flag gated through the
  // LoyaltyContext so the menu item only shows when an admin has enabled
  // the loyalty programme in platform settings.
  const accountRows: MenuRow[] = [
    { id: 'orders', icon: 'receipt-outline', labelAr: 'طلباتي', labelEn: 'My orders', hintAr: 'كل الطلبات والحالة', hintEn: 'All orders and status' },
    ...(loyaltyEnabled
      ? [{ id: 'loyalty', icon: 'star-outline', iconColor: '#f59e0b', labelAr: 'نقاط الولاء', labelEn: 'Loyalty points', hintAr: `${loyaltySummary.balance} نقطة متاحة`, hintEn: `${loyaltySummary.balance} points available` } as MenuRow]
      : []),
    { id: 'wallet', icon: 'wallet-outline', labelAr: 'محفظتي', labelEn: 'Wallet', hintAr: 'سجل المدفوعات', hintEn: 'Payment history' },
    { id: 'addresses', icon: 'location-outline', labelAr: 'عناويني', labelEn: 'Addresses', hintAr: `${stats.addresses} ${isRTL ? 'عنوان محفوظ' : 'saved'}`, hintEn: `${stats.addresses} saved` },
    { id: 'edit', icon: 'person-circle-outline', labelAr: 'تعديل البيانات', labelEn: 'Edit profile', hintAr: 'الاسم، الجوال، الصورة', hintEn: 'Name, phone, photo' },
  ];

  const supportRows: MenuRow[] = [
    { id: 'support', icon: 'chatbubbles-outline', iconColor: '#10b981', labelAr: 'محادثة الدعم', labelEn: 'Live support', hintAr: 'تواصل مباشر مع فريقنا', hintEn: 'Chat with our team' },
    { id: 'notifs', icon: 'notifications-outline', labelAr: 'الإشعارات', labelEn: 'Notifications', hintAr: 'تخصيص التنبيهات', hintEn: 'Customise alerts' },
    { id: 'settings', icon: 'settings-outline', labelAr: 'الإعدادات', labelEn: 'Settings', hintAr: 'اللغة، الوضع الداكن', hintEn: 'Language, dark mode' },
    { id: 'help', icon: 'help-circle-outline', labelAr: 'تواصل معنا', labelEn: 'Contact us', hintAr: 'تواصل سريع مع الدعم', hintEn: 'Reach out to support' },
  ];

  const handleRow = (id: string) => {
    switch (id) {
      case 'orders': goto('/(customer)/orders'); break;
      case 'loyalty': goto('/loyalty'); break;
      case 'wallet': goto('/wallet'); break;
      case 'addresses': goto('/addresses'); break;
      case 'edit': goto('/edit-profile'); break;
      case 'support': goto('/support-chat'); break;
      case 'notifs': goto('/notifications-settings'); break;
      case 'settings': goto('/settings'); break;
      case 'help': goto('/contact'); break;
    }
  };

  const styles = makeStyles(COLORS, isRTL, SHADOWS);
  const displayName = userProfile?.name?.trim() || user?.email?.split('@')[0] || (isRTL ? 'مرحبًا' : 'Welcome');
  // Prefer the auth email (canonical, kept fresh by Supabase) and only
  // fall back to the profile row if the auth user has no email — which
  // happens for phone-OTP-only accounts.
  const displayEmail =
    (user?.email?.trim() || '') ||
    (userProfile?.email?.trim() || '');
  const displayPhone =
    ((userProfile as { phone?: string | null } | null)?.phone ?? '').trim() ||
    ((user as { phone?: string | null } | null)?.phone ?? '').trim();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>{isRTL ? 'حسابي' : 'My account'}</Text>
        <TouchableOpacity onPress={() => goto('/settings')} style={styles.gearBtn} accessibilityRole="button">
          <Ionicons name="settings-outline" size={18} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], paddingHorizontal: SPACING.m, paddingTop: SPACING.m, paddingBottom: SPACING.l }}>
          {/* Profile hero — primary-tinted card with decorative orbs, an
              online status dot, and contact details (email + phone) shown
              as icon-prefixed rows so they read as data, not labels. */}
          <View style={[styles.hero, { backgroundColor: COLORS.primary }]}>
            <View pointerEvents="none" style={[styles.heroOrb, styles.heroOrb1]} />
            <View pointerEvents="none" style={[styles.heroOrb, styles.heroOrb2]} />

            <View style={styles.heroAvatarRow}>
              <View style={styles.heroAvatarWrap}>
                <Avatar
                  name={displayName}
                  uri={userProfile?.avatar_url}
                  size={72}
                  style={styles.avatar}
                />
                <View style={[styles.heroAvatarDot, { borderColor: COLORS.primary }]} />
              </View>
              <View style={styles.heroNameWrap}>
                <Text style={styles.heroName} numberOfLines={1}>{displayName}</Text>
                <View style={styles.heroVerifyChip}>
                  <Ionicons name="shield-checkmark" size={10} color="#fff" />
                  <Text style={styles.heroVerifyText}>
                    {isRTL ? 'حساب موثّق' : 'Verified account'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Contact rows */}
            <View style={styles.heroContacts}>
              {!!displayEmail && (
                <View style={styles.heroContactRow}>
                  <View style={styles.heroContactIcon}>
                    <Ionicons name="mail-outline" size={13} color="#fff" />
                  </View>
                  <Text style={styles.heroContactText} numberOfLines={1}>
                    {displayEmail}
                  </Text>
                </View>
              )}
              {!!displayPhone && (
                <View style={styles.heroContactRow}>
                  <View style={styles.heroContactIcon}>
                    <Ionicons name="call-outline" size={13} color="#fff" />
                  </View>
                  <Text style={styles.heroContactText} numberOfLines={1}>
                    {displayPhone}
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity onPress={() => goto('/edit-profile')} style={styles.editPill}>
              <Ionicons name="pencil-outline" size={13} color="#fff" />
              <Text style={styles.editPillText}>{isRTL ? 'تعديل البيانات' : 'Edit profile'}</Text>
            </TouchableOpacity>
          </View>

          {/* Stat tiles — three independent cards instead of one fused row
              so each metric reads as its own glanceable card. */}
          <View style={styles.statsGrid}>
            <StatCard
              icon="receipt-outline"
              color="#3b82f6"
              label={isRTL ? 'الطلبات' : 'Orders'}
              value={stats.total}
              COLORS={COLORS}
              SHADOWS={SHADOWS}
            />
            <StatCard
              icon="checkmark-done-circle-outline"
              color="#10b981"
              label={isRTL ? 'مكتملة' : 'Completed'}
              value={stats.completed}
              COLORS={COLORS}
              SHADOWS={SHADOWS}
            />
            <StatCard
              icon="location-outline"
              color="#f59e0b"
              label={isRTL ? 'العناوين' : 'Addresses'}
              value={stats.addresses}
              COLORS={COLORS}
              SHADOWS={SHADOWS}
            />
          </View>

          {/* Account section */}
          <Text style={styles.sectionLabel}>{isRTL ? 'حسابي' : 'ACCOUNT'}</Text>
          <View style={styles.menuCard}>
            {accountRows.map((row, i) => (
              <Row key={row.id} row={row} isLast={i === accountRows.length - 1} onPress={() => handleRow(row.id)} COLORS={COLORS} isRTL={isRTL} />
            ))}
          </View>

          {/* Support section */}
          <Text style={styles.sectionLabel}>{isRTL ? 'الدعم والإعدادات' : 'SUPPORT & SETTINGS'}</Text>
          <View style={styles.menuCard}>
            {supportRows.map((row, i) => (
              <Row key={row.id} row={row} isLast={i === supportRows.length - 1} onPress={() => handleRow(row.id)} COLORS={COLORS} isRTL={isRTL} />
            ))}
          </View>

          {/* Logout */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} accessibilityRole="button">
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            <Text style={styles.logoutText}>{isRTL ? 'تسجيل الخروج' : 'Sign out'}</Text>
          </TouchableOpacity>

          <Text style={styles.versionText}>Fixate · v1.0.0</Text>
        </Animated.View>
      </ScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  value: number;
  COLORS: ReturnType<typeof getColors>;
  SHADOWS: ReturnType<typeof getShadows>;
}

function StatCard({ icon, color, label, value, COLORS, SHADOWS }: StatCardProps) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.card,
        borderRadius: BORDER_RADIUS.md,
        padding: 12,
        gap: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.small,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: color + '18',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={17} color={color} />
      </View>
      <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: '900', letterSpacing: -0.3 }}>
        {value}
      </Text>
      <Text style={{ color: COLORS.textSecondary, fontSize: 10.5, fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );
}

function Row({ row, isLast, onPress, COLORS, isRTL }: { row: MenuRow; isLast: boolean; onPress: () => void; COLORS: any; isRTL: boolean }) {
  const accent = row.iconColor || COLORS.primary;
  return (
    <PressableScale
      onPress={onPress}
      to={0.985}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        gap: 14,
        borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
      }}
      accessibilityRole="button"
    >
      <View style={{
        width: 38, height: 38, borderRadius: 11,
        backgroundColor: accent + '15',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={row.icon} size={18} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: '700', textAlign: isRTL ? 'right' : 'left' }}>
          {isRTL ? row.labelAr : row.labelEn}
        </Text>
        {(row.hintAr || row.hintEn) && (
          <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 2, textAlign: isRTL ? 'right' : 'left' }} numberOfLines={1}>
            {isRTL ? row.hintAr : row.hintEn}
          </Text>
        )}
      </View>
      <RTLIonicon name="chevron-forward" size={16} color={COLORS.textSecondary} />
    </PressableScale>
  );
}

const makeStyles = (C: any, isRTL: boolean, SHADOWS: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: C.background,
    },
    headerTitle: { fontSize: 21, fontWeight: '900', color: C.text, letterSpacing: -0.3 },
    gearBtn: {
      width: 38, height: 38, borderRadius: 12,
      backgroundColor: C.card, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: C.border,
    },

    hero: {
      borderRadius: 24,
      padding: 20,
      marginBottom: 18,
      overflow: 'hidden',
      position: 'relative',
      shadowColor: C.primary,
      shadowOpacity: 0.30,
      shadowOffset: { width: 0, height: 10 },
      shadowRadius: 20,
      elevation: 8,
    },
    heroOrb: {
      position: 'absolute',
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.10)',
    },
    heroOrb1: {
      width: 160,
      height: 160,
      top: -60,
      [isRTL ? 'left' : 'right']: -50,
    },
    heroOrb2: {
      width: 90,
      height: 90,
      bottom: -30,
      [isRTL ? 'right' : 'left']: -20,
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    heroAvatarRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 14,
    },
    heroAvatarWrap: { position: 'relative' },
    heroAvatarDot: {
      position: 'absolute',
      [isRTL ? 'left' : 'right']: 2,
      bottom: 2,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: '#22c55e',
      borderWidth: 3,
    },
    heroNameWrap: { flex: 1 },
    avatar: {
      borderWidth: 3, borderColor: 'rgba(255,255,255,0.30)',
    },
    heroName: {
      color: '#fff',
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: -0.3,
      textAlign: isRTL ? 'right' : 'left',
    },
    heroVerifyChip: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(255,255,255,0.22)',
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
      alignSelf: isRTL ? 'flex-end' : 'flex-start',
      marginTop: 6,
    },
    heroVerifyText: { color: '#fff', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 },

    heroContacts: {
      marginTop: 16,
      gap: 8,
    },
    heroContactRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 9,
      backgroundColor: 'rgba(255,255,255,0.14)',
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 12,
    },
    heroContactIcon: {
      width: 22,
      height: 22,
      borderRadius: 7,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroContactText: {
      flex: 1,
      color: '#fff',
      fontSize: 13,
      fontWeight: '700',
      textAlign: isRTL ? 'right' : 'left',
    },

    editPill: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: '#fff',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      marginTop: 14,
      alignSelf: isRTL ? 'flex-end' : 'flex-start',
    },
    editPillText: { color: C.primary, fontSize: 12.5, fontWeight: '800' },

    statsGrid: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 10,
      marginBottom: 22,
    },

    sectionLabel: {
      fontSize: 10.5,
      fontWeight: '800',
      color: C.textSecondary,
      letterSpacing: 1.3,
      marginBottom: 8,
      paddingHorizontal: 4,
      textAlign: isRTL ? 'right' : 'left',
    },
    menuCard: {
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.lg,
      marginBottom: 22,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: C.border,
      ...SHADOWS.small,
    },

    logoutBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 13,
      borderRadius: BORDER_RADIUS.lg,
      backgroundColor: '#ef444412',
      borderWidth: 1,
      borderColor: '#ef444433',
    },
    logoutText: { color: '#ef4444', fontWeight: '800', fontSize: 14 },

    versionText: {
      textAlign: 'center', color: C.textSecondary, fontSize: 10.5,
      fontWeight: '700', letterSpacing: 0.6, marginTop: 18, opacity: 0.6,
    },
  });
