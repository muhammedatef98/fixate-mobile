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
  const { summary: loyaltySummary } = useLoyalty();
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

  const accountRows: MenuRow[] = [
    { id: 'orders', icon: 'receipt-outline', labelAr: 'طلباتي', labelEn: 'My orders', hintAr: 'كل الطلبات والحالة', hintEn: 'All orders and status' },
    { id: 'loyalty', icon: 'star-outline', iconColor: '#f59e0b', labelAr: 'نقاط الولاء', labelEn: 'Loyalty points', hintAr: `${loyaltySummary.balance} نقطة متاحة`, hintEn: `${loyaltySummary.balance} points available` },
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
  const displayEmail = userProfile?.email || user?.email || '';
  const initial = (displayName[0] || '?').toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>{isRTL ? 'حسابي' : 'My account'}</Text>
        <TouchableOpacity onPress={() => goto('/settings')} style={styles.gearBtn} accessibilityRole="button">
          <Ionicons name="settings-outline" size={20} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], paddingHorizontal: SPACING.m, paddingTop: SPACING.m, paddingBottom: SPACING.l }}>
          {/* Profile hero */}
          <View style={[styles.hero, { backgroundColor: COLORS.primary }]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <Text style={styles.heroName} numberOfLines={1}>{displayName}</Text>
            {!!displayEmail && <Text style={styles.heroEmail} numberOfLines={1}>{displayEmail}</Text>}
            <TouchableOpacity onPress={() => goto('/edit-profile')} style={styles.editPill}>
              <Ionicons name="pencil-outline" size={13} color="#fff" />
              <Text style={styles.editPillText}>{isRTL ? 'تعديل البيانات' : 'Edit profile'}</Text>
            </TouchableOpacity>
          </View>

          {/* Stat tiles */}
          <View style={styles.statsRow}>
            <Stat label={isRTL ? 'الطلبات' : 'Orders'} value={stats.total} COLORS={COLORS} />
            <View style={[styles.statSeparator, { backgroundColor: COLORS.border }]} />
            <Stat label={isRTL ? 'مكتملة' : 'Completed'} value={stats.completed} COLORS={COLORS} accent />
            <View style={[styles.statSeparator, { backgroundColor: COLORS.border }]} />
            <Stat label={isRTL ? 'العناوين' : 'Addresses'} value={stats.addresses} COLORS={COLORS} />
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

function Stat({ label, value, COLORS, accent }: any) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: accent ? COLORS.primary : COLORS.text, fontSize: 22, fontWeight: '800' }}>
        {value}
      </Text>
      <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 2, fontWeight: '500' }}>
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
    headerTitle: { fontSize: 22, fontWeight: '800', color: C.text },
    gearBtn: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: C.card, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: C.border,
    },

    hero: {
      borderRadius: 24,
      padding: 22,
      alignItems: 'center',
      marginBottom: 16,
      shadowColor: C.primary,
      shadowOpacity: 0.25,
      shadowOffset: { width: 0, height: 8 },
      shadowRadius: 16,
      elevation: 6,
    },
    avatar: {
      width: 76, height: 76, borderRadius: 38,
      backgroundColor: '#ffffff25',
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 3, borderColor: '#ffffff40',
    },
    avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
    heroName: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 12, maxWidth: '90%' },
    heroEmail: { color: '#ffffffcc', fontSize: 12, marginTop: 4, maxWidth: '90%' },
    editPill: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#ffffff25',
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 999,
      marginTop: 14,
    },
    editPillText: { color: '#fff', fontSize: 12, fontWeight: '700' },

    statsRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.md,
      paddingVertical: 18,
      marginBottom: 24,
      ...SHADOWS.small,
    },
    statSeparator: { width: StyleSheet.hairlineWidth, marginVertical: 4 },

    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: C.textSecondary,
      letterSpacing: 1.4,
      marginBottom: 8,
      paddingHorizontal: 4,
      textAlign: isRTL ? 'right' : 'left',
    },
    menuCard: {
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.md,
      marginBottom: 24,
      overflow: 'hidden',
      ...SHADOWS.small,
    },

    logoutBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 14,
      borderRadius: BORDER_RADIUS.lg,
      backgroundColor: '#ef444412',
      borderWidth: 1,
      borderColor: '#ef444433',
    },
    logoutText: { color: '#ef4444', fontWeight: '800', fontSize: 14 },

    versionText: { textAlign: 'center', color: C.textSecondary, fontSize: 11, marginTop: 18 },
  });
