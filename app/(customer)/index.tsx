import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Dimensions,
  Animated,
  I18nManager,
  StatusBar,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import BottomNav from '../../components/BottomNav';
import Sidebar from '../../components/Sidebar';
import { requests } from '../../lib/supabase-api';

const { width } = Dimensions.get('window');

const DEVICE_CATEGORIES = [
  { id: 1, titleEn: 'Smartphones', titleAr: 'هواتف ذكية', icon: 'smartphone', color: '#3B82F6' },
  { id: 2, titleEn: 'Laptops', titleAr: 'لابتوبات', icon: 'laptop', color: '#8B5CF6' },
  { id: 3, titleEn: 'Tablets', titleAr: 'تابلت', icon: 'tablet', color: '#EC4899' },
  { id: 4, titleEn: 'Smartwatches', titleAr: 'ساعات ذكية', icon: 'watch', color: '#F59E0B' },
];

const PROMO_SLIDES = [
  { id: 1, titleEn: '6-Month Warranty', titleAr: 'ضمان 6 أشهر', descEn: 'On all repairs', descAr: 'على جميع الإصلاحات', color: '#10B981', icon: 'shield-check' },
  { id: 2, titleEn: 'Same-Day Service', titleAr: 'خدمة في نفس اليوم', descEn: 'Fast & Reliable', descAr: 'سريع وموثوق', color: '#3B82F6', icon: 'lightning-bolt' },
  { id: 3, titleEn: 'Home Pickup', titleAr: 'استلام من المنزل', descEn: 'Free delivery included', descAr: 'التوصيل مجاني', color: '#F59E0B', icon: 'truck-delivery' },
];

const WHY_US = [
  { id: 1, titleEn: 'Expert Technicians', titleAr: 'فنيون خبراء', icon: 'tools', color: '#10B981' },
  { id: 2, titleEn: 'Transparent Pricing', titleAr: 'أسعار شفافة', icon: 'tag-multiple', color: '#3B82F6' },
  { id: 3, titleEn: 'Quick Response', titleAr: 'رد سريع', icon: 'clock-fast', color: '#F59E0B' },
  { id: 4, titleEn: '24/7 Support', titleAr: 'دعم 24/7', icon: 'headset', color: '#EC4899' },
];

export default function CustomerHomeScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';

  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const scrollX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
    loadActiveOrders();
  }, []);

  const loadActiveOrders = async () => {
    try {
      const orders = await requests.getAll();
      const active = orders.filter((o: any) => o.status !== 'completed' && o.status !== 'cancelled');
      setActiveOrders(active.slice(0, 1));
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  };

  const handleCategoryPress = () => {
    router.push('/request');
  };

  const styles = createStyles(COLORS, isRTL, SHADOWS);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: COLORS.card }]}>
        <TouchableOpacity onPress={() => setSidebarVisible(true)} style={styles.iconButton}>
          <Ionicons name="menu" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[styles.logo, { color: COLORS.primary }]}>Fixate</Text>
        <TouchableOpacity style={styles.iconButton}>
          <Ionicons name="notifications-outline" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {/* Hero Section */}
          <View style={[styles.heroSection, { backgroundColor: COLORS.primary + '10' }, SHADOWS.small]}>
            <View style={styles.heroContent}>
              <Text style={[styles.heroGreeting, { color: COLORS.textSecondary }]}>
                {isRTL ? 'أهلاً بك' : 'Welcome back'}
              </Text>
              <Text style={[styles.heroTitle, { color: COLORS.text }]}>
                {isRTL ? 'محمد' : 'Mohamed'}
              </Text>
              <Text style={[styles.heroSubtitle, { color: COLORS.textSecondary }]}>
                {isRTL ? 'كيف يمكننا مساعدتك اليوم؟' : 'How can we help you today?'}
              </Text>
            </View>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="hand-wave" size={48} color={COLORS.primary} />
            </View>
          </View>

          {/* Search Bar */}
          <TouchableOpacity style={[styles.searchBar, { backgroundColor: COLORS.card }, SHADOWS.small]}>
            <Ionicons name="search" size={20} color={COLORS.textSecondary} />
            <Text style={[styles.searchPlaceholder, { color: COLORS.textSecondary }]}>
              {isRTL ? 'ابحث عن جهازك...' : 'Search your device...'}
            </Text>
          </TouchableOpacity>

          {/* Active Order Alert */}
          {activeOrders.length > 0 && (
            <TouchableOpacity
              style={[styles.activeOrderCard, { backgroundColor: COLORS.primary + '15' }, SHADOWS.small]}
              onPress={() => router.push(`/order-details?id=${activeOrders[0].id}`)}
            >
              <View style={styles.activeOrderContent}>
                <View style={[styles.activeOrderIcon, { backgroundColor: COLORS.primary }]}>
                  <MaterialCommunityIcons name="clock-outline" size={20} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.activeOrderTitle, { color: COLORS.text }]}>
                    {isRTL ? 'طلب قيد المعالجة' : 'Order in Progress'}
                  </Text>
                  <Text style={[styles.activeOrderStatus, { color: COLORS.textSecondary }]}>
                    {isRTL ? 'اضغط للتفاصيل' : 'Tap for details'}
                  </Text>
                </View>
                <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color={COLORS.primary} />
              </View>
            </TouchableOpacity>
          )}

          {/* Promo Slider */}
          <View style={styles.promoSection}>
            <FlatList
              data={PROMO_SLIDES}
              renderItem={({ item }) => (
                <View style={[styles.promoCard, { backgroundColor: item.color, width: width - 32 }]}>
                  <View style={styles.promoCardContent}>
                    <MaterialCommunityIcons name={item.icon} size={40} color="#fff" />
                    <View style={{ marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0, flex: 1 }}>
                      <Text style={styles.promoCardTitle}>{isRTL ? item.titleAr : item.titleEn}</Text>
                      <Text style={styles.promoCardDesc}>{isRTL ? item.descAr : item.descEn}</Text>
                    </View>
                  </View>
                </View>
              )}
              keyExtractor={(item) => item.id.toString()}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
              scrollEventThrottle={16}
            />
            <View style={styles.promoDots}>
              {PROMO_SLIDES.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.promoDot,
                    {
                      backgroundColor:
                        index === Math.round(scrollX.__getValue() / (width - 32)) ? COLORS.primary : COLORS.border,
                    },
                  ]}
                />
              ))}
            </View>
          </View>

          {/* Device Categories */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
                {isRTL ? 'اختر جهازك' : 'Choose Your Device'}
              </Text>
            </View>
            <View style={styles.categoriesGrid}>
              {DEVICE_CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[styles.categoryCard, { backgroundColor: COLORS.card }, SHADOWS.small]}
                  onPress={handleCategoryPress}
                >
                  <View style={[styles.categoryIconContainer, { backgroundColor: category.color + '20' }]}>
                    <MaterialCommunityIcons name={category.icon} size={32} color={category.color} />
                  </View>
                  <Text style={[styles.categoryLabel, { color: COLORS.text }]}>
                    {isRTL ? category.titleAr : category.titleEn}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Why Choose Us */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: COLORS.text, marginBottom: 16 }]}>
              {isRTL ? 'لماذا Fixate؟' : 'Why Choose Fixate?'}
            </Text>
            <View style={styles.whyUsGrid}>
              {WHY_US.map((item) => (
                <View key={item.id} style={[styles.whyUsCard, { backgroundColor: COLORS.card }, SHADOWS.small]}>
                  <View style={[styles.whyUsIconContainer, { backgroundColor: item.color + '20' }]}>
                    <MaterialCommunityIcons name={item.icon} size={28} color={item.color} />
                  </View>
                  <Text style={[styles.whyUsTitle, { color: COLORS.text }]}>
                    {isRTL ? item.titleAr : item.titleEn}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* CTA Button */}
          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: COLORS.primary }, SHADOWS.medium]}
            onPress={handleCategoryPress}
          >
            <MaterialCommunityIcons name="plus-circle" size={24} color="#fff" />
            <Text style={styles.ctaButtonText}>{isRTL ? 'طلب إصلاح جديد' : 'New Repair Request'}</Text>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </Animated.View>
      </ScrollView>

      <BottomNav />
      <Sidebar visible={sidebarVisible} onClose={() => setSidebarVisible(false)} />
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any, isRTL: boolean, SHADOWS: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      height: 60,
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    iconButton: { padding: 8 },
    logo: { fontSize: 24, fontWeight: 'bold' },
    scrollContent: { padding: 16 },

    // Hero Section
    heroSection: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
      paddingHorizontal: 16,
      paddingVertical: 20,
      borderRadius: BORDER_RADIUS.lg,
    },
    heroContent: { flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' },
    heroGreeting: { fontSize: 14, fontWeight: '500' },
    heroTitle: { fontSize: 28, fontWeight: 'bold', marginTop: 4 },
    heroSubtitle: { fontSize: 14, marginTop: 8 },
    heroIcon: { marginLeft: isRTL ? 16 : 0, marginRight: isRTL ? 0 : 16 },

    // Search Bar
    searchBar: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      height: 50,
      borderRadius: BORDER_RADIUS.lg,
      paddingHorizontal: 16,
      alignItems: 'center',
      gap: 12,
      marginBottom: 24,
    },
    searchPlaceholder: { fontSize: 14, fontWeight: '500' },

    // Active Order Card
    activeOrderCard: {
      borderRadius: BORDER_RADIUS.lg,
      padding: 16,
      marginBottom: 24,
      borderLeftWidth: 4,
    },
    activeOrderContent: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 12,
    },
    activeOrderIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    activeOrderTitle: { fontSize: 16, fontWeight: 'bold' },
    activeOrderStatus: { fontSize: 12, marginTop: 4 },

    // Promo Section
    promoSection: { marginBottom: 24 },
    promoCard: {
      borderRadius: BORDER_RADIUS.lg,
      padding: 20,
      marginRight: 16,
      justifyContent: 'center',
    },
    promoCardContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    promoCardTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
    promoCardDesc: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
    promoDots: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      marginTop: 12,
    },
    promoDot: { width: 8, height: 8, borderRadius: 4 },

    // Section
    section: { marginBottom: 24 },
    sectionHeader: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', marginBottom: 16 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold' },

    // Categories Grid
    categoriesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: 'space-between',
    },
    categoryCard: {
      width: (width - 32 - 36) / 2,
      borderRadius: BORDER_RADIUS.lg,
      padding: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    categoryIconContainer: { width: 60, height: 60, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    categoryLabel: { fontSize: 14, fontWeight: '600', textAlign: 'center' },

    // Why Us Grid
    whyUsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: 'space-between',
    },
    whyUsCard: {
      width: (width - 32 - 36) / 2,
      borderRadius: BORDER_RADIUS.lg,
      padding: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    whyUsIconContainer: { width: 56, height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    whyUsTitle: { fontSize: 13, fontWeight: '600', textAlign: 'center' },

    // CTA Button
    ctaButton: {
      flexDirection: 'row',
      height: 56,
      borderRadius: BORDER_RADIUS.lg,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
      marginBottom: 24,
    },
    ctaButtonText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  });
