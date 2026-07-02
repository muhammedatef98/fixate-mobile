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
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import BottomNav from '../../components/BottomNav';
import Sidebar from '../../components/Sidebar';
import { supabase } from '../../services/supabaseClient';
import { ORDER_STATUS_LABELS_AR, ORDER_STATUS_LABELS_EN } from '../../types/order';
import { formatAppDateOnly } from '../../lib/formatDate';
import { logger } from '../../utils/logger';
import { getWalletBalance } from '../../services/customerWalletService';
import { RTLIonicon, RTLMaterialIcon } from '../../components/RTLIcon';
import { PressableScale, AnimatedTouchable } from '../../components/ui/PressableScale';
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

// Warranty length applied to every completed repair (months). Used to derive
// the warranty-expiry date shown on the home "Repair warranty" card.
// Fixate offers a full 1-year (12-month / 365-day) warranty on all repairs.
const WARRANTY_MONTHS = 12;

// Rotating daily maintenance tips. The active tip is picked by the day-of-year
// so it changes once a day at midnight and is stable for the whole day.
// Covers all device categories Fixate services: phones, tablets, laptops,
// TVs, washing machines and other home electronics.
const DAILY_TIPS: { ar: string; en: string }[] = [
  { ar: 'لا تترك جوالك يشحن طوال الليل باستمرار للحفاظ على عمر البطارية.', en: 'Avoid charging your phone overnight constantly to protect battery life.' },
  { ar: 'أبقِ نسبة شحن بطارية جهازك بين 20% و80% لإطالة عمرها.', en: 'Keep your device battery between 20% and 80% to extend its lifespan.' },
  { ar: 'نظّف منفذ الشحن في جوالك من الغبار بفرشاة ناعمة لتجنب مشاكل الشحن.', en: "Clean your phone's charging port with a soft brush to avoid charging issues." },
  { ar: 'حدّث نظام جوالك أو لابتوبك بانتظام لإصلاح الثغرات وتحسين الأداء.', en: 'Update your phone or laptop regularly to fix bugs and improve performance.' },
  { ar: 'استخدم واقي شاشة وجراب جيد لجوالك أو تابلتك لتقليل أعطال السقوط.', en: 'Use a screen protector and a good case for your phone or tablet to reduce drop damage.' },
  { ar: 'لا تشغّل اللابتوب على سطح ناعم كالسرير حتى لا تُسد فتحات التهوية.', en: "Don't use your laptop on soft surfaces like a bed — it blocks the air vents." },
  { ar: 'أبعد جوالك ولابتوبك عن الحرارة العالية وأشعة الشمس المباشرة.', en: 'Keep your phone and laptop away from high heat and direct sunlight.' },
  { ar: 'اعمل نسخة احتياطية لبيانات جوالك أسبوعياً تحسّباً لأي عطل مفاجئ.', en: "Back up your phone's data weekly in case of a sudden failure." },
  { ar: 'نظّف مروحة اللابتوب وفتحات التبريد كل بضعة أشهر لمنع ارتفاع الحرارة.', en: "Clean your laptop's fan and vents every few months to prevent overheating." },
  { ar: 'لا تستخدم شواحن مقلّدة رخيصة؛ فقد تتلف البطارية أو لوحة الشحن.', en: 'Avoid cheap counterfeit chargers — they can damage the battery or charging board.' },
  { ar: 'أغلق التطبيقات التي تعمل في الخلفية لتقليل استهلاك البطارية والحرارة.', en: 'Close background apps to reduce battery drain and heat.' },
  { ar: 'امسح شاشة التلفزيون بقطعة قماش ميكروفايبر جافة فقط، دون رش الماء مباشرة.', en: 'Wipe your TV screen with a dry microfiber cloth only — never spray water directly on it.' },
  { ar: 'لا تضع التلفزيون قريباً جداً من الجدار حتى يبقى هناك تهوية كافية خلفه.', en: 'Keep your TV a little away from the wall so there is enough airflow behind it.' },
  { ar: 'استخدم منظّم تيار (UPS) لحماية التلفزيون والأجهزة من تذبذب الكهرباء.', en: 'Use a voltage regulator/UPS to protect your TV and appliances from power spikes.' },
  { ar: 'نظّف فلتر الغسالة كل شهر لمنع انسداده وضعف التصريف.', en: "Clean your washing machine's filter monthly to prevent clogs and weak drainage." },
  { ar: 'لا تملأ الغسالة فوق طاقتها؛ الحمولة الزائدة تُتلف المحرك والمحامل.', en: 'Never overload your washing machine — excess load wears out the motor and bearings.' },
  { ar: 'اترك باب الغسالة مفتوحاً بعد كل غسلة ليجف الحوض ويمنع الروائح والعفن.', en: 'Leave the washer door open after each wash so the drum dries and avoids odor and mold.' },
  { ar: 'استخدم كمية المنظّف الموصى بها فقط؛ الزيادة تترك رواسب داخل الغسالة.', en: 'Use only the recommended amount of detergent — too much leaves residue inside the machine.' },
  { ar: 'افصل الأجهزة الكهربائية أثناء العواصف الرعدية لحمايتها من الصواعق.', en: 'Unplug electronics during thunderstorms to protect them from surges.' },
  { ar: 'أعد تشغيل الراوتر مرة كل أسبوع للحفاظ على ثبات الإنترنت.', en: 'Restart your router once a week to keep your internet stable.' },
  { ar: 'لا تترك التابلت في السيارة تحت الشمس؛ الحرارة تنتفخ البطارية.', en: 'Never leave a tablet in a hot car — heat can swell the battery.' },
  { ar: 'استخدم خاصية الحماية من الماء بحذر؛ مقاومة الماء تضعف مع تقادم الجهاز.', en: 'Treat water resistance with care — it weakens as the device ages.' },
  { ar: 'افحص كابلات الشحن دورياً واستبدل أي كابل مكشوف أو متآكل فوراً.', en: 'Inspect charging cables regularly and replace any frayed or exposed cable immediately.' },
  { ar: 'خفّض سطوع الشاشة قليلاً لإطالة عمر البطارية وراحة عينيك.', en: 'Lower your screen brightness a bit to extend battery life and ease eye strain.' },
  { ar: 'نظّف السماعات وفتحات المايك بفرشاة ناعمة جافة لتحسين جودة الصوت.', en: 'Clean speaker and mic grilles with a soft dry brush to keep sound clear.' },
  { ar: 'لا تفصل الفلاش ميموري أو الهارد الخارجي أثناء نقل الملفات لتجنّب التلف.', en: 'Never unplug a USB drive or external disk mid-transfer to avoid corruption.' },
  { ar: 'احفظ فاتورة وضمان أجهزتك في مكان واحد يسهل الرجوع إليه عند الصيانة.', en: 'Keep your devices’ invoices and warranties in one place for easy reference during service.' },
  { ar: 'نظّف خلف الثلاجة وملف التبريد من الغبار لتعمل بكفاءة وتوفّر الكهرباء.', en: 'Dust the coils behind your fridge so it runs efficiently and saves power.' },
  { ar: 'لا تضع أجهزة ثقيلة فوق التلفزيون أو اللابتوب لتفادي كسر الشاشة.', en: 'Never place heavy objects on a TV or laptop to avoid cracking the screen.' },
  { ar: 'عند سقوط الجهاز في الماء، أطفئه فوراً ولا تشحنه وتواصل مع فني مختص.', en: 'If a device gets wet, power it off immediately, don’t charge it, and contact a technician.' },
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
  const { language, setLanguage, isDark } = useApp();
  const { user, userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';

  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [recentOrder, setRecentOrder] = useState<any>(null);
  const [pendingQuotes, setPendingQuotes] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
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
          user?.id ? getWalletBalance(user.id).then(setWalletBalance).catch(() => {}) : Promise.resolve(),
          user?.id ? loadActiveOrder() : Promise.resolve(),
          user?.id ? loadRecentOrder() : Promise.resolve(),
          user?.id ? loadPendingQuotes() : Promise.resolve(),
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

  // Count of orders awaiting the customer's price approval — drives the
  // badge on the "Quotes" quick action (FEAT-02).
  const loadPendingQuotes = async () => {
    if (!user?.id) return;
    try {
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'quoted');
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
          <AnimatedTouchable
            onPress={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            style={[styles.iconBtn, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'تبديل اللغة' : 'Toggle language'}
          >
            <Ionicons name="language" size={18} color={COLORS.text} />
          </AnimatedTouchable>
          <AnimatedTouchable
            onPress={() => router.push('/notifications')}
            style={[styles.iconBtn, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'الإشعارات' : 'Notifications'}
          >
            <Ionicons name="notifications-outline" size={18} color={COLORS.text} />
          </AnimatedTouchable>
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

          {/* Wallet balance pill (§15) */}
          <TouchableOpacity
            onPress={() => router.push('/wallet')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'محفظتي' : 'My wallet'}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 8,
              alignSelf: isRTL ? 'flex-end' : 'flex-start',
              backgroundColor: COLORS.primary + '12',
              borderWidth: 1,
              borderColor: COLORS.primary + '30',
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              marginBottom: 16,
            }}
          >
            <MaterialCommunityIcons name="wallet-outline" size={16} color={COLORS.primary} />
            <Text style={{ color: COLORS.primary, fontWeight: '800', fontSize: 13.5 }}>
              {isRTL ? `محفظتي: ${walletBalance.toFixed(2)} ر.س` : `Wallet: ${walletBalance.toFixed(2)} SAR`}
            </Text>
          </TouchableOpacity>

          {/* Primary CTA — the green action box under the welcome section */}
          <AnimatedTouchable
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
                  {isRTL ? 'خدمة سريعة حتى باب منزلك' : 'Fast service to your door'}
                </Text>
              </View>
            </View>
            <View style={styles.ctaArrowWrap}>
              <RTLIonicon name="arrow-forward" size={24} color={COLORS.primary} />
            </View>
          </AnimatedTouchable>

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

            {/* 2 — Tip of the day (inline, taps to expand) */}
            <PressableScale
              onPress={() =>
                Alert.alert(isRTL ? 'نصيحة اليوم' : 'Tip of the day', isRTL ? dailyTip.ar : dailyTip.en)
              }
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
              onPress={() =>
                recentOrder
                  ? router.push(`/order-details?id=${recentOrder.id}`)
                  : Alert.alert(
                      isRTL ? 'ضمان الإصلاح' : 'Repair warranty',
                      isRTL
                        ? 'كل إصلاح يشمل ضمان سنة كاملة. سيظهر تاريخ الانتهاء هنا بعد أول إصلاح مكتمل.'
                        : 'Every repair includes a 1-year warranty. The expiry date shows here after your first completed repair.'
                    )
              }
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

          {/* AI assistant card — instant answers, can hand off to support.
              (The separate "Need help?" support card was removed; the
              assistant itself routes to support when needed.) */}
          <AnimatedTouchable
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
          </AnimatedTouchable>
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
      minHeight: 116,
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
    trustSub: { fontSize: 11, fontWeight: '500', textAlign: 'center' },

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
