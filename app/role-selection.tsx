import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, SafeAreaView, StatusBar, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { RTLMaterialIcon } from '../components/RTLIcon';

const { width } = Dimensions.get('window');

export default function RoleSelectionScreen() {
  const router = useRouter();
  const { isDark, language, setLanguage } = useApp();
  const { user, signOut } = useAuth();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';
  const isLoggedIn = !!user;
  
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
    // The (technician) layout itself gates access — no row in `technicians`
    // means the layout shows the "Start registration" screen and routes the
    // user into onboarding. So even when isLoggedIn, jumping straight in is
    // safe: an unverified or unregistered technician is funneled to the
    // right place rather than seeing the dashboard.
    if (isLoggedIn) {
      router.replace(role === 'technician' ? '/(technician)' : '/(customer)');
      return;
    }
    if (role === 'technician') {
      router.replace('/technician-auth');
    } else {
      // Customers use phone-only OTP — no email/password option.
      router.replace('/login-otp');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch {}
    router.replace('/role-selection');
  };

  const styles = createStyles(COLORS, SHADOWS, isRTL);

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
            style={[styles.languageButton, SHADOWS.small]}
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
            {isLoggedIn
              ? (language === 'ar' ? 'اختر القسم الذي تريد الدخول إليه' : 'Choose which side to enter')
              : (language === 'ar' ? 'كيف تود استخدام التطبيق؟' : 'How would you like to use the app?')}
          </Text>

          {isLoggedIn && (
            <TouchableOpacity onPress={handleLogout} style={{ alignSelf: 'center', marginBottom: 12 }}>
              <Text style={{ color: COLORS.primary, fontSize: 14, fontWeight: '600' }}>
                {language === 'ar' ? 'تسجيل الخروج والعودة للبداية' : 'Sign out and start over'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Role Cards */}
          <View style={styles.cardsContainer}>
            {/* Customer Card */}
            <TouchableOpacity
              style={[styles.roleCard, SHADOWS.neuFlat]}
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
              <RTLMaterialIcon name="chevron-right" 
                size={28} 
                color={COLORS.primary} 
              />
            </TouchableOpacity>

            {/* Technician Card */}
            <TouchableOpacity
              style={[styles.roleCard, SHADOWS.neuFlat]}
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
              <RTLMaterialIcon name="chevron-right" 
                size={28} 
                color={COLORS.info} 
              />
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <Text style={styles.footer}>
            {language === 'ar' ? 'بالمتابعة، أنت توافق على ' : 'By continuing, you agree to our '}
            <Text style={styles.link} onPress={() => router.push('/terms')}>
              {language === 'ar' ? 'شروط الخدمة' : 'Terms of Service'}
            </Text>
            {language === 'ar' ? ' و ' : ' and '}
            <Text style={styles.link} onPress={() => router.push('/privacy')}>
              {language === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}
            </Text>
          </Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (COLORS: any, SHADOWS: any, isRTL: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  languageButton: {
    position: 'absolute',
    top: SPACING.xl,
    right: isRTL ? undefined : SPACING.xl,
    left: isRTL ? SPACING.xl : undefined,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
    zIndex: 10,
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
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    gap: SPACING.md,
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
    alignItems: isRTL ? 'flex-end' : 'flex-start',
  },
  roleTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
    textAlign: isRTL ? 'right' : 'left',
  },
  roleDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    textAlign: isRTL ? 'right' : 'left',
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
