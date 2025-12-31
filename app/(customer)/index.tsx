import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, StatusBar, Image, Animated, Dimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import { translations } from '../../constants/translations';
import Sidebar from '../../components/Sidebar';
import BottomNav from '../../components/BottomNav';

const { width } = Dimensions.get('window');

const CATEGORIES = [
  { id: 'phone', icon: 'cellphone', labelAr: 'جوالات', labelEn: 'Phones', color: '#10b981' },
  { id: 'laptop', icon: 'laptop', labelAr: 'لابتوب', labelEn: 'Laptops', color: '#3b82f6' },
  { id: 'tablet', icon: 'tablet', labelAr: 'تابلت', labelEn: 'Tablets', color: '#8b5cf6' },
  { id: 'watch', icon: 'watch', labelAr: 'ساعات', labelEn: 'Watches', color: '#f59e0b' },
];

const POPULAR_SERVICES = [
  {
    id: '1',
    titleAr: 'إصلاح شاشة آيفون',
    titleEn: 'iPhone Screen Repair',
    priceAr: 'من 250 ر.س',
    priceEn: 'From 250 SAR',
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=400&q=80',
  },
  {
    id: '2',
    titleAr: 'تبديل بطارية سامسونج',
    titleEn: 'Samsung Battery Replacement',
    priceAr: 'من 150 ر.س',
    priceEn: 'From 150 SAR',
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=400&q=80',
  },
];

export default function CustomerHome() {
  const router = useRouter();
  const { language, setLanguage } = useApp();
  const isRTL = language === 'ar';
  
  const COLORS = {
    primary: '#10b981',
    secondary: '#059669',
    background: '#f9fafb',
    card: '#ffffff',
    text: '#1f2937',
    textSecondary: '#6b7280',
    border: '#e5e7eb',
    white: '#ffffff',
  };

  const [sidebarVisible, setSidebarVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const styles = createStyles(COLORS, isRTL);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      
      {/* Custom Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => setSidebarVisible(true)}
          >
            <MaterialIcons name="menu" size={28} color={COLORS.text} />
          </TouchableOpacity>
        </View>
        
        <Image 
          source={require('../../assets/fixate-logo-main.png')} 
          style={styles.logo} 
          resizeMode="contain" 
        />
        
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
          >
            <MaterialIcons name="language" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Welcome Section */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeText}>{isRTL ? 'أهلاً بك في' : 'Welcome to'}</Text>
            <Text style={styles.brandText}>Fixatee</Text>
            <Text style={styles.subtitleText}>
              {isRTL ? 'أفضل خدمات الصيانة بين يديك' : 'Best repair services at your fingertips'}
            </Text>
          </View>

          {/* Promo Banner */}
          <TouchableOpacity activeOpacity={0.9}>
            <LinearGradient
              colors={[COLORS.primary, COLORS.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.promoBanner}
            >
              <View style={styles.promoContent}>
                <Text style={styles.promoTitle}>{isRTL ? 'خصم 20% على أول طلب' : '20% Off First Order'}</Text>
                <Text style={styles.promoSubtitle}>{isRTL ? 'استخدم كود: FIX20' : 'Use Code: FIX20'}</Text>
                <View style={styles.promoButton}>
                  <Text style={styles.promoButtonText}>{isRTL ? 'اطلب الآن' : 'Order Now'}</Text>
                </View>
              </View>
              <MaterialCommunityIcons name="brightness-percent" size={80} color="rgba(255,255,255,0.2)" style={styles.promoIcon} />
            </LinearGradient>
          </TouchableOpacity>

          {/* Categories Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{isRTL ? 'ماذا تريد أن تصلح؟' : 'What needs fixing?'}</Text>
            </View>
            <View style={styles.categoriesGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity 
                  key={cat.id} 
                  style={styles.categoryCard}
                  onPress={() => router.push('/request')}
                >
                  <View style={[styles.categoryIconContainer, { backgroundColor: cat.color + '15' }]}>
                    <MaterialCommunityIcons name={cat.icon as any} size={32} color={cat.color} />
                  </View>
                  <Text style={styles.categoryLabel}>{isRTL ? cat.labelAr : cat.labelEn}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Popular Services */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{isRTL ? 'خدمات شائعة' : 'Popular Services'}</Text>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>{isRTL ? 'عرض الكل' : 'See All'}</Text>
              </TouchableOpacity>
            </View>
            {POPULAR_SERVICES.map((service) => (
              <TouchableOpacity 
                key={service.id} 
                style={styles.serviceCard}
                onPress={() => router.push('/request')}
              >
                <Image source={{ uri: service.image }} style={styles.serviceImage} />
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceTitle}>{isRTL ? service.titleAr : service.titleEn}</Text>
                  <View style={styles.serviceMeta}>
                    <View style={styles.ratingContainer}>
                      <Ionicons name="star" size={14} color="#f59e0b" />
                      <Text style={styles.ratingText}>{service.rating}</Text>
                    </View>
                    <Text style={styles.servicePrice}>{isRTL ? service.priceAr : service.priceEn}</Text>
                  </View>
                </View>
                <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
        
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNav />

      <Sidebar 
        visible={sidebarVisible} 
        onClose={() => setSidebarVisible(false)} 
      />
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any, isRTL: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    height: 60,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: { width: 40 },
  headerRight: { width: 40 },
  logo: { width: 100, height: 40 },
  iconButton: { padding: 4 },
  scrollContent: { padding: 16 },
  welcomeSection: { marginBottom: 24, alignItems: isRTL ? 'flex-end' : 'flex-start' },
  welcomeText: { fontSize: 16, color: COLORS.textSecondary },
  brandText: { fontSize: 32, fontWeight: 'bold', color: COLORS.primary, marginTop: -4 },
  subtitleText: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  promoBanner: {
    borderRadius: 20,
    padding: 20,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 24,
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  promoContent: { flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' },
  promoTitle: { color: COLORS.white, fontSize: 20, fontWeight: 'bold' },
  promoSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 4 },
  promoButton: { backgroundColor: COLORS.white, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, marginTop: 12 },
  promoButtonText: { color: COLORS.primary, fontWeight: 'bold', fontSize: 14 },
  promoIcon: { position: 'absolute', right: isRTL ? undefined : -10, left: isRTL ? -10 : undefined, bottom: -10 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  seeAllText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  categoriesGrid: { flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 12 },
  categoryCard: {
    width: (width - 32 - 36) / 4,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryIconContainer: { width: 50, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  categoryLabel: { fontSize: 12, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  serviceCard: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  serviceImage: { width: 60, height: 60, borderRadius: 12 },
  serviceInfo: { flex: 1, marginHorizontal: 12, alignItems: isRTL ? 'flex-end' : 'flex-start' },
  serviceTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.text },
  serviceMeta: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', marginTop: 4, gap: 12 },
  ratingContainer: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  servicePrice: { fontSize: 13, color: COLORS.primary, fontWeight: 'bold' },
});
