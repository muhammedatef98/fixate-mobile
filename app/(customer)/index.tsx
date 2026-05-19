import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import BottomNav from '../../components/BottomNav';
import Sidebar from '../../components/Sidebar';
import { supabase } from '../../services/supabaseClient';
import { logger } from '../../utils/logger';
import { RTLIonicon, RTLMaterialIcon } from '../../components/RTLIcon';
import { PressableScale } from '../../components/ui/PressableScale';
import { Skeleton } from '../../components/ui/Skeleton';

const { width } = Dimensions.get('window');

const DEVICE_CATEGORIES = [
  // fromPrice = lowest mid-tier KSA price for the cheapest issue per device
  // (software/charging port). See docs/business/SAUDI_PRICING_2026.md.
  { id: 'phone', titleEn: 'Phones', titleAr: 'جوّالات', icon: 'cellphone', accent: '#10B981', fromPrice: 80 },
  { id: 'laptop', titleEn: 'Laptops', titleAr: 'لابتوب', icon: 'laptop', accent: '#3B82F6', fromPrice: 100 },
  { id: 'tablet', titleEn: 'Tablets', titleAr: 'تابلت', icon: 'tablet', accent: '#8B5CF6', fromPrice: 100 },
  { id: 'watch', titleEn: 'Watches', titleAr: 'ساعات', icon: 'watch-variant', accent: '#F59E0B', fromPrice: 150 },
];

const QUICK_ACTIONS = [
  { id: 'calculator', titleAr: 'الحاسبة', titleEn: 'Calculator', icon: 'calculator-outline', route: '/(customer)/calculator' },
  { id: 'services', titleAr: 'الخدمات', titleEn: 'Services', icon: 'tools', route: '/(customer)/services' },
  { id: 'orders', titleAr: 'طلباتي', titleEn: 'My orders', icon: 'receipt-outline', route: '/(customer)/orders' },
  { id: 'addresses', titleAr: 'عناويني', titleEn: 'Addresses', icon: 'location-outline', route: '/addresses' },
];

const TRUST_POINTS = [
  { ar: 'ضمان 6 أشهر', en: '6-month warranty', icon: 'shield-check', color: '#10b981' },
  { ar: 'استلام مجاني', en: 'Free pickup', icon: 'truck-fast-outline', color: '#3b82f6' },
  { ar: 'فنيون معتمدون', en: 'Verified pros', icon: 'check-decagram', color: '#8b5cf6' },
];

export default function CustomerHomeScreen() {
  const router = useRouter();
  const { language, setLanguage, isDark } = useApp();
  const { user, userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';

  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [recentOrder, setRecentOrder] = useState<any>(null);
  const [stats, setStats] = useState<{ completed: number; rating: number; reviews: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  const displayName =
    (userProfile?.name?.trim() || user?.email?.split('@')[0] || '').split(' ')[0] ||
    (isRTL ? 'صديقي' : 'there');

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
    (async () => {
      try {
        await Promise.allSettled([
          user?.id ? loadActiveOrder() : Promise.resolve(),
          user?.id ? loadRecentOrder() : Promise.resolve(),
          loadGlobalStats(),
        ]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  const loadActiveOrder = async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase
        .from('orders')
        .select('id, status, device_brand, device_model')
        .eq('user_id', user.id)
        .in('status', ['pending', 'accepted', 'picking_up', 'diagnosing', 'waiting_parts', 'repairing', 'testing', 'delivering'])
        .order('created_at', { ascending: false })
        .limit(1);
      setActiveOrder(data?.[0] ?? null);
    } catch (e) {
      logger.warn('home loadActiveOrder failed', e);
    }
  };

  const loadRecentOrder = async () => {
    if (!user?.id) return;
    try {
      // Most recent COMPLETED order — surfaces a one-tap "Repeat order" CTA
      // for returning customers (raises repeat-rate without nagging).
      const { data } = await supabase
        .from('orders')
        .select('id, device_brand, device_model, issue_description, status, estimated_price, created_at')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1);
      setRecentOrder(data?.[0] ?? null);
    } catch (e) {
      logger.warn('home loadRecentOrder failed', e);
    }
  };

  const loadGlobalStats = async () => {
    // Platform-wide social proof: count of completed jobs + avg rating
    // across the platform (not user-specific). Cached client-side via the
    // 12 s fetch ceiling so it doesn't slow first paint.
    try {
      const [{ count: completed }, { data: reviews }] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('reviews').select('rating'),
      ]);
      const ratings = (reviews ?? []).map((r: any) => r.rating).filter((n: any) => typeof n === 'number');
      const avg = ratings.length ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0;
      setStats({ completed: completed ?? 0, rating: Number(avg.toFixed(1)), reviews: ratings.length });
    } catch (e) {
      logger.warn('home loadGlobalStats failed', e);
    }
  };

  const styles = makeStyles(COLORS, isRTL, SHADOWS);
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return isRTL ? 'صباح الخير' : 'Good morning';
    if (h < 18) return isRTL ? 'مساء الخير' : 'Good afternoon';
    return isRTL ? 'مساء الخير' : 'Good evening';
  })();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => setSidebarVisible(true)}
          style={[styles.iconBtn, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'القائمة' : 'Menu'}
        >
          <Ionicons name="menu" size={20} color={COLORS.text} />
        </TouchableOpacity>

        <Text style={[styles.logo, { color: COLORS.primary }]}>Fixate</Text>

        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            style={[styles.iconBtn, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'تبديل اللغة' : 'Toggle language'}
          >
            <Ionicons name="language" size={18} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/notifications')}
            style={[styles.iconBtn, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'الإشعارات' : 'Notifications'}
          >
            <Ionicons name="notifications-outline" size={18} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], paddingHorizontal: SPACING.m, paddingTop: SPACING.s, paddingBottom: SPACING.m }}>
          {/* Greeting */}
          <Text style={[styles.greetingSmall, { color: COLORS.textSecondary }]}>{greeting} 👋</Text>
          <Text style={[styles.greetingName, { color: COLORS.text }]} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={[styles.greetingSub, { color: COLORS.textSecondary }]}>
            {isRTL ? 'كيف نقدر نصلّح لك؟' : 'How can we fix things today?'}
          </Text>

          {/* Primary CTA */}
          <TouchableOpacity
            onPress={() => router.push('/request')}
            style={[styles.cta, { backgroundColor: COLORS.primary }]}
            activeOpacity={0.92}
            accessibilityRole="button"
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.ctaEyebrow}>
                {isRTL ? 'صيانة سريعة وسهلة' : 'Quick & easy repair'}
              </Text>
              <Text style={styles.ctaTitle}>
                {isRTL ? 'اطلب صيانة الآن' : 'Request a repair'}
              </Text>
              <View style={styles.ctaPill}>
                <Text style={styles.ctaPillText}>
                  {isRTL ? 'يصلك الفني خلال 30 دقيقة' : 'Tech arrives in 30 min'}
                </Text>
                <RTLIonicon name="arrow-forward" size={14} color={COLORS.primary} />
              </View>
            </View>
            <View style={styles.ctaIconWrap}>
              <MaterialCommunityIcons name="tools" size={68} color="#ffffff15" />
            </View>
          </TouchableOpacity>

          {/* First-load skeleton (replaces blank flash before data lands) */}
          {loading && !activeOrder && !recentOrder && !stats && (
            <View style={{ marginTop: 4 }}>
              <Skeleton height={64} radius={14} style={{ marginBottom: 16 }} />
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12, marginBottom: 22 }}>
                <Skeleton height={120} radius={12} style={{ flex: 1 }} />
                <Skeleton height={120} radius={12} style={{ flex: 1 }} />
              </View>
            </View>
          )}

          {/* Active order banner */}
          {activeOrder && (
            <TouchableOpacity
              onPress={() => router.push(`/order-details?id=${activeOrder.id}`)}
              style={[styles.activeOrder, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}
              activeOpacity={0.85}
            >
              <View style={[styles.dot, { backgroundColor: '#f59e0b' }]} />
              <View style={{ flex: 1, marginHorizontal: 12 }}>
                <Text style={[styles.activeOrderTitle, { color: COLORS.text }]}>
                  {isRTL ? 'لديك طلب جارٍ' : 'You have an active order'}
                </Text>
                <Text style={[styles.activeOrderSub, { color: COLORS.textSecondary }]} numberOfLines={1}>
                  {activeOrder.device_brand} {activeOrder.device_model} · #{activeOrder.id.slice(0, 6)}
                </Text>
              </View>
              <RTLIonicon name="chevron-forward" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          )}

          {/* Social proof — global completed-job count + avg rating */}
          {stats && (stats.completed > 0 || stats.reviews > 0) && (
            <View style={[styles.socialProof, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
              <View style={styles.spItem}>
                <View style={[styles.spIcon, { backgroundColor: '#10b98120' }]}>
                  <MaterialCommunityIcons name="check-decagram" size={18} color="#10b981" />
                </View>
                <Text style={[styles.spValue, { color: COLORS.text }]}>
                  {stats.completed >= 1000 ? `+${Math.floor(stats.completed / 100) / 10}K` : `+${stats.completed}`}
                </Text>
                <Text style={[styles.spLabel, { color: COLORS.textSecondary }]}>
                  {isRTL ? 'إصلاح ناجح' : 'successful repairs'}
                </Text>
              </View>
              <View style={[styles.spDivider, { backgroundColor: COLORS.border }]} />
              <View style={styles.spItem}>
                <View style={[styles.spIcon, { backgroundColor: '#f59e0b20' }]}>
                  <MaterialCommunityIcons name="star" size={18} color="#f59e0b" />
                </View>
                <Text style={[styles.spValue, { color: COLORS.text }]}>
                  {stats.rating > 0 ? stats.rating.toFixed(1) : '5.0'}
                </Text>
                <Text style={[styles.spLabel, { color: COLORS.textSecondary }]}>
                  {isRTL
                    ? `من ${stats.reviews || 0} تقييم`
                    : `from ${stats.reviews || 0} reviews`}
                </Text>
              </View>
            </View>
          )}

          {/* Recent order — one-tap repeat for returning customers */}
          {recentOrder && (
            <View style={[styles.recentCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
              <View style={styles.recentTop}>
                <Text style={[styles.recentEyebrow, { color: COLORS.textSecondary }]}>
                  {isRTL ? 'آخر طلب' : 'Last order'}
                </Text>
                <Text style={[styles.recentDate, { color: COLORS.textSecondary }]}>
                  {new Date(recentOrder.created_at).toLocaleDateString(language === 'ar' ? 'ar' : 'en-US', { day: '2-digit', month: 'short' })}
                </Text>
              </View>
              <Text style={[styles.recentTitle, { color: COLORS.text }]} numberOfLines={1}>
                {recentOrder.device_brand} {recentOrder.device_model}
              </Text>
              {recentOrder.issue_description && (
                <Text style={[styles.recentIssue, { color: COLORS.textSecondary }]} numberOfLines={1}>
                  {recentOrder.issue_description}
                </Text>
              )}
              <TouchableOpacity
                onPress={() => router.push('/request')}
                style={[styles.recentBtn, { backgroundColor: COLORS.primary + '15' }]}
                accessibilityRole="button"
              >
                <MaterialCommunityIcons name="repeat" size={16} color={COLORS.primary} />
                <Text style={{ color: COLORS.primary, fontSize: 13, fontWeight: '700' }}>
                  {isRTL ? 'اطلب نفس الإصلاح' : 'Repeat order'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Section: Choose your device */}
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
              {isRTL ? 'اختر جهازك' : 'Choose device'}
            </Text>
            <TouchableOpacity onPress={() => router.push('/(customer)/services')}>
              <Text style={{ color: COLORS.primary, fontSize: 13, fontWeight: '700' }}>
                {isRTL ? 'كل الخدمات' : 'See all'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.deviceGrid}>
            {DEVICE_CATEGORIES.map((cat) => (
              <PressableScale
                key={cat.id}
                style={[styles.deviceCard, { backgroundColor: COLORS.card }]}
                onPress={() => router.push('/request')}
                accessibilityRole="button"
              >
                <View style={[styles.deviceIcon, { backgroundColor: cat.accent + '15' }]}>
                  <MaterialCommunityIcons name={cat.icon as any} size={26} color={cat.accent} />
                </View>
                <Text style={[styles.deviceLabel, { color: COLORS.text }]}>
                  {isRTL ? cat.titleAr : cat.titleEn}
                </Text>
                <Text style={[styles.devicePrice, { color: COLORS.primary }]}>
                  {isRTL ? `يبدأ من ${cat.fromPrice} ر.س` : `From ${cat.fromPrice} SAR`}
                </Text>
              </PressableScale>
            ))}
          </View>

          {/* Quick actions row */}
          <View style={styles.quickRow}>
            {QUICK_ACTIONS.map((q) => (
              <PressableScale
                key={q.id}
                onPress={() => router.push(q.route as any)}
                style={[styles.quickPill, { backgroundColor: COLORS.card }]}
                accessibilityRole="button"
              >
                <MaterialCommunityIcons name={q.icon as any} size={20} color={COLORS.primary} />
                <Text style={[styles.quickText, { color: COLORS.text }]} numberOfLines={1}>
                  {isRTL ? q.titleAr : q.titleEn}
                </Text>
              </PressableScale>
            ))}
          </View>

          {/* Trust strip */}
          <View style={[styles.trustCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
            {TRUST_POINTS.map((t, i) => (
              <View key={i} style={[styles.trustItem, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: COLORS.border, paddingLeft: 12 }]}>
                <View style={[styles.trustIcon, { backgroundColor: t.color + '15' }]}>
                  <MaterialCommunityIcons name={t.icon as any} size={16} color={t.color} />
                </View>
                <Text style={[styles.trustText, { color: COLORS.text }]} numberOfLines={2}>
                  {isRTL ? t.ar : t.en}
                </Text>
              </View>
            ))}
          </View>

          {/* Support card */}
          <TouchableOpacity
            onPress={() => router.push('/support-chat')}
            style={[styles.supportCard, { backgroundColor: COLORS.primary + '10', borderColor: COLORS.primary + '30' }]}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <View style={[styles.supportIcon, { backgroundColor: COLORS.primary }]}>
              <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text style={[styles.supportTitle, { color: COLORS.text }]}>
                {isRTL ? 'تحتاج مساعدة؟' : 'Need help?'}
              </Text>
              <Text style={[styles.supportSub, { color: COLORS.textSecondary }]}>
                {isRTL ? 'تواصل مع فريق الدعم مباشرة' : 'Chat with our support team'}
              </Text>
            </View>
            <RTLMaterialIcon name="chevron-right" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      <BottomNav />
      <Sidebar visible={sidebarVisible} onClose={() => setSidebarVisible(false)} />
    </SafeAreaView>
  );
}

const makeStyles = (C: any, isRTL: boolean, SHADOWS: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },

    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    iconBtn: {
      width: 38, height: 38, borderRadius: 19,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1,
    },
    logo: { fontSize: 22, fontWeight: '900', letterSpacing: 0.5 },

    greetingSmall: { fontSize: 14, fontWeight: '600', textAlign: isRTL ? 'right' : 'left' },
    greetingName: { fontSize: 28, fontWeight: '800', marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
    greetingSub: { fontSize: 14, marginTop: 4, marginBottom: 20, textAlign: isRTL ? 'right' : 'left' },

    cta: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      borderRadius: 24,
      padding: 22,
      marginBottom: 14,
      overflow: 'hidden',
      shadowColor: C.primary,
      shadowOpacity: 0.3,
      shadowOffset: { width: 0, height: 10 },
      shadowRadius: 20,
      elevation: 8,
      minHeight: 158,
    },
    ctaEyebrow: { color: '#ffffffcc', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
    ctaTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 4 },
    ctaPill: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#fff',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      alignSelf: isRTL ? 'flex-end' : 'flex-start',
      marginTop: 14,
    },
    ctaPillText: { color: C.primary, fontSize: 12, fontWeight: '700' },
    ctaIconWrap: { justifyContent: 'center', alignItems: 'center' },

    activeOrder: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      borderRadius: BORDER_RADIUS.md,
      padding: 16,
      marginBottom: 24,
      ...SHADOWS.small,
    },
    dot: { width: 10, height: 10, borderRadius: 5 },
    activeOrderTitle: { fontSize: 13, fontWeight: '800' },
    activeOrderSub: { fontSize: 11, marginTop: 2 },

    sectionHead: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
      marginTop: 8,
    },
    sectionTitle: { fontSize: 20, fontWeight: '800' },

    deviceGrid: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 24,
    },
    deviceCard: {
      width: (width - SPACING.m * 2 - 12) / 2,
      borderRadius: BORDER_RADIUS.md,
      padding: 16,
      alignItems: 'center',
      gap: 10,
      ...SHADOWS.small,
    },
    deviceIcon: {
      width: 52, height: 52, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center',
    },
    deviceLabel: { fontSize: 14, fontWeight: '700' },
    devicePrice: { fontSize: 11, fontWeight: '700', marginTop: 2 },

    // Social proof
    socialProof: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      borderRadius: BORDER_RADIUS.md,
      paddingVertical: 16,
      paddingHorizontal: 8,
      marginBottom: 16,
      alignItems: 'center',
      ...SHADOWS.small,
    },
    spItem: { flex: 1, alignItems: 'center', gap: 4 },
    spIcon: {
      width: 32, height: 32, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center', marginBottom: 4,
    },
    spValue: { fontSize: 19, fontWeight: '800' },
    spLabel: { fontSize: 11, fontWeight: '500' },
    spDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 6 },

    // Recent activity card
    recentCard: {
      borderRadius: BORDER_RADIUS.md,
      padding: 16,
      marginBottom: 24,
      ...SHADOWS.small,
    },
    recentTop: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    recentEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
    recentDate: { fontSize: 11, fontWeight: '500' },
    recentTitle: { fontSize: 15, fontWeight: '800', textAlign: isRTL ? 'right' : 'left' },
    recentIssue: { fontSize: 12, marginTop: 4, textAlign: isRTL ? 'right' : 'left' },
    recentBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      alignSelf: isRTL ? 'flex-end' : 'flex-start',
      marginTop: 12,
    },

    quickRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 22,
    },
    quickPill: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 999,
      ...SHADOWS.small,
    },
    quickText: { fontSize: 14, fontWeight: '600' },

    trustCard: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      borderRadius: BORDER_RADIUS.md,
      padding: 16,
      marginBottom: 18,
      gap: 4,
      ...SHADOWS.small,
    },
    trustItem: {
      flex: 1,
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
    },
    trustIcon: {
      width: 30, height: 30, borderRadius: 9,
      alignItems: 'center', justifyContent: 'center',
    },
    trustText: { fontSize: 11, fontWeight: '600', flex: 1 },

    supportCard: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      padding: 16,
    },
    supportIcon: {
      width: 42, height: 42, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
    },
    supportTitle: { fontSize: 14, fontWeight: '700' },
    supportSub: { fontSize: 12, marginTop: 2 },
  });
