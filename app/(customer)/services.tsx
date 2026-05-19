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
    color: '#6366f1',
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
  { icon: 'shield-check', ar: 'ضمان 6 أشهر', en: '6-month warranty', color: '#10b981' },
  { icon: 'truck-fast-outline', ar: 'استلام مجاني', en: 'Free pickup', color: '#3b82f6' },
  { icon: 'cash-multiple', ar: 'أسعار شفّافة', en: 'Transparent pricing', color: '#f59e0b' },
  { icon: 'flash-outline', ar: 'خدمة في نفس اليوم', en: 'Same-day service', color: '#8b5cf6' },
];

export default function ServicesScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const isRTL = language === 'ar';
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const styles = makeStyles(COLORS, isRTL, SHADOWS);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

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
        contentContainerStyle={{ padding: SPACING.m, paddingBottom: 100 }}
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          {/* Hero — friendly intro + CTA */}
          <View style={[styles.hero, { backgroundColor: COLORS.primary }]}>
            <View style={styles.heroLeft}>
              <Text style={styles.heroEyebrow}>
                {isRTL ? 'خدمة Fixate' : 'Fixate service'}
              </Text>
              <Text style={styles.heroTitle}>
                {isRTL ? 'صيانة موثوقة\nبفنيين معتمدين' : 'Trusted repairs\nfrom verified pros'}
              </Text>
              <Text style={styles.heroSubtitle}>
                {isRTL
                  ? 'يصلك الفني خلال 30 دقيقة في الرياض وجدة'
                  : 'Tech arrives within 30 min in Riyadh & Jeddah'}
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/request')}
                style={styles.heroCta}
                accessibilityRole="button"
              >
                <Text style={styles.heroCtaText}>
                  {isRTL ? 'اطلب الآن' : 'Request now'}
                </Text>
                <RTLIonicon name="arrow-forward" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.heroIconWrap}>
              <MaterialCommunityIcons name="tools" size={68} color="#ffffff20" />
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
              {SERVICES.filter((s) => s.available).length} {isRTL ? 'خدمات متاحة' : 'available'}
            </Text>
          </View>

          {/* Service grid (2 columns) */}
          <View style={styles.grid}>
            {SERVICES.map((s) => (
              <PressableScale
                key={s.id}
                to={0.97}
                style={[
                  styles.tile,
                  { backgroundColor: COLORS.card },
                  !s.available && { opacity: 0.6 },
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
                    s.fromPrice ? (
                      <Text style={[styles.tilePrice, { color: COLORS.primary }]}>
                        {isRTL ? `يبدأ من ${s.fromPrice} ر.س` : `From ${s.fromPrice} SAR`}
                      </Text>
                    ) : null
                  ) : (
                    <View style={[styles.soonPill, { backgroundColor: COLORS.textSecondary + '20' }]}>
                      <Text style={[styles.soonText, { color: COLORS.textSecondary }]}>
                        {isRTL ? 'قريباً' : 'Coming soon'}
                      </Text>
                    </View>
                  )}
                </View>
              </PressableScale>
            ))}
          </View>

          {/* Fixate Market — lives inside Services (not a homepage block). */}
          <View style={[styles.sectionRow, { marginTop: 26 }]}>
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
              {isRTL ? 'المزيد في Fixate' : 'More on Fixate'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/market')}
            style={[styles.helpCard, { backgroundColor: COLORS.card, borderColor: COLORS.border, marginTop: 4 }]}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'سوق Fixate' : 'Fixate Market'}
          >
            <View style={[styles.helpIcon, { backgroundColor: '#7C3AED15' }]}>
              <MaterialCommunityIcons name="storefront-outline" size={22} color="#7C3AED" />
            </View>
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text style={[styles.helpTitle, { color: COLORS.text }]}>
                {isRTL ? 'سوق Fixate' : 'Fixate Market'}
              </Text>
              <Text style={[styles.helpSub, { color: COLORS.textSecondary }]}>
                {isRTL
                  ? 'بيع واشترِ أجهزة مستعملة وإكسسوارات وقطع غيار'
                  : 'Buy & sell used devices, accessories and spare parts'}
              </Text>
            </View>
            <RTLIonicon name="chevron-forward" size={20} color="#7C3AED" />
          </TouchableOpacity>

          {/* Help card — opens in-app live support */}
          <PressableScale
            onPress={() => router.push('/support-chat')}
            to={0.985}
            style={[styles.helpCard, { backgroundColor: COLORS.card }]}
            accessibilityRole="button"
          >
            <View style={[styles.helpIcon, { backgroundColor: COLORS.primary + '15' }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text style={[styles.helpTitle, { color: COLORS.text }]}>
                {isRTL ? 'لم تجد خدمتك؟' : "Didn't find your service?"}
              </Text>
              <Text style={[styles.helpSub, { color: COLORS.textSecondary }]}>
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
      borderRadius: 20,
      padding: 18,
      marginBottom: 16,
      overflow: 'hidden',
      minHeight: 160,
    },
    heroLeft: { flex: 1, justifyContent: 'space-between' },
    heroEyebrow: {
      color: '#ffffffcc',
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
      marginBottom: 4,
    },
    heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', lineHeight: 30 },
    heroSubtitle: { color: '#ffffffcc', fontSize: 12, marginTop: 4, lineHeight: 18 },
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
    heroCtaText: { color: C.primary, fontWeight: '800', fontSize: 13 },
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
    sectionMeta: { fontSize: 13, fontWeight: '500' },

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
      minHeight: 160,
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
    tileFoot: { marginTop: 10 },
    tilePrice: { fontSize: 12, fontWeight: '700' },
    soonPill: {
      alignSelf: isRTL ? 'flex-end' : 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    soonText: { fontSize: 10, fontWeight: '700' },

    // Help card
    helpCard: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      borderRadius: BORDER_RADIUS.md,
      padding: 16,
      marginTop: 24,
      ...SHADOWS.small,
    },
    helpIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    helpTitle: { fontSize: 14, fontWeight: '700' },
    helpSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  });
