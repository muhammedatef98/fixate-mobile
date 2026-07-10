import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import BottomNav from '../../components/BottomNav';
import { RTLIonicon } from '../../components/RTLIcon';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { PressableScale } from '../../components/ui/PressableScale';
import { safeBack } from '../../utils/navigation';

const { width } = Dimensions.get('window');

interface Service {
  id: string;
  nameAr: string;
  nameEn: string;
  icon: any;
  color: string;
  descAr: string;
  descEn: string;
  available: boolean;
  /** Lowest end of typical Saudi-market price (SAR). */
  fromPrice?: number;
}

const SERVICES: Service[] = [
  {
    id: 'phone',
    nameAr: 'صيانة الجوالات',
    nameEn: 'Phone Repairs',
    icon: 'cellphone',
    color: '#10b981',
    descAr: 'الشاشات، البطاريات، الكاميرا، الشحن',
    descEn: 'Screens, batteries, camera, charging',
    available: true,
    fromPrice: 80,
  },
  {
    id: 'laptop',
    nameAr: 'صيانة اللابتوب',
    nameEn: 'Laptop Repairs',
    icon: 'laptop',
    color: '#3b82f6',
    descAr: 'الشاشات، اللوحة، البطاريات، الترقيات',
    descEn: 'Screens, keyboards, batteries, upgrades',
    available: true,
    fromPrice: 100,
  },
  {
    id: 'tablet',
    nameAr: 'صيانة التابلت',
    nameEn: 'Tablet Repairs',
    icon: 'tablet',
    color: '#8b5cf6',
    descAr: 'إصلاح شامل لجميع أنواع الأجهزة اللوحية',
    descEn: 'Full repair for all tablet brands',
    available: true,
    fromPrice: 100,
  },
  {
    id: 'watch',
    nameAr: 'الساعات الذكية',
    nameEn: 'Smart Watches',
    icon: 'watch',
    color: '#f59e0b',
    descAr: 'إصلاح الشاشة، البطارية، الأزرار',
    descEn: 'Screen, battery, crown & buttons',
    available: true,
    fromPrice: 150,
  },
  {
    id: 'gaming',
    nameAr: 'أجهزة الألعاب',
    nameEn: 'Gaming Devices',
    icon: 'gamepad-variant',
    color: '#6366f1',
    descAr: 'بلايستيشن، إكس بوكس، نينتندو وملحقاتها',
    descEn: 'PlayStation, Xbox, Nintendo & accessories',
    available: true,
    fromPrice: 120,
  },
  {
    id: 'printer',
    nameAr: 'الطابعات',
    nameEn: 'Printers',
    icon: 'printer',
    color: '#0ea5e9',
    descAr: 'حل مشاكل الطباعة والصيانة الدورية',
    descEn: 'Printing issues & maintenance',
    available: false,
  },
  {
    id: 'home',
    nameAr: 'الأجهزة المنزلية',
    nameEn: 'Home Appliances',
    icon: 'home-automation',
    color: '#ec4899',
    descAr: 'تركيب وصيانة الأجهزة الذكية والمنزلية',
    descEn: 'Smart-home setup & repair',
    available: false,
  },
];

const FEATURES = [
  { icon: 'shield-check', ar: 'ضمان سنة كاملة', en: '1-year warranty', color: '#10b981' },
  { icon: 'truck-fast-outline', ar: 'استلام مجاني', en: 'Free pickup', color: '#3b82f6' },
  { icon: 'cash-multiple', ar: 'أسعار شفّافة', en: 'Transparent pricing', color: '#f59e0b' },
  { icon: 'flash-outline', ar: 'خدمة في نفس اليوم', en: 'Same-day service', color: '#8b5cf6' },
];

// The customer journey, distilled to three honest steps. Grounding "how it
// works" on the page is what turns a link list into a screen the customer
// actually trusts — they know exactly what happens after they tap Request.
// The real Fixate journey — a marketplace request → offers → accept & pay →
// handover → repair → return-with-warranty flow. Kept accurate to how the app
// actually behaves (not a generic pickup-and-fix explanation).
const STEPS = [
  {
    icon: 'clipboard-text-outline',
    ar: 'اطلب الصيانة',
    en: 'Create your request',
    subAr: 'اختر جهازك وصف العطل، فيصل طلبك مباشرةً لفنيين معتمدين قريبين منك',
    subEn: 'Pick your device and describe the fault — your request goes live to nearby verified technicians',
  },
  {
    icon: 'cash-multiple',
    ar: 'قارن العروض واختر',
    en: 'Compare offers & choose',
    subAr: 'يصلك عدة عروض أسعار من الفنيين، تختار الأنسب لك (يبقى الطلب مفتوحاً حتى ٣٠ دقيقة)',
    subEn: 'Technicians send you price offers; pick the one that suits you (the request stays open up to 30 minutes)',
  },
  {
    icon: 'credit-card-check-outline',
    ar: 'أكّد وادفع',
    en: 'Accept & confirm payment',
    subAr: 'بقبولك للعرض يصبح هو السعر المتفق عليه، وتؤكّد الدفع حسب سياسة المنصّة',
    subEn: 'Accepting an offer sets the agreed price; you confirm payment per the platform policy',
  },
  {
    icon: 'tools',
    ar: 'الاستلام والإصلاح',
    en: 'Handover & repair',
    subAr: 'زيارة الفني إليك أو استلام عبر مندوب أو تسليم باليد — ثم الفحص والإصلاح مع مدة متوقعة واضحة',
    subEn: 'A mobile visit, a courier pickup, or a drop-off — then the technician diagnoses, repairs, and shares an estimated repair time',
  },
  {
    icon: 'shield-check-outline',
    ar: 'الاستلام مع ضمان',
    en: 'Get it back, guaranteed',
    subAr: 'يُعاد إليك جهازك، وتُنهي الدفع، ويبقى الإصلاح مضموناً لمدة سنة كاملة',
    subEn: 'Your device is returned, you settle any balance, and the repair is backed by a full 1-year warranty',
  },
];

export default function ServicesScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const isRTL = language === 'ar';
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const styles = makeStyles(COLORS, isRTL, SHADOWS);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(12)).current;

  const priceLabel = (p?: number) =>
    p == null ? '' : isRTL ? `من ${p} ر.س` : `from SAR ${p}`;

  useEffect(() => {
    // Light, quick entrance — the screen paints almost immediately.
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, friction: 9, tension: 90, useNativeDriver: true }),
    ]).start();
  }, []);

  const availableCount = SERVICES.filter((s) => s.available).length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => safeBack('/(customer)')}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
        >
          <RTLIonicon name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isRTL ? 'خدماتنا' : 'Our services'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: SPACING.m, paddingBottom: 110 }}
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          {/* Hero — one clear promise, one clear action */}
          <View style={[styles.hero, { backgroundColor: COLORS.primary }]}>
            <LinearGradient
              colors={[COLORS.gradientStart, COLORS.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View pointerEvents="none" style={styles.heroBlob} />
            <View style={styles.heroLeft}>
              <Text style={styles.heroEyebrow}>{isRTL ? 'خدمة Fixate' : 'Fixate service'}</Text>
              <Text style={styles.heroTitle}>
                {isRTL ? 'صيانة موثوقة\nبفنيين معتمدين' : 'Trusted repairs\nfrom verified pros'}
              </Text>
              <View style={styles.heroBadge}>
                <MaterialCommunityIcons name="clock-fast" size={13} color="#fff" />
                <Text style={styles.heroBadgeText}>
                  {isRTL ? 'يصلك الفني في وقت قياسي' : 'A technician reaches you fast'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/request')}
                style={styles.heroCta}
                accessibilityRole="button"
              >
                <Text style={styles.heroCtaText}>{isRTL ? 'اطلب الآن' : 'Request now'}</Text>
                <RTLIonicon name="arrow-forward" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.heroIconWrap}>
              <MaterialCommunityIcons name="tools" size={68} color="#ffffff22" />
            </View>
          </View>

          {/* Trust strip — 4 quick selling points */}
          <View style={styles.featureStrip}>
            {FEATURES.map((f, i) => (
              <View key={i} style={[styles.featureItem, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                <View style={[styles.featureIconWrap, { backgroundColor: f.color + '15' }]}>
                  <MaterialCommunityIcons name={f.icon as any} size={18} color={f.color} />
                </View>
                <Text style={[styles.featureText, { color: COLORS.text }]} numberOfLines={2}>
                  {isRTL ? f.ar : f.en}
                </Text>
              </View>
            ))}
          </View>

          {/* Section title */}
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
              {isRTL ? 'تصفّح حسب الجهاز' : 'Browse by device'}
            </Text>
            <Text style={[styles.sectionMeta, { color: COLORS.textSecondary }]}>
              {isRTL ? `${availableCount} متاحة` : `${availableCount} available`}
            </Text>
          </View>

          {/* Service grid (2 columns) — now surfaces a from-price so the screen
              answers the customer's first question before they tap in. */}
          <View style={styles.grid}>
            {SERVICES.map((s) => (
              <PressableScale
                key={s.id}
                to={0.97}
                style={[
                  styles.tile,
                  { backgroundColor: COLORS.card, borderColor: COLORS.border },
                  !s.available && { opacity: 0.62 },
                ]}
                onPress={() => {
                  if (s.available) router.push('/request');
                }}
                disabled={!s.available}
                accessibilityRole="button"
                accessibilityLabel={isRTL ? s.nameAr : s.nameEn}
              >
                <View style={[styles.tileIconWrap, { backgroundColor: s.color + '15' }]}>
                  <MaterialCommunityIcons name={s.icon} size={28} color={s.color} />
                </View>
                <Text style={[styles.tileName, { color: COLORS.text }]} numberOfLines={1}>
                  {isRTL ? s.nameAr : s.nameEn}
                </Text>
                <Text style={[styles.tileDesc, { color: COLORS.textSecondary }]} numberOfLines={2}>
                  {isRTL ? s.descAr : s.descEn}
                </Text>
                <View style={styles.tileFoot}>
                  {s.available ? (
                    <Text style={[styles.tilePrice, { color: s.color }]}>{priceLabel(s.fromPrice)}</Text>
                  ) : (
                    <View style={[styles.soonPill, { backgroundColor: COLORS.textSecondary + '18' }]}>
                      <Text style={[styles.soonText, { color: COLORS.textSecondary }]}>
                        {isRTL ? 'قريباً' : 'Coming soon'}
                      </Text>
                    </View>
                  )}
                </View>
              </PressableScale>
            ))}
          </View>

          {/* How it works — a calm, connected 3-step timeline. This is the
              section that makes the page feel intentional: the customer sees
              the whole journey before committing. */}
          <View style={[styles.sectionRow, { marginTop: 26 }]}>
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
              {isRTL ? 'كيف تعمل الخدمة' : 'How it works'}
            </Text>
          </View>
          <View style={[styles.stepsCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
            {STEPS.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepRail}>
                  <View style={[styles.stepDot, { backgroundColor: COLORS.primary + '15' }]}>
                    <MaterialCommunityIcons name={step.icon as any} size={20} color={COLORS.primary} />
                  </View>
                  {i < STEPS.length - 1 && (
                    <View style={[styles.stepLine, { backgroundColor: COLORS.border }]} />
                  )}
                </View>
                <View style={styles.stepBody}>
                  <View style={styles.stepTitleRow}>
                    <Text style={[styles.stepIndex, { color: COLORS.primary }]}>
                      {isRTL ? `الخطوة ${i + 1}` : `Step ${i + 1}`}
                    </Text>
                  </View>
                  <Text style={[styles.stepTitle, { color: COLORS.text }]}>
                    {isRTL ? step.ar : step.en}
                  </Text>
                  <Text style={[styles.stepSub, { color: COLORS.textSecondary }]}>
                    {isRTL ? step.subAr : step.subEn}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Explore Fixate — the marketplace destinations, consolidated into a
              clean pair of rows instead of competing hero blocks. */}
          <View style={[styles.sectionRow, { marginTop: 26 }]}>
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
              {isRTL ? 'المزيد في Fixate' : 'Explore Fixate'}
            </Text>
          </View>

          <PressableScale
            onPress={() => router.push('/market')}
            to={0.985}
            style={[styles.linkCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'سوق Fixate' : 'Fixate Market'}
          >
            <View style={[styles.linkIcon, { backgroundColor: '#7C3AED15' }]}>
              <MaterialCommunityIcons name="storefront-outline" size={22} color="#7C3AED" />
            </View>
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text style={[styles.linkTitle, { color: COLORS.text }]}>
                {isRTL ? 'سوق Fixate' : 'Fixate Market'}
              </Text>
              <Text style={[styles.linkSub, { color: COLORS.textSecondary }]}>
                {isRTL
                  ? 'بيع واشترِ أجهزة مستعملة وإكسسوارات وقطع غيار'
                  : 'Buy & sell used devices, accessories and spare parts'}
              </Text>
            </View>
            <RTLIonicon name="chevron-forward" size={20} color="#7C3AED" />
          </PressableScale>

          {/* Salvage devices — deep link into the Market with the salvage chip
              pre-selected so the customer skips browsing. */}
          <PressableScale
            onPress={() => router.push({ pathname: '/market', params: { device: 'salvage' } } as any)}
            to={0.985}
            style={[styles.linkCard, { backgroundColor: COLORS.card, borderColor: COLORS.border, marginTop: 10 }]}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'بيع وشراء أجهزة التشليح' : 'Buy & sell salvage devices'}
          >
            <View style={[styles.linkIcon, { backgroundColor: '#EA580C15' }]}>
              <MaterialCommunityIcons name="tools" size={22} color="#EA580C" />
            </View>
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text style={[styles.linkTitle, { color: COLORS.text }]}>
                {isRTL ? 'أجهزة التشليح' : 'Salvage devices'}
              </Text>
              <Text style={[styles.linkSub, { color: COLORS.textSecondary }]}>
                {isRTL
                  ? 'أجهزة وقطع غيار للتشليح بأسعار مناسبة'
                  : 'Salvage devices and parts at the right price'}
              </Text>
            </View>
            <RTLIonicon name="chevron-forward" size={20} color="#EA580C" />
          </PressableScale>

          {/* Help card — opens in-app live support */}
          <PressableScale
            onPress={() => router.push('/support-chat')}
            to={0.985}
            style={[styles.helpCard, { backgroundColor: COLORS.primary + '0D', borderColor: COLORS.primary + '22' }]}
            accessibilityRole="button"
          >
            <View style={[styles.linkIcon, { backgroundColor: COLORS.primary + '18' }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text style={[styles.linkTitle, { color: COLORS.text }]}>
                {isRTL ? 'لم تجد خدمتك؟' : "Didn't find your service?"}
              </Text>
              <Text style={[styles.linkSub, { color: COLORS.textSecondary }]}>
                {isRTL
                  ? 'تواصل مع فريق الدعم وسنساعدك في إيجاد الفني المناسب'
                  : 'Chat with support and we will match you with a tech'}
              </Text>
            </View>
            <RTLIonicon name="chevron-forward" size={20} color={COLORS.primary} />
          </PressableScale>
        </Animated.View>
      </ScrollView>

      <BottomNav />
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
      paddingVertical: 12,
      backgroundColor: C.background,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: C.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: { fontSize: 22, fontWeight: '800', color: C.text },

    // Hero
    hero: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      borderRadius: 24,
      padding: 20,
      marginBottom: 18,
      overflow: 'hidden',
      minHeight: 168,
      shadowColor: C.primary,
      shadowOpacity: 0.3,
      shadowOffset: { width: 0, height: 10 },
      shadowRadius: 20,
      elevation: 8,
    },
    heroBlob: {
      position: 'absolute',
      width: 170, height: 170, borderRadius: 85,
      backgroundColor: '#ffffff14',
      top: -60, [isRTL ? 'left' : 'right']: -40,
    },
    heroLeft: {
      flex: 1,
      justifyContent: 'space-between',
      alignItems: isRTL ? 'flex-end' : 'flex-start',
    },
    heroEyebrow: {
      color: '#ffffffcc',
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
      marginBottom: 4,
      textAlign: isRTL ? 'right' : 'left',
      writingDirection: isRTL ? 'rtl' : 'ltr',
    },
    heroTitle: {
      color: '#fff',
      fontSize: 22,
      fontWeight: '800',
      lineHeight: 30,
      textAlign: isRTL ? 'right' : 'left',
      writingDirection: isRTL ? 'rtl' : 'ltr',
    },
    heroBadge: {
      alignSelf: isRTL ? 'flex-end' : 'flex-start',
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.28)',
    },
    heroBadgeText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 12,
      writingDirection: isRTL ? 'rtl' : 'ltr',
    },
    heroCta: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      backgroundColor: '#fff',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      alignSelf: isRTL ? 'flex-end' : 'flex-start',
      marginTop: 14,
      gap: 6,
    },
    heroCtaText: {
      color: C.primary,
      fontWeight: '800',
      fontSize: 13,
      writingDirection: isRTL ? 'rtl' : 'ltr',
    },
    heroIconWrap: { justifyContent: 'center', alignItems: 'center' },

    // Feature strip
    featureStrip: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 22,
    },
    featureItem: {
      width: (width - SPACING.m * 2 - 8) / 2,
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      ...SHADOWS.small,
    },
    featureIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    featureText: { fontSize: 12, fontWeight: '600', flex: 1 },

    // Section header
    sectionRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: { fontSize: 20, fontWeight: '800' },
    sectionMeta: { fontSize: 13, fontWeight: '600' },

    // Grid
    grid: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    tile: {
      width: (width - SPACING.m * 2 - 12) / 2,
      borderRadius: BORDER_RADIUS.md,
      padding: 16,
      minHeight: 168,
      borderWidth: 1,
      ...SHADOWS.small,
    },
    tileIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    tileName: { fontSize: 14, fontWeight: '700', textAlign: isRTL ? 'right' : 'left' },
    tileDesc: { fontSize: 11, marginTop: 4, lineHeight: 16, textAlign: isRTL ? 'right' : 'left' },
    tileFoot: { marginTop: 'auto', paddingTop: 10 },
    tilePrice: { fontSize: 13, fontWeight: '800', textAlign: isRTL ? 'right' : 'left' },
    soonPill: {
      alignSelf: isRTL ? 'flex-end' : 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    soonText: { fontSize: 10, fontWeight: '700' },

    // How it works — stepped timeline
    stepsCard: {
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      paddingVertical: 18,
      paddingHorizontal: 16,
      ...SHADOWS.small,
    },
    stepRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'stretch',
    },
    stepRail: {
      width: 40,
      alignItems: 'center',
    },
    stepDot: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepLine: {
      flex: 1,
      width: 2,
      marginVertical: 4,
      borderRadius: 1,
    },
    stepBody: {
      flex: 1,
      marginHorizontal: 14,
      paddingBottom: 20,
    },
    stepTitleRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
    },
    stepIndex: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      textAlign: isRTL ? 'right' : 'left',
    },
    stepTitle: {
      fontSize: 15,
      fontWeight: '800',
      marginTop: 3,
      textAlign: isRTL ? 'right' : 'left',
      writingDirection: isRTL ? 'rtl' : 'ltr',
    },
    stepSub: {
      fontSize: 12.5,
      lineHeight: 18,
      marginTop: 3,
      textAlign: isRTL ? 'right' : 'left',
      writingDirection: isRTL ? 'rtl' : 'ltr',
    },

    // Link rows (Market / Salvage)
    linkCard: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      padding: 16,
      ...SHADOWS.small,
    },
    linkIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    linkTitle: { fontSize: 14, fontWeight: '700', textAlign: isRTL ? 'right' : 'left' },
    linkSub: { fontSize: 12, marginTop: 2, lineHeight: 16, textAlign: isRTL ? 'right' : 'left' },

    // Help card
    helpCard: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      padding: 16,
      marginTop: 22,
    },
  });
