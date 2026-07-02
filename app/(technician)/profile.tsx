import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView,
  Animated, StatusBar, Alert, Switch, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { RTLIonicon } from '../../components/RTLIcon';
import { getColors, getShadows, BORDER_RADIUS, SPACING } from '../../constants/theme';
import { PressableScale } from '../../components/ui/PressableScale';
import { supabase } from '../../services/supabaseClient';
import { getTechnicianRating, listTechnicianReviews, type TechnicianReview } from '../../services/reviewService';
import { getWalletBalance } from '../../services/walletService';
import Avatar from '../../components/Avatar';
import { logger } from '../../utils/logger';
import { TECH_NAV_HEIGHT } from '../../components/BottomNavTech';

/**
 * Technician profile — the "me" hub.
 *
 * This is the destination for everything personal/operational that the
 * three other tabs (Home / Requests / Jobs) shouldn't carry. New sections
 * live here intentionally:
 *
 *   1. Status toggle  — overall availability for repair work
 *   2. Stats row      — completed jobs, rating, years of experience
 *   3. Earnings & Commission — wallet balance + commission % breakdown,
 *                       link to the full earnings history screen
 *   4. Ratings & Reviews — average + count + recent reviews, READ-ONLY
 *   5. Menu items    — existing routes preserved (completed jobs, service
 *                       availability, earnings history, skills, notifications,
 *                       settings, support)
 *   6. Sign out
 *
 * Ratings rendering is strictly read-only — there is no edit, delete or
 * report affordance for the technician, by design.
 */
export default function TechnicianProfile() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const isRTL = language === 'ar';
  const C = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const styles = createStyles(C, isRTL, SHADOWS);

  const { user: authUser, userProfile, signOut } = useAuth();

  const [stats, setStats] = useState<{
    total: number; completed: number; cancelled: number;
    rating: number; ratingCount: number; years: number;
  }>({ total: 0, completed: 0, cancelled: 0, rating: 0, ratingCount: 0, years: 0 });
  const [reviews, setReviews] = useState<TechnicianReview[]>([]);
  const [wallet, setWallet] = useState<{ balance: number; pendingBackend: boolean }>({ balance: 0, pendingBackend: true });
  const [isAvailable, setIsAvailable] = useState(true);
  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const load = async () => {
    if (!authUser?.id) { setLoading(false); return; }
    try {
      const [
        { count: total },
        { count: completed },
        { count: cancelled },
        { data: tech },
        ratingSummary,
        recentReviews,
        bal,
      ] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('technician_id', authUser.id),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('technician_id', authUser.id).eq('status', 'completed'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('technician_id', authUser.id).eq('status', 'cancelled'),
        supabase.from('technicians').select('years_of_experience, available').eq('user_id', authUser.id).maybeSingle(),
        getTechnicianRating(authUser.id),
        listTechnicianReviews(authUser.id, 6),
        getWalletBalance(authUser.id),
      ]);

      setStats({
        total: total ?? 0,
        completed: completed ?? 0,
        cancelled: cancelled ?? 0,
        rating: Number(ratingSummary?.average_rating ?? 0),
        ratingCount: Number(ratingSummary?.rating_count ?? 0),
        years: Number(tech?.years_of_experience ?? 0),
      });
      setReviews(recentReviews);
      setWallet(bal);
      if (tech && typeof tech.available === 'boolean') setIsAvailable(tech.available);
    } catch (e) {
      logger.warn('profile load failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [authUser?.id]);

  // Re-read on focus so values stay fresh when the technician comes back
  // from a job completion or an earnings withdrawal.
  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [authUser?.id])
  );

  const toggleAvailability = async (next: boolean) => {
    if (!authUser?.id) return;
    const prev = isAvailable;
    setIsAvailable(next); // optimistic
    setTogglingAvailability(true);
    try {
      const { error } = await supabase
        .from('technicians')
        .update({ available: next })
        .eq('user_id', authUser.id);
      if (error) throw error;
    } catch (e) {
      // Persist failed — revert the optimistic switch and surface the error
      // rather than leaving a false availability state.
      logger.warn('toggleAvailability failed to persist', e);
      setIsAvailable(prev);
      Alert.alert(
        isRTL ? 'تعذّر تحديث الحالة' : "Couldn't update status",
        isRTL
          ? 'لم نتمكن من حفظ حالة الإتاحة. تحقق من اتصالك وحاول مرة أخرى.'
          : "We couldn't save your availability. Check your connection and try again.",
      );
    } finally {
      setTogglingAvailability(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      isRTL ? 'تسجيل الخروج' : 'Logout',
      isRTL ? 'هل أنت متأكد من تسجيل الخروج؟' : 'Are you sure you want to logout?',
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        { text: isRTL ? 'خروج' : 'Logout', style: 'destructive', onPress: async () => {
          try { await signOut(); } catch (e) { logger.warn('technician-profile: sign-out failed', e); }
          router.replace('/role-selection');
        }}
      ]
    );
  };

  const ratingHint = stats.rating > 0
    ? `★ ${stats.rating.toFixed(1)}${stats.ratingCount > 0 ? ` · ${stats.ratingCount}` : ''}`
    : (isRTL ? 'لا يوجد' : 'None yet');

  const MENU_ITEMS = [
    { id: 'ratings',       icon: 'star-outline',          labelAr: 'التقييمات والمراجعات', labelEn: 'Ratings & Reviews', hint: ratingHint },
    { id: 'my-orders',     icon: 'clipboard-outline',     labelAr: 'طلباتي المكتملة',     labelEn: 'Completed Jobs' },
    { id: 'availability',  icon: 'toggle-outline',        labelAr: 'الخدمات المتاحة',     labelEn: 'Service Availability' },
    { id: 'earnings',      icon: 'wallet-outline',        labelAr: 'سجل الأرباح الكامل', labelEn: 'Full Earnings History' },
    { id: 'skills',        icon: 'construct-outline',     labelAr: 'المهارات والخبرات',  labelEn: 'Skills & Experience' },
    { id: 'notifications', icon: 'notifications-outline', labelAr: 'الإشعارات',          labelEn: 'Notifications' },
    { id: 'settings',      icon: 'settings-outline',      labelAr: 'الإعدادات',           labelEn: 'Settings' },
    { id: 'help',          icon: 'help-circle-outline',   labelAr: 'الدعم الفني',        labelEn: 'Tech Support' },
  ];

  const fmt = (n: number) => n.toLocaleString(isRTL ? 'ar-EG' : 'en-US', { maximumFractionDigits: 0 });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={C.background} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>{isRTL ? 'ملف الفني' : 'My Profile'}</Text>
        <TouchableOpacity
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'الإعدادات' : 'Settings'}
          style={styles.headerActionBtn}
        >
          <Ionicons name="settings-outline" size={18} color={C.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: TECH_NAV_HEIGHT + 24 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={C.primary}
          />
        }
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* ── Identity card with status toggle ─────────────────── */}
          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              <Avatar
                name={userProfile?.name}
                uri={userProfile?.avatar_url}
                size={96}
                style={styles.avatar}
              />
              {(userProfile as any)?.is_verified ? (
                <View style={styles.verifiedBadge}>
                  <MaterialIcons name="verified" size={16} color="#fff" />
                </View>
              ) : null}
            </View>
            <Text style={styles.userName}>
              {userProfile?.name || (isRTL ? 'فني معتمد' : 'Certified Tech')}
            </Text>
            <Text style={styles.userEmail}>
              {userProfile?.email || authUser?.email || (isRTL ? 'فني صيانة' : 'Repair Technician')}
            </Text>
            {!(userProfile as any)?.is_verified ? (
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.85}
                onPress={() => router.push('/verify-identity' as any)}
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  alignSelf: 'center',
                  gap: 6,
                  marginTop: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 999,
                  backgroundColor: C.primary + '18',
                  borderWidth: 1,
                  borderColor: C.primary + '40',
                }}
              >
                <MaterialIcons name="shield" size={14} color={C.primary} />
                <Text style={{ color: C.primary, fontSize: 12, fontWeight: '800' }}>
                  {isRTL ? 'احصل على علامة التوثيق' : 'Get verified'}
                </Text>
              </TouchableOpacity>
            ) : null}

            {/* Availability toggle — single source of truth for the technician's
                "open for work" status. Same write as the Home dashboard so the
                two stay in sync. */}
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isAvailable ? C.success : C.textLight },
                ]}
              />
              <Text style={[styles.statusLabel, { color: isAvailable ? C.success : C.textSecondary }]}>
                {isAvailable
                  ? (isRTL ? 'متاح لاستلام طلبات' : 'Available for work')
                  : (isRTL ? 'غير متاح حالياً' : 'Off duty')}
              </Text>
              <View style={{ flex: 1 }} />
              <Switch
                value={isAvailable}
                onValueChange={toggleAvailability}
                disabled={togglingAvailability}
                trackColor={{ false: C.border, true: C.primarySoft }}
                thumbColor={isAvailable ? C.primary : C.card}
              />
            </View>

            {/* Stats row — rating intentionally removed here. The single
                source of truth for ratings is the dedicated "Ratings &
                Reviews" section below to avoid showing the same number twice. */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.completed}</Text>
                <Text style={styles.statLabel}>{isRTL ? 'مكتملة' : 'Completed'}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {stats.years > 0 ? `+${stats.years}` : '—'}
                </Text>
                <Text style={styles.statLabel}>{isRTL ? 'سنة' : 'Years'}</Text>
              </View>
            </View>
          </View>

          {/* ── Earnings (simple) ───────────────────────────────────
              Per the latest direction the technician profile no longer
              surfaces commission percentages, gross/net splits, or
              withdrawal-request flows. A single quiet card states the
              earnings total; the underlying earnings page still exists
              as a read-only history but is reached through the menu, not
              promoted with financial-admin chrome. */}
          <SectionLabel
            icon="cash-multiple"
            text={isRTL ? 'الأرباح' : 'Earnings'}
            COLORS={C}
            isRTL={isRTL}
            actionLabel={isRTL ? 'السجل' : 'History'}
            onAction={() => router.push('/(technician)/earnings')}
          />
          <TouchableOpacity
            onPress={() => router.push('/(technician)/earnings')}
            activeOpacity={0.9}
            style={styles.earningsCard}
            accessibilityRole="button"
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.earningsLabel}>
                {isRTL ? 'إجمالي الأرباح' : 'Total earnings'}
              </Text>
              {loading ? (
                <ActivityIndicator color="#fff" style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start', marginTop: 6 }} />
              ) : (
                <Text style={styles.earningsValue}>
                  {fmt(wallet.balance)} {isRTL ? 'ر.س' : 'SAR'}
                </Text>
              )}
              <Text style={styles.earningsHint}>
                {isRTL ? 'اضغط لعرض السجل' : 'Tap to view history'}
              </Text>
            </View>
            <MaterialCommunityIcons name="cash-multiple" size={38} color="rgba(255,255,255,0.35)" />
          </TouchableOpacity>

          {/* ── Menu items ────────────────────────────────────────── */}
          <SectionLabel
            icon="cog-outline"
            text={isRTL ? 'الحساب والإعدادات' : 'Account & Settings'}
            COLORS={C}
            isRTL={isRTL}
          />
          <View style={styles.menuSection}>
            {MENU_ITEMS.map((item, idx) => (
              <PressableScale
                key={item.id}
                to={0.985}
                style={
                  idx === MENU_ITEMS.length - 1
                    ? [styles.menuItem, { borderBottomWidth: 0 }]
                    : styles.menuItem
                }
                onPress={() => {
                  if (item.id === 'ratings') router.push('/(technician)/ratings' as any);
                  else if (item.id === 'availability') router.push('/(technician)/service-availability');
                  else if (item.id === 'earnings') router.push('/(technician)/earnings');
                  else if (item.id === 'my-orders') router.push('/(technician)/my-orders');
                  else if (item.id === 'notifications') router.push('/notifications-settings');
                  else if (item.id === 'settings') router.push('/settings');
                  else if (item.id === 'help') router.push('/contact');
                  else if (item.id === 'skills') router.push('/technician-onboarding');
                }}
              >
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuIconContainer}>
                    <Ionicons name={item.icon as any} size={20} color={C.text} />
                  </View>
                  <Text style={styles.menuLabel}>{isRTL ? item.labelAr : item.labelEn}</Text>
                </View>
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
                  {(item as any).hint ? (
                    <Text style={{ color: C.textSecondary, fontSize: 12, fontWeight: '700' }}>
                      {(item as any).hint}
                    </Text>
                  ) : null}
                  <RTLIonicon name="chevron-forward" size={18} color={C.textSecondary} />
                </View>
              </PressableScale>
            ))}
          </View>

          {/* Logout */}
          <PressableScale to={0.985} style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color={C.error} />
            <Text style={styles.logoutText}>{isRTL ? 'تسجيل الخروج' : 'Logout'}</Text>
          </PressableScale>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─────────────────────────────────────────────────────── section label */
function SectionLabel({
  icon, text, COLORS, isRTL, hint, actionLabel, onAction,
}: any) {
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 22,
        marginBottom: 10,
      }}
    >
      <MaterialCommunityIcons name={icon} size={16} color={COLORS.textSecondary} />
      <Text
        style={{
          flex: 1,
          color: COLORS.textSecondary,
          fontSize: 12,
          fontWeight: '800',
          letterSpacing: 1,
          textTransform: 'uppercase',
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {text}
      </Text>
      {hint ? (
        <View
          style={{
            paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
            backgroundColor: COLORS.cardAlt,
          }}
        >
          <Text style={{ color: COLORS.textSecondary, fontSize: 10, fontWeight: '800' }}>
            {hint}
          </Text>
        </View>
      ) : null}
      {actionLabel ? (
        <TouchableOpacity onPress={onAction} hitSlop={8}>
          <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '800' }}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const createStyles = (C: any, isRTL: boolean, SHADOWS: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 14,
      backgroundColor: C.background,
    },
    headerTitle: { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
    headerActionBtn: {
      width: 36, height: 36, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    },
    scrollContent: { padding: 16 },

    /* Identity card */
    profileCard: {
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.xxl,
      padding: 22,
      alignItems: 'center',
      borderWidth: 1, borderColor: C.border,
      ...SHADOWS.small,
    },
    avatarContainer: { position: 'relative', marginBottom: 14 },
    avatar: { borderWidth: 4, borderColor: C.primarySoft },
    verifiedBadge: {
      position: 'absolute', bottom: 0,
      right: isRTL ? undefined : 0, left: isRTL ? 0 : undefined,
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: C.primary,
      justifyContent: 'center', alignItems: 'center',
      borderWidth: 2, borderColor: C.card,
    },
    userName: { fontSize: 21, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
    userEmail: { fontSize: 13, color: C.textSecondary, marginTop: 3 },

    statusRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center', gap: 8,
      marginTop: 16, paddingTop: 14,
      width: '100%',
      borderTopWidth: 1, borderTopColor: C.border,
    },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusLabel: { fontSize: 13, fontWeight: '700' },

    statsRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      marginTop: 14, width: '100%',
      justifyContent: 'space-around',
      paddingTop: 14,
      borderTopWidth: 1, borderTopColor: C.border,
    },
    statItem: { alignItems: 'center' },
    statValue: { fontSize: 19, fontWeight: '900', color: C.primary, letterSpacing: -0.3 },
    statLabel: { fontSize: 11.5, color: C.textSecondary, marginTop: 4, fontWeight: '600' },
    statDivider: { width: 1, height: 30, backgroundColor: C.border },

    /* Earnings */
    earningsCard: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.primary,
      borderRadius: BORDER_RADIUS.lg,
      padding: 18,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 14,
      elevation: 4,
    },
    earningsLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700',
      textAlign: isRTL ? 'right' : 'left' },
    earningsValue: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 3, letterSpacing: -0.5,
      textAlign: isRTL ? 'right' : 'left' },
    earningsHint: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4, fontWeight: '600',
      textAlign: isRTL ? 'right' : 'left' },

    commissionGrid: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 10,
      marginTop: 10,
    },
    commissionTile: {
      flex: 1,
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1, borderColor: C.border,
      padding: 12,
      gap: 6,
    },
    commissionIcon: {
      width: 32, height: 32, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
    },
    commissionTileLabel: { color: C.textSecondary, fontSize: 11, fontWeight: '700',
      textAlign: isRTL ? 'right' : 'left' },
    commissionTileValue: { color: C.text, fontSize: 15, fontWeight: '800',
      textAlign: isRTL ? 'right' : 'left' },

    earningsLinkBtn: {
      marginTop: 10,
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center', gap: 8,
      paddingVertical: 12, paddingHorizontal: 14,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: C.primarySoft,
    },
    earningsLinkText: { flex: 1, color: C.primary, fontWeight: '800', fontSize: 13,
      textAlign: isRTL ? 'right' : 'left' },

    /* Ratings */
    ratingHeroCard: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1, borderColor: C.border,
      padding: 16,
      gap: 12,
      ...SHADOWS.small,
    },
    ratingHeroLeft: { flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start', gap: 4 },
    ratingBig: { color: C.text, fontSize: 36, fontWeight: '900', letterSpacing: -1.2, lineHeight: 40 },
    starsRow: { flexDirection: isRTL ? 'row-reverse' : 'row' },
    ratingCount: { color: C.textSecondary, fontSize: 12, fontWeight: '700' },
    readOnlyChip: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center', gap: 4,
      paddingHorizontal: 9, paddingVertical: 5,
      borderRadius: 999, backgroundColor: C.cardAlt,
    },
    readOnlyChipText: { color: C.textSecondary, fontSize: 10.5, fontWeight: '800' },

    reviewCard: {
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1, borderColor: C.border,
      padding: 12,
      gap: 6,
    },
    reviewTop: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center', gap: 8,
    },
    reviewName: { flex: 1, color: C.text, fontWeight: '800', fontSize: 13.5,
      textAlign: isRTL ? 'right' : 'left' },
    reviewStars: { flexDirection: isRTL ? 'row-reverse' : 'row' },
    reviewComment: { color: C.textSecondary, fontSize: 13, lineHeight: 19,
      textAlign: isRTL ? 'right' : 'left' },
    reviewDate: { color: C.textLight, fontSize: 11, fontWeight: '600', marginTop: 2,
      textAlign: isRTL ? 'right' : 'left' },

    emptyReviews: {
      alignItems: 'center', justifyContent: 'center', gap: 8,
      padding: 24,
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1, borderColor: C.border,
      borderStyle: 'dashed',
    },
    emptyReviewsText: { color: C.textSecondary, fontSize: 12.5, textAlign: 'center', lineHeight: 18 },

    /* Menu */
    menuSection: {
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: 6,
      borderWidth: 1, borderColor: C.border,
      ...SHADOWS.small,
    },
    menuItem: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 14, paddingHorizontal: 10,
      borderBottomWidth: 1, borderBottomColor: C.border,
    },
    menuItemLeft: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 14 },
    menuIconContainer: {
      width: 38, height: 38, borderRadius: 11,
      backgroundColor: C.cardAlt,
      justifyContent: 'center', alignItems: 'center',
    },
    menuLabel: { fontSize: 14.5, fontWeight: '700', color: C.text },

    logoutButton: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center', justifyContent: 'center', gap: 12,
      minHeight: 52,
      backgroundColor: C.errorSoft,
      borderRadius: BORDER_RADIUS.md,
      marginTop: 22,
    },
    logoutText: { fontSize: 15, fontWeight: '800', color: C.error },
  });
