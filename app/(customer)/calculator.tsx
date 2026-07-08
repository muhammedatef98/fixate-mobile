import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated, StatusBar, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import BottomNav from '../../components/BottomNav';
import { BRANDS } from '../../constants/repairData';
import { RTLIonicon } from '../../components/RTLIcon';
import { getColors } from '../../constants/theme';
import FixateLogo from '../../components/FixateLogo';
import {
  SPARE_PART_LABELS,
  SPARE_PART_MULTIPLIERS,
  type SparePartQuality,
} from '../../types/order';

const { width } = Dimensions.get('window');

const DEVICES = [
  { id: 'phone', nameAr: 'جوال', nameEn: 'Phone', icon: 'cellphone' },
  { id: 'tablet', nameAr: 'تابلت', nameEn: 'Tablet', icon: 'tablet' },
  { id: 'laptop', nameAr: 'لابتوب', nameEn: 'Laptop', icon: 'laptop' },
  { id: 'watch', nameAr: 'ساعة ذكية', nameEn: 'Smart Watch', icon: 'watch' },
];

// Saudi-market 2026 price ranges (see utils/pricing.ts for sourcing notes).
// Each entry has min/max so the calculator surfaces a realistic band rather
// than a single number that would either under-quote flagships or over-quote
// budget devices.
const ISSUES: { id: string; deviceType: string; nameAr: string; nameEn: string; min: number; max: number }[] = [
  // Phones
  { id: 'screen', deviceType: 'phone', nameAr: 'كسر الشاشة', nameEn: 'Screen Repair', min: 200, max: 1100 },
  { id: 'battery', deviceType: 'phone', nameAr: 'تغيير البطارية', nameEn: 'Battery Replacement', min: 120, max: 380 },
  { id: 'charging', deviceType: 'phone', nameAr: 'منفذ الشحن', nameEn: 'Charging Port', min: 100, max: 220 },
  { id: 'camera', deviceType: 'phone', nameAr: 'الكاميرا', nameEn: 'Camera', min: 180, max: 500 },
  { id: 'back_glass', deviceType: 'phone', nameAr: 'الزجاج الخلفي', nameEn: 'Back Glass', min: 150, max: 500 },
  { id: 'software', deviceType: 'phone', nameAr: 'مشكلة برمجية', nameEn: 'Software', min: 80, max: 200 },
  // Tablets
  { id: 'screen_tab', deviceType: 'tablet', nameAr: 'كسر الشاشة', nameEn: 'Screen Repair', min: 400, max: 950 },
  { id: 'battery_tab', deviceType: 'tablet', nameAr: 'تغيير البطارية', nameEn: 'Battery Replacement', min: 250, max: 480 },
  { id: 'charging_tab', deviceType: 'tablet', nameAr: 'منفذ الشحن', nameEn: 'Charging Port', min: 150, max: 320 },
  // Laptops
  { id: 'screen_lap', deviceType: 'laptop', nameAr: 'كسر الشاشة', nameEn: 'Screen Repair', min: 450, max: 1300 },
  { id: 'battery_lap', deviceType: 'laptop', nameAr: 'تغيير البطارية', nameEn: 'Battery Replacement', min: 250, max: 550 },
  { id: 'keyboard_lap', deviceType: 'laptop', nameAr: 'لوحة المفاتيح', nameEn: 'Keyboard', min: 200, max: 500 },
  { id: 'os_lap', deviceType: 'laptop', nameAr: 'إعادة تنصيب النظام', nameEn: 'OS Reinstall', min: 100, max: 220 },
  // Watches
  { id: 'screen_watch', deviceType: 'watch', nameAr: 'كسر الشاشة', nameEn: 'Screen Repair', min: 280, max: 650 },
  { id: 'battery_watch', deviceType: 'watch', nameAr: 'تغيير البطارية', nameEn: 'Battery Replacement', min: 180, max: 320 },
];

export default function PriceCalculatorScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const isRTL = language === 'ar';
  const themeColors = getColors(isDark);

  const COLORS = {
    primary: themeColors.primary,
    background: themeColors.background,
    card: themeColors.card,
    text: themeColors.text,
    textSecondary: themeColors.textSecondary,
    border: themeColors.border,
    white: themeColors.card,
  };

  const [selectedDevice, setSelectedDevice] = useState<string | null>('phone');
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<SparePartQuality>('original');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const filteredBrands = BRANDS.filter(b => b.deviceType === selectedDevice);
  const filteredIssues = ISSUES.filter(i => i.deviceType === selectedDevice);

  // Brand multiplier — Apple/Samsung flagships sit at the top of every band,
  // so when those are selected we shift the whole range upwards. Other
  // brands stay on the median band.
  const brandMultiplier = selectedBrand === 'apple' ? 1.25 : selectedBrand === 'samsung' ? 1.15 : 1.0;

  const issueObj = selectedIssue ? ISSUES.find((i) => i.id === selectedIssue) : null;
  // Spare-part quality shifts the band: originals are the reference,
  // high-quality/economy parts are progressively cheaper.
  const qualityMultiplier = SPARE_PART_MULTIPLIERS[selectedQuality];
  const range = issueObj
    ? {
        min: Math.round(issueObj.min * brandMultiplier * qualityMultiplier),
        max: Math.round(issueObj.max * brandMultiplier * qualityMultiplier),
      }
    : null;

  // 15% platform commission — see utils/pricing.ts for sourcing.
  const COMMISSION_RATE = 0.15;
  const techMin = range ? Math.round(range.min * (1 - COMMISSION_RATE)) : 0;
  const techMax = range ? Math.round(range.max * (1 - COMMISSION_RATE)) : 0;
  const platformMin = range ? range.min - techMin : 0;
  const platformMax = range ? range.max - techMax : 0;
  const styles = createStyles(COLORS, isRTL);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={isRTL ? 'رجوع' : 'Back'} onPress={() => router.back()} style={styles.backButton}>
          <RTLIonicon name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isRTL ? 'حاسبة الأسعار' : 'Price Calculator'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {/* Branded hero */}
          <View style={styles.brandHero}>
            <View style={styles.brandHeroLogo}>
              <FixateLogo size={46} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.brandHeroTitle}>
                {isRTL ? 'حاسبة أسعار Fixate' : 'Fixate Price Calculator'}
              </Text>
              <Text style={styles.brandHeroSub}>
                {isRTL
                  ? 'تقدير سريع — السعر النهائي هو العرض الذي تقبله من الفنيين'
                  : 'A quick estimate — the final price is the technician offer you accept'}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>{isRTL ? '1. نوع الجهاز' : '1. Device Type'}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deviceList}>
            {DEVICES.map((device) => (
              <TouchableOpacity
                key={device.id}
                style={[styles.deviceCard, selectedDevice === device.id && styles.selectedCard]}
                onPress={() => { setSelectedDevice(device.id); setSelectedBrand(null); setSelectedIssue(null); }}
              >
                <MaterialCommunityIcons 
                  name={device.icon as any} 
                  size={28} 
                  color={selectedDevice === device.id ? COLORS.primary : COLORS.textSecondary} 
                />
                <Text style={[styles.deviceLabel, selectedDevice === device.id && styles.selectedLabel]}>
                  {isRTL ? device.nameAr : device.nameEn}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {selectedDevice && (
            <>
              <Text style={styles.sectionTitle}>{isRTL ? '2. الماركة' : '2. Brand'}</Text>
              <View style={styles.brandGrid}>
                {filteredBrands.slice(0, 6).map((brand) => (
                  <TouchableOpacity
                    key={brand.id}
                    style={[styles.brandCard, selectedBrand === brand.id && styles.selectedCard]}
                    onPress={() => setSelectedBrand(brand.id)}
                  >
                    <Image source={typeof brand.logo === 'string' ? { uri: brand.logo } : brand.logo} style={styles.brandLogo} resizeMode="contain" />
                    <Text style={[styles.brandLabel, selectedBrand === brand.id && styles.selectedLabel]}>{brand.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {selectedBrand && (
            <>
              <Text style={styles.sectionTitle}>{isRTL ? '3. نوع العطل' : '3. Issue Type'}</Text>
              <View style={styles.issueList}>
                {filteredIssues.map((issue) => (
                  <TouchableOpacity
                    key={issue.id}
                    style={[styles.issueItem, selectedIssue === issue.id && styles.selectedCard]}
                    onPress={() => setSelectedIssue(issue.id)}
                  >
                    <Text style={[styles.issueText, selectedIssue === issue.id && styles.selectedLabel]}>
                      {isRTL ? issue.nameAr : issue.nameEn}
                    </Text>
                    {selectedIssue === issue.id && <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />}
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {selectedIssue && (
            <>
              <Text style={styles.sectionTitle}>{isRTL ? '4. جودة قطعة الغيار' : '4. Spare-part quality'}</Text>
              <View style={styles.qualityRow}>
                {(['original', 'high_quality', 'economy'] as SparePartQuality[]).map((q) => {
                  const active = selectedQuality === q;
                  return (
                    <TouchableOpacity
                      key={q}
                      style={[styles.qualityChip, active && styles.selectedCard]}
                      onPress={() => setSelectedQuality(q)}
                    >
                      <MaterialCommunityIcons
                        name={q === 'original' ? 'shield-star' : q === 'high_quality' ? 'shield-check' : 'shield-outline'}
                        size={20}
                        color={active ? COLORS.primary : COLORS.textSecondary}
                      />
                      <Text style={[styles.qualityChipText, active && styles.selectedLabel]}>
                        {isRTL ? SPARE_PART_LABELS[q].ar : SPARE_PART_LABELS[q].en}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </Animated.View>
        <View style={{ height: 200 }} />
      </ScrollView>

      <View style={styles.priceFooter}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>{isRTL ? 'عرض السعر' : 'Quotation'}</Text>
          <Text style={styles.priceValue}>
            {range
              ? isRTL
                ? `تبدأ من ${range.min} – ${range.max} ر.س`
                : `Starts from ${range.min} – ${range.max} SAR`
              : '—'}
          </Text>
        </View>

        {/* Transparent breakdown — what the technician receives vs the
            platform fee. Helps customers trust the price and lets
            technicians see their take-home before accepting. */}
        {range && (
          <View style={styles.breakdownBox}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>
                {isRTL ? 'يستلمه الفني' : "Technician's payout"}
              </Text>
              <Text style={styles.breakdownValue}>
                {isRTL ? `${techMin} – ${techMax} ر.س` : `${techMin} – ${techMax} SAR`}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>
                {isRTL ? 'رسوم المنصة (15%)' : 'Platform fee (15%)'}
              </Text>
              <Text style={[styles.breakdownValue, { color: COLORS.textSecondary }]}>
                {isRTL ? `${platformMin} – ${platformMax} ر.س` : `${platformMin} – ${platformMax} SAR`}
              </Text>
            </View>
            <Text style={styles.breakdownNote}>
              {isRTL
                ? 'السعر النهائي يتحدّد بعد فحص الجهاز ويشمل ضماناً لمدة سنة كاملة'
                : 'Final price is set after diagnosis and includes a 1-year warranty'}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.bookButton, !range && { opacity: 0.5 }]}
          disabled={!range}
          onPress={() => router.push({ pathname: '/request', params: { quality: selectedQuality } })}
        >
          <Text style={styles.bookButtonText}>{isRTL ? 'احجز الآن' : 'Book Now'}</Text>
          <RTLIonicon name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <BottomNav />
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any, isRTL: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: isRTL ? 'row-reverse' : 'row', height: 60, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  scrollContent: { padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, marginBottom: 12, marginTop: 16, textAlign: isRTL ? 'right' : 'left' },
  deviceList: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12, paddingBottom: 8 },
  deviceCard: { width: 90, height: 90, backgroundColor: COLORS.white, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  selectedCard: { borderColor: COLORS.primary, backgroundColor: '#ecfdf5' },
  deviceLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 8, fontWeight: '600' },
  selectedLabel: { color: COLORS.primary, fontWeight: 'bold' },
  brandGrid: { flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 10 },
  brandCard: { width: (width - 52) / 3, backgroundColor: COLORS.white, borderRadius: 16, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  brandLogo: { width: 30, height: 30, marginBottom: 6 },
  brandLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  brandHero: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 16,
    marginBottom: 4,
  },
  brandHeroLogo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandHeroTitle: { color: '#fff', fontSize: 17, fontWeight: '800', textAlign: isRTL ? 'right' : 'left' },
  brandHeroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 4, lineHeight: 17, textAlign: isRTL ? 'right' : 'left' },
  qualityRow: { flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 10 },
  qualityChip: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  qualityChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  issueList: { gap: 10 },
  issueItem: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border },
  issueText: { fontSize: 15, color: COLORS.text },
  priceFooter: { position: 'absolute', bottom: 100, left: 20, right: 20, backgroundColor: COLORS.white, borderRadius: 24, padding: 20, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 },
  priceRow: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  priceLabel: { fontSize: 13, color: COLORS.textSecondary },
  priceValue: { fontSize: 18, fontWeight: '800', color: COLORS.primary, textAlign: isRTL ? 'left' : 'right' },
  breakdownBox: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 6,
  },
  breakdownRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: { fontSize: 12, color: COLORS.text, fontWeight: '500' },
  breakdownValue: { fontSize: 13, color: COLORS.text, fontWeight: '700' },
  breakdownNote: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4, textAlign: isRTL ? 'right' : 'left' },
  bookButton: { backgroundColor: COLORS.primary, height: 50, borderRadius: 16, flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  bookButtonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});
