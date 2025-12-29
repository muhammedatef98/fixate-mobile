import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, SafeAreaView, StatusBar, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function RoleSelectionScreen() {
  const router = useRouter();
  const { isDark, language, setLanguage } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 10,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleRoleSelect = (role: 'customer' | 'technician') => {
    // Navigate to appropriate auth page
    if (role === 'technician') {
      router.push('/technician-auth');
    } else {
      router.push(`/auth?role=${role}`);
    }
  };

  const styles = createStyles(COLORS, SHADOWS);

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle={isDark ? "light-content" : "dark-content"} 
        backgroundColor={COLORS.background} 
      />

      <SafeAreaView style={styles.safeArea}>
        <Animated.View 
          style={[
            styles.content, 
            { 
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }] 
            }
          ]}
        >
          {/* Language Switcher */}
          <TouchableOpacity 
            style={styles.languageButton}
            onPress={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
          >
            <MaterialIcons name="language" size={24} color={COLORS.primary} />
            <Text style={styles.languageText}>
              {language === 'ar' ? 'English' : 'عربي'}
            </Text>
          </TouchableOpacity>

          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image 
              source={require('../assets/fixate-logo-main.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          {/* Title */}
          <Text style={styles.title}>Fixate</Text>
          <Text style={styles.subtitle}>
            {language === 'ar' ? 'شريكك الموثوق للصيانة' : 'Your Trusted Repair Partner'}
          </Text>

          {/* Subtitle */}
          <Text style={styles.question}>
            {language === 'ar' ? 'كيف تود استخدام التطبيق؟' : 'How would you like to use the app?'}
          </Text>

          {/* Role Cards */}
          <View style={styles.cardsContainer}>
            {/* Customer Card */}
            <TouchableOpacity
              style={styles.roleCard}
              onPress={() => handleRoleSelect('customer')}
              activeOpacity={0.8}
            >
              <View style={[styles.iconContainer, { backgroundColor: COLORS.primary + '20' }]}>
                <MaterialIcons name="person" size={40} color={COLORS.primary} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.roleTitle}>
                  {language === 'ar' ? 'عميل' : 'Customer'}
                </Text>
                <Text style={styles.roleDescription}>
                  {language === 'ar' ? 'أبحث عن خدمات صيانة لأجهزتي' : 'Looking for repair services'}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={28} color={COLORS.primary} />
            </TouchableOpacity>

            {/* Technician Card */}
            <TouchableOpacity
              style={styles.roleCard}
              onPress={() => handleRoleSelect('technician')}
              activeOpacity={0.8}
            >
              <View style={[styles.iconContainer, { backgroundColor: COLORS.info + '20' }]}>
                <MaterialCommunityIcons name="account-wrench" size={40} color={COLORS.info} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.roleTitle}>
                  {language === 'ar' ? 'فني صيانة' : 'Technician'}
                </Text>
                <Text style={styles.roleDescription}>
                  {language === 'ar' ? 'أقدم خدمات الصيانة وأستقبل الطلبات' : 'Providing repair services'}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={28} color={COLORS.info} />
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <Text style={styles.footer}>
            {language === 'ar' ? 'بالمتابعة، أنت توافق على ' : 'By continuing, you agree to our '}
            <Text style={styles.link}>
              {language === 'ar' ? 'شروط الخدمة' : 'Terms of Service'}
            </Text>
            {language === 'ar' ? ' و ' : ' and '}
            <Text style={styles.link}>
              {language === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}
            </Text>
          </Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (COLORS: any, SHADOWS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  languageButton: {
    position: 'absolute',
    top: SPACING.xl,
    right: SPACING.xl,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
    zIndex: 10,
    ...SHADOWS.small,
  },
  languageText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  safeArea: {
    flex: 1,
  },

  content: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxl,
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: SPACING.lg,
  },
  logoImage: {
    width: 100,
    height: 100,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xxl,
  },
  question: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xl,
    textAlign: 'center',
  },
  cardsContainer: {
    width: '100%',
    gap: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    gap: SPACING.md,
    ...SHADOWS.neuFlat,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  roleDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  footer: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
    lineHeight: 18,
  },
  link: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});
