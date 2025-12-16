import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import NeuCard from '../../components/NeuCard';
import BottomNav from '../../components/BottomNav';
import { services } from '../../lib/api';
import { ActivityIndicator } from 'react-native';
import { useApp } from '../../contexts/AppContext';

export default function ServicesScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';

  const SERVICES = [
    { 
      id: 'phone', 
      name: 'صيانة الجوالات', 
      nameEn: 'Phone Repairs',
      icon: 'cellphone', 
      color: COLORS.primary, 
      bg: COLORS.primaryLight,
      description: 'إصلاح الشاشات، البطاريات، والمشاكل التقنية',
      descriptionEn: 'Screen, battery, and technical issue repairs',
      iconSet: 'MaterialCommunityIcons'
    },
    { 
      id: 'laptop', 
      name: 'صيانة اللابتوب', 
      nameEn: 'Laptop Repairs',
      icon: 'laptop', 
      color: COLORS.blue, 
      bg: '#EFF6FF',
      description: 'حل مشاكل الأجهزة والبرمجيات',
      descriptionEn: 'Hardware and software problem solving',
      iconSet: 'MaterialCommunityIcons'
    },
    { 
      id: 'tablet', 
      name: 'صيانة التابلت', 
      nameEn: 'Tablet Repairs',
      icon: 'tablet', 
      color: COLORS.purple, 
      bg: '#F5F3FF',
      description: 'إصلاح شامل لجميع أنواع الأجهزة اللوحية',
      descriptionEn: 'Comprehensive repair for all tablet types',
      iconSet: 'MaterialCommunityIcons'
    },
    { 
      id: 'smarthome', 
      name: 'الأجهزة المنزلية الذكية', 
      nameEn: 'Smart Home Devices',
      icon: 'home-automation', 
      color: COLORS.orange, 
      bg: '#FFFBEB',
      description: 'تركيب وصيانة الأجهزة الذكية',
      descriptionEn: 'Smart device installation and maintenance',
      iconSet: 'MaterialCommunityIcons'
    },
    { 
      id: 'watch', 
      name: 'صيانة الساعات الذكية', 
      nameEn: 'Smart Watch Repairs',
      icon: 'watch', 
      color: COLORS.pink, 
      bg: '#FDF2F8',
      description: 'إصلاح وتحديث الساعات الذكية',
      descriptionEn: 'Smart watch repair and updates',
      iconSet: 'MaterialCommunityIcons'
    },
    { 
      id: 'printer', 
      name: 'صيانة الطابعات', 
      nameEn: 'Printer Repairs',
      icon: 'printer', 
      color: '#6366F1', 
      bg: '#EEF2FF',
      description: 'حل مشاكل الطباعة والصيانة الدورية',
      descriptionEn: 'Printing issues and regular maintenance',
      iconSet: 'MaterialCommunityIcons'
    },
  ];
  const [services, setServices] = useState(SERVICES);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setLoading(true);
      const data = await services.getAll();
      // Map Supabase services to app format
      if (data && data.length > 0) {
        const mappedServices = data.map((service: any, index: number) => ({
          id: service.id,
          name: service.name,
          nameEn: service.name,
          icon: service.icon || 'tools',
          color: SERVICES[index % SERVICES.length].color,
          bg: SERVICES[index % SERVICES.length].bg,
          description: service.description || '',
          iconSet: 'MaterialCommunityIcons',
          priceRange: service.price_range,
        }));
        setServices(mappedServices);
      }
    } catch (error) {
      console.log('Using local services data');
    } finally {
      setLoading(false);
    }
  };

  const styles = createStyles(COLORS, SHADOWS);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={20} color={COLORS.text} />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{isRTL ? 'خدماتنا' : 'Our Services'}</Text>
        </View>
        
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        {SERVICES.map((service) => {
          const IconComponent = service.iconSet === 'MaterialIcons' ? MaterialIcons : MaterialCommunityIcons;
          
          return (
            <NeuCard 
              key={service.id} 
              style={styles.serviceCard}
              onPress={() => router.push('/request')}
            >
              <View style={[styles.iconContainer, { backgroundColor: service.bg }]}>
                <IconComponent name={service.icon as any} size={40} color={service.color} />
              </View>
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceName}>{isRTL ? service.name : service.nameEn}</Text>
                <Text style={styles.serviceDescription}>{isRTL ? service.description : service.descriptionEn}</Text>
              </View>
              <MaterialIcons name="arrow-forward-ios" size={20} color={COLORS.textSecondary} />
            </NeuCard>
          );
        })}

        {/* Contact Support Card */}
        <NeuCard 
          style={styles.supportCard}
          onPress={() => router.push('/contact')}
        >
          <View style={styles.supportContent}>
            <View style={styles.supportIconContainer}>
              <MaterialIcons name="support-agent" size={32} color={COLORS.primary} />
            </View>
            <View style={styles.supportText}>
              <Text style={styles.supportTitle}>{isRTL ? 'تحتاج مساعدة؟' : 'Need Help?'}</Text>
              <Text style={styles.supportSubtitle}>{isRTL ? 'تواصل مع فريق الدعم' : 'Contact support team'}</Text>
            </View>
          </View>
          <MaterialIcons name="arrow-forward-ios" size={20} color={COLORS.primary} />
        </NeuCard>

        {/* Bottom Spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNav />
    </SafeAreaView>
  );
}

function createStyles(COLORS: any, SHADOWS: any) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.neuFlat,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: BORDER_RADIUS.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  serviceInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 2,
  },
  serviceNameAr: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    marginTop: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  supportContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  supportIconContainer: {
    width: 60,
    height: 60,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  supportText: {
    flex: 1,
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  supportTitleAr: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  supportSubtitle: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 4,
  },
});
}
