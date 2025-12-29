import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, SafeAreaView, Dimensions, StatusBar, I18nManager } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const SERVICES = [
  { id: 'phone', name: 'جوالات', icon: 'cellphone', color: '#10B981', bg: '#ECFDF5' },
  { id: 'laptop', name: 'لابتوب', icon: 'laptop', color: '#3B82F6', bg: '#EFF6FF' },
  { id: 'tablet', name: 'تابلت', icon: 'tablet', color: '#8B5CF6', bg: '#F5F3FF' },
  { id: 'smarthome', name: 'أجهزة منزلية', icon: 'home-automation', color: '#F59E0B', bg: '#FFFBEB' },
  { id: 'watch', name: 'ساعات', icon: 'watch', color: '#EC4899', bg: '#FDF2F8' },
  { id: 'contact', name: 'اتصل بنا', icon: 'phone', color: '#EF4444', bg: '#FEF2F2' },
];

const PROMOTIONS = [
  {
    id: 1,
    title: 'خصم 25%',
    subtitle: 'على صيانة الشاشات الأصلية',
    image: 'https://img.freepik.com/free-photo/technician-repairing-computer-computer-hardware-repairing-upgrade-technology_1150-8862.jpg',
    color: '#10B981'
  },
  {
    id: 2,
    title: 'فحص مجاني',
    subtitle: 'شامل لجميع أجهزة آبل',
    image: 'https://images.unsplash.com/photo-1621768216002-5ac171876625?w=800&q=80',
    color: '#3B82F6'
  }
];

export default function CustomerHomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header Section */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>مرحباً، محمد 👋</Text>
            <View style={styles.locationContainer}>
              <MaterialIcons name="location-on" size={16} color={COLORS.primary} />
              <Text style={styles.location}>الرياض، حي الملقا</Text>
              <MaterialIcons name="keyboard-arrow-down" size={16} color={COLORS.textSecondary} />
            </View>
          </View>
          <TouchableOpacity style={[styles.notificationBtn, SHADOWS.small]}>
            <Ionicons name="notifications-outline" size={24} color={COLORS.text} />
            <View style={styles.badge} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <TouchableOpacity style={[styles.searchContainer, SHADOWS.small]}>
          <Ionicons name="search" size={20} color={COLORS.textSecondary} />
          <Text style={styles.searchPlaceholder}>ابحث عن جهاز، عطل، أو خدمة...</Text>
        </TouchableOpacity>

        {/* Price Calculator Banner */}
        <TouchableOpacity 
          style={[styles.calculatorBanner, SHADOWS.medium]}
          onPress={() => router.push('/calculator')}
        >
          <LinearGradient
            colors={[COLORS.primary, COLORS.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.calculatorGradient}
          >
            <View style={styles.calculatorContent}>
              <Text style={styles.calculatorTitle}>حاسبة الأسعار التقديرية</Text>
              <Text style={styles.calculatorSubtitle}>اعرف تكلفة صيانة جهازك في ثواني</Text>
              <View style={styles.calculatorBtn}>
                <Text style={styles.calculatorBtnText}>احسب الآن</Text>
                <MaterialIcons name="arrow-back" size={16} color={COLORS.primary} />
              </View>
            </View>
            <MaterialCommunityIcons name="calculator-variant" size={80} color="rgba(255,255,255,0.2)" style={styles.calculatorIcon} />
          </LinearGradient>
        </TouchableOpacity>

        {/* Promotions Slider */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.promoContainer}>
          {PROMOTIONS.map((promo) => (
            <TouchableOpacity key={promo.id} style={[styles.promoCard, SHADOWS.medium]}>
              <Image source={{ uri: promo.image }} style={styles.promoImage} />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.8)']}
                style={styles.promoOverlay}
              >
                <View style={styles.promoContent}>
                  <Text style={styles.promoTitle}>{promo.title}</Text>
                  <Text style={styles.promoSubtitle}>{promo.subtitle}</Text>
                  <View style={[styles.promoBtn, { backgroundColor: promo.color }]}>
                    <Text style={styles.promoBtnText}>اطلب الآن</Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Services Grid */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>خدماتنا</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>عرض الكل</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.servicesGrid}>
          {SERVICES.map((service) => (
            <TouchableOpacity 
              key={service.id} 
              style={styles.serviceCard}
              onPress={() => service.id === 'contact' ? router.push('/contact') : router.push('/request')}
            >
              <View style={[styles.serviceIconContainer, { backgroundColor: service.bg }]}>
                <MaterialCommunityIcons name={service.icon as any} size={32} color={service.color} />
              </View>
              <Text style={styles.serviceName}>{service.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Active Request Banner */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>طلباتي النشطة</Text>
        </View>
        
        <TouchableOpacity style={[styles.activeOrderCard, SHADOWS.medium]} onPress={() => router.push('/track/123')}>
          <View style={styles.orderStatusLine}>
            <View style={styles.pulsingDot} />
            <Text style={styles.orderStatusText}>الفني في الطريق إليك</Text>
            <Text style={styles.orderTime}>يصل خلال 15 دقيقة</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.orderContent}>
            <View style={styles.deviceIcon}>
              <MaterialCommunityIcons name="cellphone" size={24} color={COLORS.primary} />
            </View>
            <View style={styles.orderDetails}>
              <Text style={styles.deviceName}>iPhone 13 Pro Max</Text>
              <Text style={styles.issueType}>كسر في الشاشة الأمامية</Text>
            </View>
            <MaterialIcons name="arrow-forward-ios" size={16} color={COLORS.textSecondary} />
          </View>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: SPACING.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.l,
    paddingTop: SPACING.xl,
  },
  greeting: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
    borderWidth: 1,
    borderColor: COLORS.surface,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.l,
    padding: SPACING.m,
    borderRadius: 16,
    marginBottom: SPACING.l,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchPlaceholder: {
    marginLeft: SPACING.s,
    color: COLORS.textSecondary,
    fontSize: 14,
    flex: 1,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  calculatorBanner: {
    marginHorizontal: SPACING.l,
    marginBottom: SPACING.l,
    borderRadius: 20,
  },
  calculatorGradient: {
    borderRadius: 20,
    padding: SPACING.l,
    position: 'relative',
    overflow: 'hidden',
  },
  calculatorContent: {
    zIndex: 1,
  },
  calculatorTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  calculatorSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginBottom: SPACING.m,
  },
  calculatorBtn: {
    backgroundColor: '#FFF',
    paddingHorizontal: SPACING.m,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  calculatorBtnText: {
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  calculatorIcon: {
    position: 'absolute',
    bottom: -10,
    left: -10,
    transform: [{ rotate: '-15deg' }],
  },
  promoContainer: {
    paddingLeft: SPACING.l,
    marginBottom: SPACING.xl,
  },
  promoCard: {
    width: width * 0.8,
    height: 160,
    borderRadius: 20,
    marginRight: SPACING.m,
    overflow: 'hidden',
  },
  promoImage: {
    width: '100%',
    height: '100%',
  },
  promoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%',
    justifyContent: 'flex-end',
    padding: SPACING.l,
  },
  promoContent: {
    alignItems: 'flex-start',
  },
  promoTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  promoSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginBottom: SPACING.m,
  },
  promoBtn: {
    paddingHorizontal: SPACING.m,
    paddingVertical: 6,
    borderRadius: 8,
  },
  promoBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.l,
    marginBottom: SPACING.m,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  seeAll: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.l,
    gap: SPACING.m,
    marginBottom: SPACING.xl,
  },
  serviceCard: {
    width: (width - SPACING.l * 2 - SPACING.m * 2) / 3,
    alignItems: 'center',
    marginBottom: SPACING.s,
  },
  serviceIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.s,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  activeOrderCard: {
    marginHorizontal: SPACING.l,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  orderStatusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.s,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
    marginRight: 8,
  },
  orderStatusText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.success,
    flex: 1,
  },
  orderTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.s,
  },
  orderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.m,
  },
  orderDetails: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  issueType: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
});
