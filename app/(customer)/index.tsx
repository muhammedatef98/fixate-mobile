import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, StatusBar, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getColors, getShadows, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { translations } from '../../constants/translations';
import NeuSearchBar from '../../components/NeuSearchBar';
import NeuCard from '../../components/NeuCard';
import NeuButton from '../../components/NeuButton';
import BottomNav from '../../components/BottomNav';
import Sidebar from '../../components/Sidebar';



const getPopularServices = (language: 'ar' | 'en') => [
  {
    id: 'screen',
    titleKey: 'screenReplacement',
    priceAr: '150 ر.س',
    priceEn: 'SAR 150',
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=800&q=80', // Phone screen repair
  },
  {
    id: 'battery',
    titleKey: 'batteryReplacement',
    priceAr: '100 ر.س',
    priceEn: 'SAR 100',
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=800&q=80', // Battery
  },
];

export default function CustomerHome() {
  const router = useRouter();
  const { isDark, language, setLanguage } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const isRTL = language === 'ar';
  const t = translations[language];

  const CATEGORIES = [
    { id: 'phones', icon: 'smartphone', labelKey: 'phones', color: COLORS.blue, iconSet: 'MaterialIcons' },
    { id: 'laptops', icon: 'laptop', labelKey: 'laptops', color: COLORS.purple, iconSet: 'MaterialIcons' },
    { id: 'tablets', icon: 'tablet', labelKey: 'tablets', color: COLORS.pink, iconSet: 'MaterialIcons' },
    { id: 'other', icon: 'shield-check', labelKey: 'other', color: COLORS.orange, iconSet: 'MaterialCommunityIcons' },
  ];

  const POPULAR_SERVICES = getPopularServices(language);

  const styles = createStyles(COLORS, SHADOWS);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      {/* App Header */}
      <View style={[styles.header, isRTL && styles.headerRTL]}>
        {isRTL ? (
          <>
            <TouchableOpacity 
              style={styles.menuButton}
              onPress={() => setSidebarVisible(true)}
            >
              <MaterialIcons name="menu" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
            
            <Text style={styles.headerTitle}>Fixate</Text>
            
            <TouchableOpacity 
              style={styles.languageButton}
              onPress={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            >
              <MaterialIcons name="language" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity 
              style={styles.languageButton}
              onPress={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            >
              <MaterialIcons name="language" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
            
            <Text style={styles.headerTitle}>Fixate</Text>
            
            <TouchableOpacity 
              style={styles.menuButton}
              onPress={() => setSidebarVisible(true)}
            >
              <MaterialIcons name="menu" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </>
        )}
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={[styles.heroTitle, { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
            {t.whatNeedsFixing}{'\n'}
            <Text style={styles.heroTitleHighlight}>{t.fixingToday}</Text>
          </Text>
          
          <NeuSearchBar
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchBar}
          />
        </View>

        {/* Categories */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, isRTL && { flexDirection: 'row-reverse' }]}>
            <Text style={[styles.sectionTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t.categories}</Text>
            <TouchableOpacity onPress={() => router.push('/services')}>
              <Text style={[styles.seeAll, { textAlign: isRTL ? 'left' : 'right' }]}>{t.seeAll}</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.categoriesGrid}>
            {CATEGORIES.map((category) => {
              const IconComponent = category.iconSet === 'MaterialIcons' ? MaterialIcons : MaterialCommunityIcons;
              return (
                <TouchableOpacity 
                  key={category.id} 
                  style={styles.categoryItem}
                  onPress={() => router.push('/request')}
                >
                  <View style={[styles.categoryIcon, { backgroundColor: category.color + '20' }]}>
                    <IconComponent name={category.icon as any} size={28} color={category.color} />
                  </View>
                  <Text style={[styles.categoryLabel, { textAlign: 'center' }]}>{t[category.labelKey as keyof typeof t]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Promo Card */}
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.promoCard}
        >
          {/* Background Blurs */}
          <View style={styles.promoBlurTop} />
          <View style={styles.promoBlurBottom} />
          
          <View style={[styles.promoContent, isRTL && { alignItems: 'flex-end' }]}>
            <View style={styles.promoBadge}>
              <Text style={styles.promoBadgeText}>{t.specialOffer}</Text>
            </View>
            <Text style={[styles.promoTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t.discount20}</Text>
            <Text style={[styles.promoSubtitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t.firstRepair}</Text>
            <TouchableOpacity style={styles.promoButton}>
              <Text style={styles.promoButtonText}>{t.claimNow}</Text>
            </TouchableOpacity>
          </View>
          
          {/* Promo image placeholder - add your own image */}
        </LinearGradient>

        {/* Popular Services */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t.popularServices}</Text>
          
          {POPULAR_SERVICES.map((service) => (
            <NeuCard 
              key={service.id} 
              style={styles.serviceCard}
              onPress={() => router.push('/request')}
            >
              <Image
                source={{ uri: service.image }}
                style={styles.serviceImage}
              />
              <View style={styles.serviceInfo}>
                <Text style={[styles.serviceTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t[service.titleKey as keyof typeof t]}</Text>
                <View style={[styles.serviceRating, isRTL && { flexDirection: 'row-reverse' }]}>
                  <MaterialIcons name="star" size={14} color="#F59E0B" />
                  <Text style={styles.ratingText}>{service.rating}</Text>
                </View>
                <View style={[styles.serviceFooter, isRTL && { flexDirection: 'row-reverse' }]}>
                  <Text style={[styles.servicePrice, { textAlign: isRTL ? 'right' : 'left' }]}>{isRTL ? service.priceAr : service.priceEn}</Text>
                  <View style={styles.serviceArrow}>
                    <MaterialIcons name={isRTL ? "arrow-back" : "arrow-forward"} size={16} color={COLORS.primary} />
                  </View>
                </View>
              </View>
            </NeuCard>
          ))}
        </View>

        {/* Bottom Spacing for Nav */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNav />
      
      {/* Sidebar */}
      <Sidebar 
        visible={sidebarVisible} 
        onClose={() => setSidebarVisible(false)} 
      />
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any, SHADOWS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerRTL: {
    flexDirection: 'row-reverse',
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.neuFlat,
  },
  languageButton: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.neuFlat,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.background,
    overflow: 'hidden',
    ...SHADOWS.neuFlat,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
  },
  heroSection: {
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
  },
  heroTitle: {
    ...TYPOGRAPHY.h1,
    color: COLORS.text,
    lineHeight: 40,
    marginBottom: SPACING.lg,
  },
  heroTitleHighlight: {
    color: COLORS.primary,
  },
  searchBar: {
    marginTop: SPACING.md,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  categoriesGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  categoryItem: {
    flex: 1,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  categoryIcon: {
    width: 64,
    height: 64,
    borderRadius: BORDER_RADIUS.xl,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.neuFlat,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  promoCard: {
    height: 192,
    borderRadius: BORDER_RADIUS.xxl,
    marginBottom: SPACING.xl,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    overflow: 'hidden',
    ...SHADOWS.primaryGlow,
  },
  promoBlurTop: {
    position: 'absolute',
    right: -20,
    top: -20,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  promoBlurBottom: {
    position: 'absolute',
    left: -20,
    bottom: -20,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  promoContent: {
    flex: 1,
    zIndex: 10,
  },
  promoBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: SPACING.md,
  },
  promoBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  promoTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: SPACING.sm,
  },
  promoSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: SPACING.md,
  },
  promoButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.white,
    ...SHADOWS.medium,
  },
  promoButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.primary,
  },

  serviceCard: {
    flexDirection: 'row',
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  serviceImage: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.xl,
  },
  serviceInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  serviceRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
  },
  serviceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  serviceArrow: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.neuFlat,
  },
});
