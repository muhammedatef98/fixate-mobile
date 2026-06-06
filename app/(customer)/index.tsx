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
  {
    id: 'market', titleAr: 'السوق', titleEn: 'Marketplace',
    subAr: 'بيع واشترِ الأجهزة', subEn: 'Buy & sell devices',
    icon: 'storefront-outline', accent: '#F59E0B', route: '/market',
  },
  {
    id: 'services', titleAr: 'الخدمات', titleEn: 'Services',
    subAr: 'تصفّح كل خدمات الإصلاح', subEn: 'Browse all repairs',
    icon: 'tools', accent: '#3B82F6', route: '/(customer)/services',
  },
  {
    id: 'orders', titleAr: 'طلباتي', titleEn: 'My Requests',
    subAr: 'تابع حالة طلباتك', subEn: 'Track your repairs',
    icon: 'receipt-outline', accent: '#10B981', route: '/(customer)/orders',
  },
  {
    id: 'addresses', titleAr: 'عناويني', titleEn: 'Addresses',
    subAr: 'إدارة مواقع الخدمة', subEn: 'Manage saved places',
    icon: 'map-marker-outline', accent: '#8B5CF6', route: '/addresses',
  },
];

const TRUST_POINTS = [
  { ar: 'ضمان 6 أشهر', en: '6-month warranty', sub_ar: 'على كل إصلاح', sub_en: 'On every repair', icon: 'shield-check', color: '#10b981' },
  { ar: 'استلام وتوصيل', en: 'Pickup & delivery', sub_ar: 'من بابك', sub_en: 'From your door', icon: 'truck-fast-outline', color: '#3b82f6' },
  { ar: 'فنيون معتمدون', en: 'Verified technicians', sub_ar: 'مهارة موثوقة', sub_en: 'Trusted experts', icon: 'check-decagram', color: '#8b5cf6' },
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
            {isRTL ? 'إصلاح احترافي لأجهزتك، أينما كنت' : 'Expert device repair, wherever you are'}
          </Text>

          {/* Primary CTA — the green action box under the welcome section */}
          <TouchableOpacity
            onPress={() => router.push('/request')}
            style={[styles.cta, { backgroundColor: COLORS.primary }]}
            activeOpacity={0.92}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'اطلب صيانة جديدة' : 'Request a new repair'}
          >
            {/* Soft decorative circles for depth */}
            <View pointerEvents="none" style={styles.ctaBlob1} />
            <View pointerEvents="none" style={styles.ctaBlob2} />
            <View style={{ flex: 1 }}>
              <View style={styles.ctaEyebrowRow}>
                <MaterialCommunityIcons name="lightning-bolt" size={13} color="#fff" />
                <Text style={styles.ctaEyebrow}>
                  {isRTL ? 'صيانة سريعة وسهلة' : 'Quick & easy repair'}
                </Text>
              </View>
              <Text style={styles.ctaTitle}>
                {isRTL ? 'اطلب صيانة جديدة' : 'Request a New Repair'}
              </Text>
              <View style={styles.ctaPill}>
                <MaterialCommunityIcons name="clock-fast" size={14} color={COLORS.primary} />
                <Text style={styles.ctaPillText}>
                  {isRTL ? 'يصلك الفني خلال 30 دقيقة' : 'Tech arrives in 30 min'}
                </Text>
              </View>
            </View>
            <View style={styles.ctaArrowWrap}>
              <RTLIonicon name="arrow-forward" size={24} color={COLORS.primary} />
            </View>
          </TouchableOpacity>

          {/* First-load skeleton (replaces blank flash before data lands) */}
          {loading && !activeOrder && !recentOrder && (
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
              style={[styles.activeOrder, { backgroundColor: COLORS.card, borderColor: COLORS.primary + '30' }]}
              activeOpacity={0.85}
            >
              <View style={[styles.activeOrderIcon, { backgroundColor: COLORS.primary + '15' }]}>
                <MaterialCommunityIcons name="progress-wrench" size={22} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.activeOrderTopRow}>
                  <View style={styles.activePulseDot} />
                  <Text style={[styles.activeOrderTitle, { color: COLORS.text }]}>
                    {isRTL ? 'طلب قيد التنفيذ' : 'Active request'}
                  </Text>
                </View>
                <Text style={[styles.activeOrderSub, { color: COLORS.textSecondary }]} numberOfLines={1}>
                  {activeOrder.device_brand} {activeOrder.device_model}
                </Text>
              </View>
              <View style={[styles.activeTrackChip, { backgroundColor: COLORS.primary + '15' }]}>
                <Text style={[styles.activeTrackText, { color: COLORS.primary }]}>
                  {isRTL ? 'تتبّع' : 'Track'}
                </Text>
                <RTLIonicon name="chevron-forward" size={13} color={COLORS.primary} />
              </View>
            </TouchableOpacity>
          )}

          {/* My Orders — prominent, always-visible access to all orders */}
          <TouchableOpacity
            onPress={() => router.push('/(customer)/orders')}
            style={[styles.myOrdersCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'طلباتي' : 'My orders'}
          >
            <View style={[styles.myOrdersIcon, { backgroundColor: COLORS.primary + '15' }]}>
              <MaterialCommunityIcons name="clipboard-text-clock-outline" size={24} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text style={[styles.myOrdersTitle, { color: COLORS.text }]}>
                {isRTL ? 'طلباتي' : 'My Orders'}
              </Text>
              <Text style={[styles.myOrdersSub, { color: COLORS.textSecondary }]} numberOfLines={1}>
                {isRTL ? 'تتبّع ومتابعة جميع طلبات الإصلاح' : 'Track and manage all your repairs'}
              </Text>
            </View>
            <RTLIonicon name="chevron-forward" size={20} color={COLORS.primary} />
          </TouchableOpacity>

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
                  {isRTL ? 'اطلب إصلاح آخر الآن' : 'Repeat order'}
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
              </PressableScale>
            ))}
          </View>

          {/* Section: Explore — Marketplace / Services / My Requests / Addresses */}
          <Text style={[styles.sectionTitle, { color: COLORS.text, marginBottom: 14 }]}>
            {isRTL ? 'استكشف' : 'Explore'}
          </Text>
          <View style={styles.exploreGrid}>
            {QUICK_ACTIONS.map((q) => (
              <PressableScale
                key={q.id}
                onPress={() => router.push(q.route as any)}
                style={[styles.exploreCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}
                accessibilityRole="button"
                accessibilityLabel={isRTL ? q.titleAr : q.titleEn}
              >
                <View style={[styles.exploreIcon, { backgroundColor: q.accent + '18' }]}>
                  <MaterialCommunityIcons name={q.icon as any} size={24} color={q.accent} />
                </View>
                <Text style={[styles.exploreTitle, { color: COLORS.text }]} numberOfLines={1}>
                  {isRTL ? q.titleAr : q.titleEn}
                </Text>
                <Text style={[styles.exploreSub, { color: COLORS.textSecondary }]} numberOfLines={1}>
                  {isRTL ? q.subAr : q.subEn}
                </Text>
              </PressableScale>
            ))}
          </View>

          {/* Section: Why Fixate — warranty / pickup / verified technicians */}
          <Text style={[styles.sectionTitle, { color: COLORS.text, marginBottom: 14 }]}>
            {isRTL ? 'لماذا Fixate؟' : 'Why Fixate'}
          </Text>
          <View style={styles.trustGrid}>
            {TRUST_POINTS.map((t, i) => (
              <View
                key={i}
                style={[styles.trustTile, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}
              >
                <View style={[styles.trustIcon, { backgroundColor: t.color + '18' }]}>
                  <MaterialCommunityIcons name={t.icon as any} size={22} color={t.color} />
                </View>
                <Text style={[styles.trustTitle, { color: COLORS.text }]} numberOfLines={2}>
                  {isRTL ? t.ar : t.en}
                </Text>
                <Text style={[styles.trustSub, { color: COLORS.textSecondary }]} numberOfLines={1}>
                  {isRTL ? t.sub_ar : t.sub_en}
                </Text>
              </View>
            ))}
          </View>

          {/* AI assistant card — instant answers, can hand off to support */}
          <TouchableOpacity
            onPress={() => router.push('/chatbot')}
            style={[styles.supportCard, { backgroundColor: COLORS.card, borderColor: COLORS.border, marginBottom: 12 }]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'مساعد Fixate الذكي' : 'Fixate AI assistant'}
          >
            <View style={[styles.supportIcon, { backgroundColor: COLORS.primary + '18' }]}>
              <MaterialCommunityIcons name="robot-happy-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text style={[styles.supportTitle, { color: COLORS.text }]}>
                {isRTL ? 'مساعد Fixate الذكي' : 'Fixate AI Assistant'}
              </Text>
              <Text style={[styles.supportSub, { color: COLORS.textSecondary }]}>
                {isRTL ? 'إجابات فورية لأسئلتك الشائعة' : 'Instant answers to common questions'}
              </Text>
            </View>
            <RTLMaterialIcon name="chevron-right" size={20} color={COLORS.primary} />
          </TouchableOpacity>

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
    ctaEyebrowRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 5,
    },
    ctaEyebrow: { color: '#ffffffdd', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
    ctaTitle: { color: '#fff', fontSize: 25, fontWeight: '900', marginTop: 6, textAlign: isRTL ? 'right' : 'left' },
    ctaPill: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#fff',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      alignSelf: isRTL ? 'flex-end' : 'flex-start',
      marginTop: 16,
    },
    ctaPillText: { color: C.primary, fontSize: 12, fontWeight: '800' },
    ctaArrowWrap: {
      width: 52, height: 52, borderRadius: 26,
      backgroundColor: '#fff',
      alignItems: 'center', justifyContent: 'center',
      marginStart: 12,
    },
    ctaBlob1: {
      position: 'absolute',
      width: 150, height: 150, borderRadius: 75,
      backgroundColor: '#ffffff14',
      top: -55, [isRTL ? 'left' : 'right']: -35,
    },
    ctaBlob2: {
      position: 'absolute',
      width: 90, height: 90, borderRadius: 45,
      backgroundColor: '#ffffff10',
      bottom: -30, [isRTL ? 'left' : 'right']: 60,
    },

    activeOrder: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      padding: 14,
      marginBottom: 24,
      ...SHADOWS.small,
    },
    activeOrderIcon: {
      width: 44, height: 44, borderRadius: 13,
      alignItems: 'center', justifyContent: 'center',
    },
    activeOrderTopRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
    },
    activePulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b' },
    activeOrderTitle: { fontSize: 14, fontWeight: '800', textAlign: isRTL ? 'right' : 'left' },
    activeOrderSub: { fontSize: 12, marginTop: 3, textAlign: isRTL ? 'right' : 'left' },
    activeTrackChip: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
    },
    activeTrackText: { fontSize: 12, fontWeight: '800' },

    sectionHead: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
      marginTop: 8,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '800',
      // Section titles must sit on the start edge of the section grid.
      // Without an explicit alignment, RN inherits the default (left) and
      // the title sat flush-left in Arabic above a row-reverse grid that
      // started on the right — visually disconnected.
      textAlign: isRTL ? 'right' : 'left',
      writingDirection: isRTL ? 'rtl' : 'ltr',
    },

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

    // My Orders quick-access card
    myOrdersCard: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      padding: 16,
      marginBottom: 24,
      ...SHADOWS.small,
    },
    myOrdersIcon: {
      width: 48, height: 48, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center',
    },
    myOrdersTitle: { fontSize: 16, fontWeight: '800', textAlign: isRTL ? 'right' : 'left' },
    myOrdersSub: { fontSize: 12, marginTop: 2, textAlign: isRTL ? 'right' : 'left' },

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

    // Explore grid — 2-column action cards
    exploreGrid: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 24,
    },
    exploreCard: {
      width: (width - SPACING.m * 2 - 12) / 2,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      padding: 16,
      gap: 8,
      ...SHADOWS.small,
    },
    exploreIcon: {
      width: 46, height: 46, borderRadius: 13,
      alignItems: 'center', justifyContent: 'center',
    },
    exploreTitle: { fontSize: 15, fontWeight: '800', textAlign: isRTL ? 'right' : 'left' },
    exploreSub: { fontSize: 11, fontWeight: '500', textAlign: isRTL ? 'right' : 'left' },

    // Why Fixate — 3-column trust tiles
    trustGrid: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 10,
      marginBottom: 20,
    },
    trustTile: {
      flex: 1,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      paddingVertical: 16,
      paddingHorizontal: 10,
      alignItems: 'center',
      gap: 7,
      ...SHADOWS.small,
    },
    trustIcon: {
      width: 44, height: 44, borderRadius: 13,
      alignItems: 'center', justifyContent: 'center',
    },
    trustTitle: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
    trustSub: { fontSize: 10, fontWeight: '500', textAlign: 'center' },

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
