import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Modal,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import BottomNav, {
  BOTTOM_NAV_TOP,
  BOTTOM_NAV_ACCESSORY_GAP,
} from '../../components/BottomNav';
import Sidebar from '../../components/Sidebar';
import { supabase } from '../../services/supabaseClient';
import { ORDER_STATUS_LABELS_AR, ORDER_STATUS_LABELS_EN } from '../../types/order';
import { formatAppDateOnly } from '../../lib/formatDate';
import { logger } from '../../utils/logger';
import { resolveGreetingName } from '../../utils/greeting';
import { getWalletBalance } from '../../services/customerWalletService';
import { getUnreadCount } from '../../utils/notifications';
import { RTLIonicon } from '../../components/RTLIcon';
import { PressableScale, AnimatedTouchable } from '../../components/ui/PressableScale';
import { Skeleton } from '../../components/ui/Skeleton';
import HomeHighlightsCarousel from '../../components/HomeHighlightsCarousel';
import AnnouncementBanner from '../../components/AnnouncementBanner';
import { Riyal } from '../../components/Riyal';

const { width } = Dimensions.get('window');

const DEVICE_CATEGORIES = [
  // fromPrice = lowest mid-tier KSA price for the cheapest issue per device
  // (software/charging port). See docs/business/SAUDI_PRICING_2026.md.
  { id: 'phone', titleEn: 'Phones', titleAr: 'جوّالات', icon: 'cellphone', accent: '#10B981', fromPrice: 80 },
  { id: 'laptop', titleEn: 'Laptops', titleAr: 'لابتوب', icon: 'laptop', accent: '#3B82F6', fromPrice: 100 },
  { id: 'tablet', titleEn: 'Tablets', titleAr: 'تابلت', icon: 'tablet', accent: '#8B5CF6', fromPrice: 100 },
  { id: 'watch', titleEn: 'Watches', titleAr: 'ساعات', icon: 'watch-variant', accent: '#F59E0B', fromPrice: 150 },
];

// Smart-assistant floating icon. It is passed to <BottomNav above={...} />, which
// lays it out inside the bar's own container — directly above the bar's top edge,
// on its trailing side, separated by BOTTOM_NAV_ACCESSORY_GAP. Nothing here
// positions it, which is the point: the two can no longer be measured against
// different parents and drift apart on one platform but not the other.
//
// Only the SIZE lives here, because the scroll padding below has to reserve room
// for the puck as well as the bar.
const ASSISTANT_FAB_SIZE = 54;

// Warranty length applied to every completed repair (months). Used to derive
// the warranty-expiry date shown on the home "Repair warranty" card.
// Fixate offers a full 1-year (12-month / 365-day) warranty on all repairs.
const WARRANTY_MONTHS = 12;

// Rotating daily maintenance tips. The active tip is picked by the day-of-year
// so it changes once a day at midnight and is stable for the whole day.
//
// SCOPE — Fixate repairs personal electronics ONLY: phones (iPhone/Android),
// laptops, desktop computers, tablets/iPads and smartwatches. Tips must stay
// inside that domain. No home appliances (washing machines, fridges, TVs,
// ovens, routers) — we don't service them, so a tip about them sends the wrong
// signal about what the app does.
const DAILY_TIPS: { ar: string; en: string }[] = [
  // Battery & charging
  { ar: 'لا تترك جوالك يشحن طوال الليل باستمرار للحفاظ على عمر البطارية.', en: 'Avoid charging your phone overnight constantly to protect battery life.' },
  { ar: 'أبقِ نسبة شحن بطارية جهازك بين 20% و80% لإطالة عمرها.', en: 'Keep your device battery between 20% and 80% to extend its lifespan.' },
  { ar: 'لا تستخدم شواحن مقلّدة رخيصة؛ فقد تتلف البطارية أو لوحة الشحن.', en: 'Avoid cheap counterfeit chargers — they can damage the battery or charging board.' },
  { ar: 'افحص كابلات الشحن دورياً واستبدل أي كابل مكشوف أو متآكل فوراً.', en: 'Inspect charging cables regularly and replace any frayed or exposed cable immediately.' },
  { ar: 'انتفاخ بطارية الجوال أو اللابتوب خطر — أوقف استخدام الجهاز واطلب فنياً فوراً.', en: 'A swollen phone or laptop battery is dangerous — stop using the device and request a technician right away.' },
  { ar: 'إذا نفدت بطارية جوالك بسرعة غير معتادة، فغالباً حان وقت استبدالها.', en: 'If your phone battery drains unusually fast, it is probably time to replace it.' },
  { ar: 'لا تشحن جوالك أو تابلتك وهو داخل غطاء سميك؛ الحرارة تُتعب البطارية.', en: "Don't charge your phone or tablet inside a thick case — the trapped heat wears the battery." },

  // Phones & tablets (iPhone / iPad / Android)
  { ar: 'نظّف منفذ الشحن في جوالك من الغبار بفرشاة ناعمة لتجنب مشاكل الشحن.', en: "Clean your phone's charging port with a soft brush to avoid charging issues." },
  { ar: 'استخدم واقي شاشة وجراب جيد لجوالك أو تابلتك لتقليل أعطال السقوط.', en: 'Use a screen protector and a good case for your phone or tablet to reduce drop damage.' },
  { ar: 'لا تترك التابلت أو الآيباد في السيارة تحت الشمس؛ الحرارة تنتفخ البطارية.', en: 'Never leave a tablet or iPad in a hot car — heat can swell the battery.' },
  { ar: 'مقاومة الماء في الجوالات تضعف مع تقادم الجهاز وبعد أي فتح أو إصلاح.', en: 'Water resistance weakens as a phone ages — and after any opening or repair.' },
  { ar: 'نظّف السماعات وفتحات المايك بفرشاة ناعمة جافة لتحسين جودة الصوت.', en: 'Clean speaker and mic grilles with a soft dry brush to keep sound clear.' },
  { ar: 'إذا ظهرت خطوط أو بقع على شاشة جوالك، لا تضغط عليها — الشاشة تحتاج فحصاً.', en: 'Lines or blotches on your phone screen mean the display needs inspection — avoid pressing on it.' },
  { ar: 'شاشة الجوال المكسورة تسمح للغبار والرطوبة بالدخول — أصلحها مبكراً قبل أن يتلف الداخل.', en: 'A cracked phone screen lets in dust and moisture — repair it early, before the internals are damaged.' },
  { ar: 'أعد تشغيل جوالك مرة كل أسبوع؛ يحل كثيراً من مشاكل البطء والتعليق.', en: 'Restart your phone once a week — it clears up a lot of slowdown and freezing issues.' },
  { ar: 'اترك 10% من مساحة تخزين جوالك فارغة على الأقل حتى لا يتباطأ النظام.', en: 'Keep at least 10% of your phone storage free, or the system starts to crawl.' },

  // Laptops & computers
  { ar: 'لا تشغّل اللابتوب على سطح ناعم كالسرير حتى لا تُسد فتحات التهوية.', en: "Don't use your laptop on soft surfaces like a bed — it blocks the air vents." },
  { ar: 'نظّف مروحة اللابتوب وفتحات التبريد كل بضعة أشهر لمنع ارتفاع الحرارة.', en: "Clean your laptop's fan and vents every few months to prevent overheating." },
  { ar: 'صوت مروحة عالٍ باستمرار مع بطء في اللابتوب = غبار أو معجون حراري يحتاج تغييراً.', en: 'A constantly loud fan plus a slow laptop usually means dust buildup or thermal paste due for a change.' },
  { ar: 'لا تحمل اللابتوب من الشاشة؛ ذلك يكسر المفصلات وكيبل الشاشة.', en: "Don't carry a laptop by its screen — it breaks the hinges and the display cable." },
  { ar: 'لا تضع أي سائل قرب لوحة مفاتيح اللابتوب؛ الانسكاب يتلف اللوحة الأم.', en: 'Keep liquids away from your laptop keyboard — a spill can destroy the motherboard.' },
  { ar: 'ترقية الرام أو تركيب قرص SSD يعيد الحياة لجهاز كمبيوتر بطيء بتكلفة أقل من شراء جديد.', en: 'A RAM upgrade or an SSD brings a slow computer back to life for far less than a new one.' },
  { ar: 'أغلق التطبيقات التي تعمل في الخلفية لتقليل استهلاك البطارية والحرارة.', en: 'Close background apps to reduce battery drain and heat.' },
  { ar: 'نظّف غبار صندوق الكمبيوتر المكتبي دورياً؛ الغبار يخنق التبريد ويرفع الحرارة.', en: 'Dust out your desktop PC regularly — dust chokes the cooling and drives temperatures up.' },
  { ar: 'لا تفصل الفلاش ميموري أو الهارد الخارجي أثناء نقل الملفات لتجنّب التلف.', en: 'Never unplug a USB drive or external disk mid-transfer to avoid corruption.' },

  // Cross-device good practice
  { ar: 'حدّث نظام جوالك أو لابتوبك بانتظام لإصلاح الثغرات وتحسين الأداء.', en: 'Update your phone or laptop regularly to fix bugs and improve performance.' },
  { ar: 'اعمل نسخة احتياطية لبيانات جوالك أسبوعياً تحسّباً لأي عطل مفاجئ.', en: "Back up your phone's data weekly in case of a sudden failure." },
  { ar: 'خذ نسخة احتياطية من بياناتك قبل تسليم أي جهاز للصيانة.', en: 'Back up your data before handing any device in for repair.' },
  { ar: 'أبعد جوالك ولابتوبك عن الحرارة العالية وأشعة الشمس المباشرة.', en: 'Keep your phone and laptop away from high heat and direct sunlight.' },
  { ar: 'خفّض سطوع الشاشة قليلاً لإطالة عمر البطارية وراحة عينيك.', en: 'Lower your screen brightness a bit to extend battery life and ease eye strain.' },
  { ar: 'عند سقوط الجهاز في الماء، أطفئه فوراً ولا تشحنه وتواصل مع فني مختص.', en: 'If a device gets wet, power it off immediately, don’t charge it, and contact a technician.' },
  { ar: 'الأرز لا ينقذ جهازاً مبلولاً — الحل الوحيد هو تنظيف داخلي على يد فني.', en: 'Rice does not save a wet device — only an internal cleaning by a technician does.' },
  { ar: 'احفظ فاتورة وضمان أجهزتك في مكان واحد يسهل الرجوع إليه عند الصيانة.', en: 'Keep your devices’ invoices and warranties in one place for easy reference during service.' },
];

const getDailyTip = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return DAILY_TIPS[dayOfYear % DAILY_TIPS.length];
};

const TRUST_POINTS = [
  { ar: 'ضمان سنة كاملة', en: '1-year warranty', sub_ar: 'على كل إصلاح', sub_en: 'On every repair', icon: 'shield-check', color: '#10b981' },
  { ar: 'استلام وتوصيل', en: 'Pickup & delivery', sub_ar: 'من بابك', sub_en: 'From your door', icon: 'truck-fast-outline', color: '#3b82f6' },
  { ar: 'فنيون معتمدون', en: 'Verified technicians', sub_ar: 'مهارة موثوقة', sub_en: 'Trusted experts', icon: 'check-decagram', color: '#8b5cf6' },
];

export default function CustomerHomeScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user, userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';

  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [recentOrder, setRecentOrder] = useState<any>(null);
  const [pendingQuotes, setPendingQuotes] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [tipSheetOpen, setTipSheetOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // First name only. Empty string when a brand-new signup has neither a
  // profile name nor an email handle — the greeting then renders alone (no
  // awkward blank / "there" / "صديقي" placeholder after it).
  const displayName =
    resolveGreetingName(userProfile?.name, user?.email) ||
    (isRTL ? 'عميلنا العزيز' : 'Valued customer');

  // All home data in one place so both the initial load and pull-to-refresh
  // fetch the same set (wallet, active/recent order, pending quotes, unread).
  const loadHomeData = useCallback(async () => {
    if (!user?.id) return;
    await Promise.allSettled([
      getWalletBalance(user.id).then(setWalletBalance).catch(() => {}),
      loadActiveOrder(),
      loadRecentOrder(),
      loadPendingQuotes(),
      getUnreadCount(user.id).then(setUnreadNotifications).catch(() => {}),
    ]);
  }, [user?.id]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
    (async () => {
      try {
        await loadHomeData();
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id, loadHomeData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadHomeData();
    } finally {
      setRefreshing(false);
    }
  }, [loadHomeData]);

  // Refresh the unread-notifications badge every time the home tab regains
  // focus (e.g. returning from the notifications screen after reading some),
  // not just on mount — otherwise the badge would go stale.
  useFocusEffect(
    useCallback(() => {
      if (!user?.id) {
        setUnreadNotifications(0);
        return;
      }
      let cancelled = false;
      getUnreadCount(user.id)
        .then((n) => { if (!cancelled) setUnreadNotifications(n); })
        .catch(() => {});
      return () => { cancelled = true; };
    }, [user?.id])
  );

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
        .select('id, device_brand, device_model, issue_description, status, estimated_price, created_at, updated_at')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1);
      setRecentOrder(data?.[0] ?? null);
    } catch (e) {
      logger.warn('home loadRecentOrder failed', e);
    }
  };

  // Count of orders awaiting the customer's payment confirmation — drives the
  // badge on the quick action (payment v2: the accepted offer goes straight
  // to payment, there is no separate quote-approval state anymore).
  const loadPendingQuotes = async () => {
    if (!user?.id) return;
    try {
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'awaiting_payment');
      setPendingQuotes(count ?? 0);
    } catch (e) {
      logger.warn('home loadPendingQuotes failed', e);
    }
  };

  const styles = makeStyles(COLORS, isRTL, SHADOWS);

  // ── Derived data for the home action cards (FEAT-06) ──────────────
  const statusLabels = isRTL ? ORDER_STATUS_LABELS_AR : ORDER_STATUS_LABELS_EN;
  const activeStatusLabel = activeOrder
    ? (statusLabels[activeOrder.status as keyof typeof statusLabels] ??
       (isRTL ? 'قيد المتابعة' : 'In progress'))
    : null;

  // Warranty expiry = completion date + WARRANTY_MONTHS. We use updated_at as
  // the completion proxy (orders flip to "completed" on their last update).
  const warrantyExpiry = (() => {
    const base = recentOrder?.updated_at ?? recentOrder?.created_at;
    if (!base) return null;
    const d = new Date(base);
    if (Number.isNaN(d.getTime())) return null;
    d.setMonth(d.getMonth() + WARRANTY_MONTHS);
    return d;
  })();
  const warrantyActive = !!warrantyExpiry && warrantyExpiry.getTime() > Date.now();
  // Gregorian (Miladi) only — formatAppDateOnly pins the gregory calendar so
  // the expiry never renders as a Hijri date (ar-SA defaults to Hijri on
  // Hermes, which is why we must not use toLocaleDateString here).
  const warrantyLabel = warrantyExpiry ? formatAppDateOnly(warrantyExpiry, isRTL) : null;

  const dailyTip = getDailyTip();

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
        <AnimatedTouchable
          onPress={() => setSidebarVisible(true)}
          style={[styles.iconBtn, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'القائمة' : 'Menu'}
        >
          <Ionicons name="menu" size={20} color={COLORS.text} />
        </AnimatedTouchable>

        <Text style={[styles.logo, { color: COLORS.primary }]}>Fixate</Text>

        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8 }}>
          {/* Language toggle intentionally removed from the header (lives in
              the sidebar's Preferences, near the top) to declutter. */}
          <AnimatedTouchable
            onPress={() => router.push('/notifications')}
            style={[styles.iconBtn, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}
            accessibilityRole="button"
            accessibilityLabel={
              unreadNotifications > 0
                ? (isRTL ? `الإشعارات، ${unreadNotifications} غير مقروءة` : `Notifications, ${unreadNotifications} unread`)
                : (isRTL ? 'الإشعارات' : 'Notifications')
            }
          >
            <Ionicons
              name={unreadNotifications > 0 ? 'notifications' : 'notifications-outline'}
              size={18}
              color={unreadNotifications > 0 ? COLORS.primary : COLORS.text}
            />
            {unreadNotifications > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </Text>
              </View>
            )}
          </AnimatedTouchable>
        </View>
      </View>

      {/* Clears BOTH floating layers — the nav bar and the assistant icon parked
          above it — derived from their real geometry so content never stops
          underneath either, on any screen size. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        contentContainerStyle={{
          // Clear the taller of the two floating layers — the FAB's top edge,
          // which now sits a gap above the bar, is the real content ceiling.
          paddingBottom:
            BOTTOM_NAV_TOP + BOTTOM_NAV_ACCESSORY_GAP + ASSISTANT_FAB_SIZE + 16,
        }}
      >
        <AnnouncementBanner />
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], paddingHorizontal: SPACING.m, paddingTop: SPACING.s, paddingBottom: SPACING.m }}>
          {/* Greeting + wallet on one row — compact, balanced header */}
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.greetingSmall, { color: COLORS.textSecondary }]}>{greeting} 👋</Text>
              {displayName ? (
                <Text style={[styles.greetingName, { color: COLORS.text }]} numberOfLines={1}>
                  {displayName}
                </Text>
              ) : null}
            </View>
            {/* Wallet balance pill (§15) */}
            <TouchableOpacity
              onPress={() => router.push('/wallet')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={isRTL ? 'محفظتي' : 'My wallet'}
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: COLORS.primary + '12',
                borderWidth: 1,
                borderColor: COLORS.primary + '30',
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                marginTop: 4,
              }}
            >
              <MaterialCommunityIcons name="wallet-outline" size={16} color={COLORS.primary} />
              <Text style={{ color: COLORS.primary, fontWeight: '800', fontSize: 13.5 }}>
                {walletBalance.toFixed(2)} <Riyal />
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.greetingSub, { color: COLORS.textSecondary }]}>
            {isRTL ? 'إصلاح احترافي لأجهزتك، أينما كنت' : 'Expert device repair, wherever you are'}
          </Text>

          {/* Primary CTA — the green action box under the welcome section */}
          <AnimatedTouchable
            onPress={() => router.push('/request')}
            style={[styles.cta, { backgroundColor: COLORS.primary }]}
            activeOpacity={0.92}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'اطلب صيانة جديدة' : 'Request a new repair'}
          >
            <LinearGradient
              colors={[COLORS.gradientStart, COLORS.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Soft decorative circles + oversized watermark for depth */}
            <View pointerEvents="none" style={styles.ctaBlob1} />
            <View pointerEvents="none" style={styles.ctaBlob2} />
            <MaterialCommunityIcons
              name="tools"
              size={128}
              color="#ffffff14"
              style={{ position: 'absolute', bottom: -18, [isRTL ? 'left' : 'right']: -14 }}
            />
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
                  {isRTL ? 'خدمة سريعة حتى باب منزلك' : 'Fast service to your door'}
                </Text>
              </View>
            </View>
            <View style={styles.ctaArrowWrap}>
              <RTLIonicon name="arrow-forward" size={24} color={COLORS.primary} />
            </View>
          </AnimatedTouchable>

          {/* §13 — auto-rotating app highlights, below the primary CTA */}
          <View style={{ marginTop: 18 }}>
            <HomeHighlightsCarousel />
          </View>

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
            <AnimatedTouchable
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
            </AnimatedTouchable>
          )}

          {/* My Orders — prominent, always-visible access to all orders */}
          <AnimatedTouchable
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
          </AnimatedTouchable>

          {/* Quick Actions — six distinct, genuinely useful cards (FEAT-06).
              Each has its own icon, color accent and destination/inline info
              rather than all pointing at the orders screen. */}
          <View style={styles.actionGrid}>
            {/* 1 — Track my order (status + progress hint) */}
            <PressableScale
              onPress={() =>
                router.push(activeOrder ? `/order-details?id=${activeOrder.id}` : '/(customer)/orders')
              }
              style={[styles.actionCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}
              accessibilityRole="button"
              accessibilityLabel={isRTL ? 'تتبع طلبي' : 'Track my order'}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#3B82F6' + '18' }]}>
                <MaterialCommunityIcons name="map-marker-path" size={22} color="#3B82F6" />
              </View>
              <Text style={[styles.actionTitle, { color: COLORS.text }]} numberOfLines={1}>
                {isRTL ? 'تتبع طلبي' : 'Track my order'}
              </Text>
              {activeOrder ? (
                <View style={styles.actionStatusRow}>
                  <View style={[styles.actionDot, { backgroundColor: '#3B82F6' }]} />
                  <Text style={[styles.actionSub, { color: '#3B82F6' }]} numberOfLines={1}>
                    {activeStatusLabel}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.actionSub, { color: COLORS.textSecondary }]} numberOfLines={1}>
                  {isRTL ? 'لا يوجد طلب نشط' : 'No active order'}
                </Text>
              )}
            </PressableScale>

            {/* 2 — Tip of the day (inline, taps to expand in a themed sheet) */}
            <PressableScale
              onPress={() => setTipSheetOpen(true)}
              style={[styles.actionCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}
              accessibilityRole="button"
              accessibilityLabel={isRTL ? 'نصيحة اليوم' : 'Tip of the day'}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#10B981' + '18' }]}>
                <MaterialCommunityIcons name="lightbulb-on-outline" size={22} color="#10B981" />
              </View>
              <Text style={[styles.actionTitle, { color: COLORS.text }]} numberOfLines={1}>
                {isRTL ? 'نصيحة اليوم' : 'Tip of the day'}
              </Text>
              <Text style={[styles.actionSub, { color: COLORS.textSecondary }]} numberOfLines={2}>
                {isRTL ? dailyTip.ar : dailyTip.en}
              </Text>
            </PressableScale>

            {/* 3 — Repair warranty (status + expiry of last repair) */}
            <PressableScale
              onPress={() => router.push('/warranty')}
              style={[styles.actionCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}
              accessibilityRole="button"
              accessibilityLabel={isRTL ? 'ضمان الإصلاح' : 'Repair warranty'}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#8B5CF6' + '18' }]}>
                <MaterialCommunityIcons name="shield-check-outline" size={22} color="#8B5CF6" />
              </View>
              <Text style={[styles.actionTitle, { color: COLORS.text }]} numberOfLines={1}>
                {isRTL ? 'ضمان الإصلاح' : 'Repair warranty'}
              </Text>
              {warrantyLabel ? (
                <Text
                  style={[styles.actionSub, { color: warrantyActive ? '#10B981' : COLORS.textSecondary }]}
                  numberOfLines={1}
                >
                  {warrantyActive
                    ? (isRTL ? `ساري حتى ${warrantyLabel}` : `Valid until ${warrantyLabel}`)
                    : (isRTL ? 'منتهي الضمان' : 'Warranty expired')}
                </Text>
              ) : (
                <Text style={[styles.actionSub, { color: COLORS.textSecondary }]} numberOfLines={1}>
                  {isRTL ? 'ضمان سنة كاملة' : '1-year warranty'}
                </Text>
              )}
            </PressableScale>

            {/* 4 — Offers & discounts (opens the offers screen) */}
            <PressableScale
              onPress={() => router.push('/(customer)/offers')}
              style={[styles.actionCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}
              accessibilityRole="button"
              accessibilityLabel={isRTL ? 'عروض وخصومات' : 'Offers & discounts'}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#EC4899' + '18' }]}>
                <MaterialCommunityIcons name="tag-multiple-outline" size={22} color="#EC4899" />
              </View>
              <Text style={[styles.actionTitle, { color: COLORS.text }]} numberOfLines={1}>
                {isRTL ? 'عروض وخصومات' : 'Offers & discounts'}
              </Text>
              <Text style={[styles.actionSub, { color: COLORS.textSecondary }]} numberOfLines={1}>
                {isRTL ? 'تصفّح أحدث العروض' : 'Browse the latest deals'}
              </Text>
            </PressableScale>
          </View>

          {/* Section: Choose your device */}
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
              {isRTL ? 'اختر جهازك' : 'Choose device'}
            </Text>
            <AnimatedTouchable onPress={() => router.push('/(customer)/services')}>
              <Text style={{ color: COLORS.primary, fontSize: 13, fontWeight: '700' }}>
                {isRTL ? 'كل الخدمات' : 'See all'}
              </Text>
            </AnimatedTouchable>
          </View>

          <View style={styles.deviceGrid}>
            {DEVICE_CATEGORIES.map((cat) => (
              <PressableScale
                key={cat.id}
                style={[styles.deviceCard, { backgroundColor: COLORS.card }]}
                onPress={() => router.push({ pathname: '/request', params: { device: cat.id } } as any)}
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

          {/* Section: Why Fixate — warranty / pickup / verified technicians */}
          <Text style={[styles.sectionTitle, { color: COLORS.text, marginBottom: 14 }]}>
            {isRTL ? 'لماذا Fixate؟' : 'Why Fixate'}
          </Text>
          <View style={styles.trustGrid}>
            {TRUST_POINTS.map((t, i) => (
              <View key={i} style={styles.trustTile}>
                <View style={[styles.trustIcon, { backgroundColor: COLORS.primary + '14' }]}>
                  <MaterialCommunityIcons name={t.icon as any} size={22} color={COLORS.primary} />
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

        </Animated.View>
      </ScrollView>

      {/* Smart assistant — a floating icon that stays reachable from anywhere on
          the home screen (it replaced the in-flow assistant card, which scrolled
          out of sight). It is handed to <BottomNav /> rather than positioned
          here, so it is laid out in the bar's own box: it sits one small gap
          above the bar's top edge, on its trailing side, and cannot drift away
          from it no matter what padding this screen's SafeAreaView applies. */}
      <BottomNav
        above={
          <AnimatedTouchable
            onPress={() => router.push('/chatbot')}
            style={[styles.assistantFab, { backgroundColor: COLORS.primary }]}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'مساعد Fixate الذكي' : 'Fixate AI assistant'}
          >
            <MaterialCommunityIcons name="robot-happy-outline" size={26} color="#fff" />
          </AnimatedTouchable>
        }
      />

      {/* Tip-of-the-day sheet — a themed bottom sheet replaces the stock OS
          Alert, which looked out of place against the rest of the home UI. */}
      <Modal
        visible={tipSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTipSheetOpen(false)}
      >
        <TouchableOpacity
          style={styles.tipBackdrop}
          activeOpacity={1}
          onPress={() => setTipSheetOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.tipSheet}>
            <View style={styles.tipHandle} />
            <View style={styles.tipIconWrap}>
              <MaterialCommunityIcons name="lightbulb-on" size={30} color="#F59E0B" />
            </View>
            <Text style={styles.tipSheetTitle}>
              {isRTL ? 'نصيحة اليوم' : 'Tip of the day'}
            </Text>
            <Text style={styles.tipSheetBody}>
              {isRTL ? dailyTip.ar : dailyTip.en}
            </Text>
            <TouchableOpacity
              onPress={() => { setTipSheetOpen(false); router.push('/request'); }}
              style={[styles.tipCta, { backgroundColor: COLORS.primary }]}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="tools" size={16} color="#fff" />
              <Text style={styles.tipCtaText}>
                {isRTL ? 'احجز صيانة الآن' : 'Book a repair now'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setTipSheetOpen(false)} style={styles.tipDismiss}>
              <Text style={[styles.tipDismissText, { color: COLORS.textSecondary }]}>
                {isRTL ? 'إغلاق' : 'Dismiss'}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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
    bellBadge: {
      position: 'absolute',
      top: -3,
      [isRTL ? 'left' : 'right']: -3,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: '#EF4444',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: C.background,
    },
    bellBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

    tipBackdrop: {
      flex: 1,
      backgroundColor: '#00000077',
      justifyContent: 'flex-end',
    },
    tipSheet: {
      backgroundColor: C.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 32,
      alignItems: 'center',
    },
    tipHandle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: C.border,
      marginBottom: 20,
    },
    tipIconWrap: {
      width: 64, height: 64, borderRadius: 20,
      backgroundColor: '#F59E0B18',
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 14,
    },
    tipSheetTitle: {
      fontSize: 19, fontWeight: '800', color: C.text,
      marginBottom: 8, textAlign: 'center',
    },
    tipSheetBody: {
      fontSize: 15, lineHeight: 24, color: C.textSecondary,
      textAlign: 'center', marginBottom: 24,
    },
    tipCta: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center', justifyContent: 'center',
      gap: 8, alignSelf: 'stretch',
      minHeight: 50, borderRadius: 14,
    },
    tipCtaText: { color: '#fff', fontWeight: '800', fontSize: 15 },
    tipDismiss: { marginTop: 12, paddingVertical: 6 },
    tipDismissText: { fontSize: 14, fontWeight: '600' },
    logo: { fontSize: 22, fontWeight: '900', letterSpacing: 0.5 },

    greetingSmall: { fontSize: 14, fontWeight: '600', textAlign: isRTL ? 'right' : 'left' },
    greetingName: { fontSize: 28, fontWeight: '800', marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
    greetingSub: { fontSize: 14, marginTop: 4, marginBottom: 20, textAlign: isRTL ? 'right' : 'left' },

    cta: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 14,
      borderRadius: 22,
      padding: 18,
      marginBottom: 14,
      overflow: 'hidden',
      shadowColor: C.primary,
      shadowOpacity: 0.3,
      shadowOffset: { width: 0, height: 10 },
      shadowRadius: 20,
      elevation: 8,
      minHeight: 150,
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
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 8,
      elevation: 4,
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
    // FEAT-02 Quick Actions row
    // Home action cards (FEAT-06): a responsive 2-column grid of distinct
    // cards, each with its own icon, accent and status/info line.
    actionGrid: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 24,
    },
    actionCard: {
      width: (width - SPACING.m * 2 - 12) / 2,
      // Fixed height (not minHeight): PressableScale's outer wrapper doesn't
      // stretch row-mates to equal height, so a shorter card (e.g. "Track my
      // order" with a one-line status) rendered visibly shorter than its
      // two-line neighbours. Equal fixed height keeps the grid uniform.
      height: 140,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      padding: 14,
      alignItems: isRTL ? 'flex-end' : 'flex-start',
      ...SHADOWS.small,
    },
    actionIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    actionTitle: {
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 4,
      textAlign: isRTL ? 'right' : 'left',
      alignSelf: 'stretch',
    },
    actionSub: {
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 17,
      textAlign: isRTL ? 'right' : 'left',
      alignSelf: 'stretch',
    },
    actionStatusRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'stretch',
    },
    actionDot: { width: 7, height: 7, borderRadius: 4 },
    actionBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    actionBadgeText: { fontSize: 11, fontWeight: '800' },
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

    // Why Fixate — 3-column trust tiles. Last section on the page, so it
    // carries the bottom breathing room the Explore grid used to provide.
    trustGrid: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 10,
      marginBottom: 8,
    },
    // Plain (card-less) tiles with a unified brand-color icon — reads as
    // lightweight trust copy rather than three more cards.
    trustTile: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 6,
      alignItems: 'center',
      gap: 7,
    },
    trustIcon: {
      width: 44, height: 44, borderRadius: 13,
      alignItems: 'center', justifyContent: 'center',
    },
    trustTitle: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
    trustSub: { fontSize: 11, fontWeight: '500', textAlign: 'center' },

    // Smart-assistant puck. It is NOT positioned here — <BottomNav above={...}>
    // lays it out inside the bar's own container, directly above the bar's top
    // edge on the trailing side (which flips with the language automatically,
    // because the bar's container drives the alignment). This style only
    // describes how the puck LOOKS.
    assistantFab: {
      // Above the page content; the bar runs at elevation 10 on Android.
      zIndex: 10,
      width: ASSISTANT_FAB_SIZE,
      height: ASSISTANT_FAB_SIZE,
      borderRadius: ASSISTANT_FAB_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.35)',
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.45,
      shadowRadius: 16,
      elevation: 12,
    },
  });
