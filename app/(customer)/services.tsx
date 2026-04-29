import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, StatusBar, Animated, Dimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import BottomNav from '../../components/BottomNav';
import { RTLIonicon } from '../../components/RTLIcon';

const { width } = Dimensions.get('window');

const SERVICES = [
  { 
    id: 'phone', 
    nameAr: 'صيانة الجوالات', 
    nameEn: 'Phone Repairs',
    icon: 'cellphone', 
    color: '#10b981', 
    descriptionAr: 'إصلاح الشاشات، البطاريات، والمشاكل التقنية',
    descriptionEn: 'Screen, battery, and technical issue repairs',
  },
  { 
    id: 'laptop', 
    nameAr: 'صيانة اللابتوب', 
    nameEn: 'Laptop Repairs',
    icon: 'laptop', 
    color: '#3b82f6', 
    descriptionAr: 'حل مشاكل الأجهزة والبرمجيات والترقية',
    descriptionEn: 'Hardware, software, and upgrade solutions',
  },
  { 
    id: 'tablet', 
    nameAr: 'صيانة التابلت', 
    nameEn: 'Tablet Repairs',
    icon: 'tablet', 
    color: '#8b5cf6', 
    descriptionAr: 'إصلاح شامل لجميع أنواع الأجهزة اللوحية',
    descriptionEn: 'Comprehensive repair for all tablet types',
  },
  { 
    id: 'watch', 
    nameAr: 'صيانة الساعات الذكية', 
    nameEn: 'Smart Watch Repairs',
    icon: 'watch', 
    color: '#f59e0b', 
    descriptionAr: 'إصلاح وتحديث الساعات الذكية والحساسات',
    descriptionEn: 'Smart watch repair, updates, and sensors',
  },
  { 
    id: 'printer', 
    nameAr: 'صيانة الطابعات', 
    nameEn: 'Printer Repairs',
    icon: 'printer', 
    color: '#6366f1', 
    descriptionAr: 'حل مشاكل الطباعة والصيانة الدورية',
    descriptionEn: 'Printing issues and regular maintenance',
  },
  { 
    id: 'smarthome', 
    nameAr: 'الأجهزة المنزلية', 
    nameEn: 'Home Appliances',
    icon: 'home-automation', 
    color: '#ec4899', 
    descriptionAr: 'تركيب وصيانة الأجهزة الذكية والمنزلية',
    descriptionEn: 'Smart and home device installation',
  },
];

export default function ServicesScreen() {
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
      
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={isRTL ? 'رجوع' : 'Back'} onPress={() => router.back()} style={styles.backButton}>
          <RTLIonicon name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isRTL ? 'خدماتنا' : 'Our Services'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <Text style={styles.sectionSubtitle}>
            {isRTL ? 'نقدم حلول صيانة متكاملة لكافة أجهزتك' : 'We provide complete repair solutions for all your devices'}
          </Text>

          <View style={styles.servicesGrid}>
            {SERVICES.map((service) => (
              <TouchableOpacity 
                key={service.id} 
                style={styles.serviceCard}
                onPress={() => router.push('/request')}
              >
                <View style={[styles.iconContainer, { backgroundColor: service.color + '15' }]}>
                  <MaterialCommunityIcons name={service.icon as any} size={32} color={service.color} />
                </View>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>{isRTL ? service.nameAr : service.nameEn}</Text>
                  <Text style={styles.serviceDescription} numberOfLines={2}>
                    {isRTL ? service.descriptionAr : service.descriptionEn}
                  </Text>
                </View>
                <RTLIonicon name="chevron-forward" size={20} color={COLORS.border} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Help Card */}
          <TouchableOpacity style={styles.helpCard}>
            <LinearGradient
              colors={[COLORS.primary, '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.helpGradient}
            >
              <View style={styles.helpInfo}>
                <Text style={styles.helpTitle}>{isRTL ? 'لم تجد ما تبحث عنه؟' : 'Didn\'t find what you need?'}</Text>
                <Text style={styles.helpSubtitle}>{isRTL ? 'تواصل معنا مباشرة للمساعدة' : 'Contact us directly for help'}</Text>
              </View>
              <View style={styles.helpButton}>
                <Ionicons name="chatbubble-ellipses" size={24} color={COLORS.primary} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNav />
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
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  scrollContent: { padding: 16 },
  sectionSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 24, textAlign: isRTL ? 'right' : 'left' },
  servicesGrid: { gap: 12 },
  serviceCard: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: { width: 60, height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  serviceInfo: { flex: 1, marginHorizontal: 16, alignItems: isRTL ? 'flex-end' : 'flex-start' },
  serviceName: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  serviceDescription: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, textAlign: isRTL ? 'right' : 'left' },
  helpCard: { marginTop: 24, borderRadius: 20, overflow: 'hidden', elevation: 4, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  helpGradient: { flexDirection: isRTL ? 'row-reverse' : 'row', padding: 20, alignItems: 'center' },
  helpInfo: { flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' },
  helpTitle: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
  helpSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 },
  helpButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.white, justifyContent: 'center', alignItems: 'center' },
});
