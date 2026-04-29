import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Dimensions, Animated, StatusBar, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import BottomNav from '../../components/BottomNav';
import { BRANDS } from '../../constants/repairData';
import { RTLIonicon } from '../../components/RTLIcon';

const { width } = Dimensions.get('window');

const DEVICES = [
  { id: 'phone', nameAr: 'جوال', nameEn: 'Phone', icon: 'cellphone' },
  { id: 'tablet', nameAr: 'تابلت', nameEn: 'Tablet', icon: 'tablet' },
  { id: 'laptop', nameAr: 'لابتوب', nameEn: 'Laptop', icon: 'laptop' },
  { id: 'watch', nameAr: 'ساعة ذكية', nameEn: 'Smart Watch', icon: 'watch' },
];

const ISSUES = [
  { id: 'screen', deviceType: 'phone', nameAr: 'كسر الشاشة', nameEn: 'Screen Crack', basePrice: 250 },
  { id: 'battery', deviceType: 'phone', nameAr: 'تغيير بطارية', nameEn: 'Battery Replacement', basePrice: 120 },
  { id: 'charging', deviceType: 'phone', nameAr: 'مدخل الشحن', nameEn: 'Charging Port', basePrice: 100 },
  { id: 'camera', deviceType: 'phone', nameAr: 'الكاميرا', nameEn: 'Camera', basePrice: 180 },
  { id: 'software', deviceType: 'phone', nameAr: 'سوفتوير', nameEn: 'Software', basePrice: 80 },
  { id: 'screen_tab', deviceType: 'tablet', nameAr: 'كسر الشاشة', nameEn: 'Screen Crack', basePrice: 350 },
  { id: 'battery_tab', deviceType: 'tablet', nameAr: 'تغيير بطارية', nameEn: 'Battery Replacement', basePrice: 200 },
  { id: 'screen_lap', deviceType: 'laptop', nameAr: 'كسر الشاشة', nameEn: 'Screen Crack', basePrice: 450 },
  { id: 'battery_lap', deviceType: 'laptop', nameAr: 'تغيير بطارية', nameEn: 'Battery Replacement', basePrice: 300 },
  { id: 'keyboard_lap', deviceType: 'laptop', nameAr: 'لوحة المفاتيح', nameEn: 'Keyboard', basePrice: 250 },
  { id: 'screen_watch', deviceType: 'watch', nameAr: 'كسر الشاشة', nameEn: 'Screen Crack', basePrice: 200 },
  { id: 'battery_watch', deviceType: 'watch', nameAr: 'تغيير بطارية', nameEn: 'Battery Replacement', basePrice: 150 },
];

export default function PriceCalculatorScreen() {
  const router = useRouter();
  const { language } = useApp();
  const isRTL = language === 'ar';
  
  const COLORS = {
    primary: '#10b981',
    background: '#f9fafb',
    card: '#ffffff',
    text: '#1f2937',
    textSecondary: '#6b7280',
    border: '#e5e7eb',
    white: '#ffffff',
  };

  const [selectedDevice, setSelectedDevice] = useState<string | null>('phone');
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);

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

  const calculatePrice = () => {
    if (!selectedIssue) return 0;
    const issue = ISSUES.find(i => i.id === selectedIssue);
    let price = issue?.basePrice || 0;
    if (selectedBrand === 'apple') price *= 1.2;
    if (selectedBrand === 'samsung') price *= 1.1;
    return Math.round(price);
  };

  const totalPrice = calculatePrice();
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
        </Animated.View>
        <View style={{ height: 200 }} />
      </ScrollView>

      <View style={styles.priceFooter}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>{isRTL ? 'السعر التقديري' : 'Estimated Price'}</Text>
          <Text style={styles.priceValue}>{totalPrice > 0 ? (isRTL ? `${totalPrice} ر.س` : `${totalPrice} SAR`) : '--'}</Text>
        </View>
        <TouchableOpacity 
          style={[styles.bookButton, totalPrice === 0 && { opacity: 0.5 }]}
          disabled={totalPrice === 0}
          onPress={() => router.push('/request')}
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
  issueList: { gap: 10 },
  issueItem: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border },
  issueText: { fontSize: 15, color: COLORS.text },
  priceFooter: { position: 'absolute', bottom: 100, left: 20, right: 20, backgroundColor: COLORS.white, borderRadius: 24, padding: 20, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 },
  priceRow: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  priceLabel: { fontSize: 14, color: COLORS.textSecondary },
  priceValue: { fontSize: 24, fontWeight: 'bold', color: COLORS.primary },
  bookButton: { backgroundColor: COLORS.primary, height: 54, borderRadius: 16, flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  bookButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
