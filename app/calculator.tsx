import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { getColors, getShadows, SPACING } from '../constants/theme';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';

const { width } = Dimensions.get('window');

// Pricing Data
const getPricingData = (language: 'ar' | 'en') => ({
  brands: [
    { id: 'apple', name: 'Apple', icon: 'apple' },
    { id: 'samsung', name: 'Samsung', icon: 'android' },
    { id: 'huawei', name: 'Huawei', icon: 'cellphone' },
  ],
  devices: [
    { id: 'phone', nameAr: 'جوال', nameEn: 'Phone', icon: 'cellphone' },
    { id: 'tablet', nameAr: 'تابلت', nameEn: 'Tablet', icon: 'tablet' },
    { id: 'laptop', nameAr: 'لابتوب', nameEn: 'Laptop', icon: 'laptop' },
  ],
  issues: [
    { id: 'screen', nameAr: 'كسر الشاشة', nameEn: 'Screen Crack', basePrice: 500, priceRange: { min: 400, max: 600 } },
    { id: 'battery', nameAr: 'تغيير بطارية', nameEn: 'Battery Replacement', basePrice: 250, priceRange: { min: 200, max: 300 } },
    { id: 'charging', nameAr: 'مدخل الشحن', nameEn: 'Charging Port', basePrice: 220, priceRange: { min: 190, max: 260 } },
    { id: 'camera', nameAr: 'الكاميرا', nameEn: 'Camera', basePrice: 350, priceRange: { min: 300, max: 420 } },
    { id: 'software', nameAr: 'سوفتوير', nameEn: 'Software', basePrice: 150, priceRange: { min: 120, max: 180 } },
  ]
});

export default function PriceCalculatorScreen() {
  const router = useRouter();
  const { isDark, language } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';
  
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);

  const PRICING_DATA = getPricingData(language);

  const calculatePrice = () => {
    if (!selectedIssue) return { min: 0, max: 0 };
    const issue = PRICING_DATA.issues.find(i => i.id === selectedIssue);
    if (!issue?.priceRange) return { min: 0, max: 0 };
    
    let minPrice = issue.priceRange.min;
    let maxPrice = issue.priceRange.max;

    // Price adjustments based on brand/device
    if (selectedBrand === 'apple') {
      minPrice = Math.round(minPrice * 1.2);
      maxPrice = Math.round(maxPrice * 1.2);
    }
    if (selectedDevice === 'laptop') {
      minPrice = Math.round(minPrice * 1.5);
      maxPrice = Math.round(maxPrice * 1.5);
    }
    if (selectedDevice === 'tablet') {
      minPrice = Math.round(minPrice * 1.3);
      maxPrice = Math.round(maxPrice * 1.3);
    }

    return { min: minPrice, max: maxPrice };
  };

  const totalPrice = calculatePrice();
  const styles = createStyles(COLORS, SHADOWS, isRTL);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isRTL ? 'حاسبة الأسعار التقديرية' : 'Price Calculator'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Brand Selection */}
        <Text style={styles.sectionTitle}>{isRTL ? 'اختر الماركة' : 'Choose Brand'}</Text>
        <View style={styles.grid}>
          {PRICING_DATA.brands.map((brand) => (
            <TouchableOpacity
              key={brand.id}
              style={[
                styles.card,
                selectedBrand === brand.id && styles.selectedCard
              ]}
              onPress={() => setSelectedBrand(brand.id)}
            >
              <MaterialCommunityIcons 
                name={brand.icon as any} 
                size={32} 
                color={selectedBrand === brand.id ? COLORS.primary : COLORS.textSecondary} 
              />
              <Text style={[
                styles.cardText,
                selectedBrand === brand.id && styles.selectedText
              ]}>{brand.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Device Selection */}
        <Text style={styles.sectionTitle}>{isRTL ? 'اختر نوع الجهاز' : 'Choose Device Type'}</Text>
        <View style={styles.grid}>
          {PRICING_DATA.devices.map((device) => (
            <TouchableOpacity
              key={device.id}
              style={[
                styles.card,
                selectedDevice === device.id && styles.selectedCard
              ]}
              onPress={() => setSelectedDevice(device.id)}
            >
              <MaterialCommunityIcons 
                name={device.icon as any} 
                size={32} 
                color={selectedDevice === device.id ? COLORS.primary : COLORS.textSecondary} 
              />
              <Text style={[
                styles.cardText,
                selectedDevice === device.id && styles.selectedText
              ]}>{isRTL ? device.nameAr : device.nameEn}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Issue Selection */}
        <Text style={styles.sectionTitle}>{isRTL ? 'اختر نوع العطل' : 'Choose Issue Type'}</Text>
        <View style={styles.list}>
          {PRICING_DATA.issues.map((issue) => (
            <TouchableOpacity
              key={issue.id}
              style={[
                styles.listItem,
                selectedIssue === issue.id && styles.selectedListItem
              ]}
              onPress={() => setSelectedIssue(issue.id)}
            >
              <Text style={[
                styles.listItemText,
                selectedIssue === issue.id && styles.selectedText
              ]}>{isRTL ? issue.nameAr : issue.nameEn}</Text>
              {selectedIssue === issue.id && (
                <MaterialIcons name="check-circle" size={24} color={COLORS.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Price Result Footer */}
      <View style={styles.footer}>
        <View style={styles.priceContainer}>
          <Text style={styles.priceLabel}>
            {isRTL ? 'السعر التقديري:' : 'Estimated Price:'}
          </Text>
          <Text style={styles.priceValue}>
            {totalPrice.min > 0 ? (isRTL ? `${totalPrice.min}-${totalPrice.max} ر.س` : `SAR ${totalPrice.min}-${totalPrice.max}`) : '--'}
          </Text>
        </View>
        <View style={styles.disclaimerContainer}>
          <MaterialCommunityIcons name="information" size={16} color={COLORS.textSecondary} style={{ marginTop: 2 }} />
          <View style={{ flex: 1, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }}>
            <Text style={styles.disclaimer}>
              {isRTL 
                ? '• السعر النهائي يتحدد بعد فحص الجهاز'
                : '• Final price determined after device inspection'
              }
            </Text>
            <Text style={styles.disclaimer}>
              {isRTL 
                ? '• الأسعار شاملة للضريبة'
                : '• Prices include VAT'
              }
            </Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={[styles.bookBtn, totalPrice.min === 0 && styles.disabledBtn]}
          disabled={totalPrice.min === 0}
          onPress={() => router.push('/request')}
        >
          <Text style={styles.bookBtnText}>
            {isRTL ? 'احجز موعد صيانة الآن' : 'Book Service Now'}
          </Text>
          <MaterialIcons name={isRTL ? "arrow-back" : "arrow-forward"} size={20} color="#FFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any, SHADOWS: any, isRTL: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
    marginTop: SPACING.sm,
    textAlign: isRTL ? 'right' : 'left',
  },
  grid: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  card: {
    width: (width - SPACING.lg * 2 - SPACING.md * 2) / 3,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...SHADOWS.neuSmall,
  },
  selectedCard: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  cardText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  selectedText: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  list: {
    gap: SPACING.sm,
  },
  listItem: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectedListItem: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  listItemText: {
    fontSize: 16,
    color: COLORS.text,
    textAlign: isRTL ? 'right' : 'left',
  },
  footer: {
    padding: SPACING.lg,
    paddingBottom: 34,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...SHADOWS.neuLarge,
  },
  priceContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  priceLabel: {
    fontSize: 18,
    color: COLORS.text,
    fontWeight: 'bold',
  },
  priceValue: {
    fontSize: 24,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  disclaimerContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  disclaimer: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: isRTL ? 'right' : 'left',
    marginBottom: 4,
  },
  bookBtn: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    borderRadius: 16,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  disabledBtn: {
    backgroundColor: COLORS.textSecondary,
    opacity: 0.5,
  },
  bookBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
