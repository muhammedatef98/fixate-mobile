import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, StatusBar, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { RTLMaterialIcon } from '../components/RTLIcon';
import { logger } from '../utils/logger';
import { supabase } from '../services/supabaseClient';

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

  // Multi-role: one account can hold several roles. For a logged-in user we
  // surface where they stand in each provider role (approved / under review /
  // not registered) so this screen doubles as the account's role hub.
  const [roleStatus, setRoleStatus] = useState<{
    technician: string | null;
    courier: string | null;
  } | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setRoleStatus(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [tech, cour] = await Promise.all([
          supabase.from('technicians').select('verification_status').eq('user_id', user.id).maybeSingle(),
          supabase.from('couriers').select('verification_status').eq('user_id', user.id).maybeSingle(),
        ]);
        if (cancelled) return;
        setRoleStatus({
          technician: (tech.data as any)?.verification_status ?? null,
          courier: (cour.data as any)?.verification_status ?? null,
        });
      } catch (e) {
        logger.warn('role-selection: role status lookup failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Status → chip copy/color. null = no profile yet ("apply now").
  const providerChip = (status: string | null) => {
    if (status === 'approved' || status === 'verified') {
      return { text: language === 'ar' ? 'معتمد ✓' : 'Approved ✓', color: '#10b981' };
    }
    if (status === 'pending') {
      return { text: language === 'ar' ? 'قيد المراجعة' : 'Under review', color: '#f59e0b' };
    }
    if (status === 'changes_requested') {
      return { text: language === 'ar' ? 'مطلوب تعديلات' : 'Changes requested', color: '#f59e0b' };
    }
    if (status === 'rejected') {
      return { text: language === 'ar' ? 'مرفوض' : 'Rejected', color: '#ef4444' };
    }
    return { text: language === 'ar' ? 'سجّل الآن' : 'Apply now', color: COLORS.textSecondary };
  };

  const RoleChip = ({ status }: { status: string | null }) => {
    if (!isLoggedIn || !roleStatus) return null;
    const chip = providerChip(status);
    return (
      <View
        style={{
          alignSelf: isRTL ? 'flex-end' : 'flex-start',
          backgroundColor: chip.color + '18',
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 8,
          marginTop: 6,
        }}
      >
        <Text style={{ color: chip.color, fontSize: 11.5, fontWeight: '800' }}>{chip.text}</Text>
      </View>
    );
  };

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

  const handleRoleSelect = (role: 'customer' | 'technician' | 'courier') => {
    // The (technician) layout itself gates access — no row in `technicians`
    // means the layout shows the "Start registration" screen and routes the
    // user into onboarding. So even when isLoggedIn, jumping straight in is
    // safe: an unverified or unregistered technician is funneled to the
    // right place rather than seeing the dashboard.
    //
    // Tear down any prior navigation frames before routing. Without this,
    // a technician who switches to customer can leave (technician) layout
    // frames buried in the stack, and a "back" gesture (or some routers'
    // state restoration) can resurface them.
    //
    // We only dispatch dismissAll when there's actually something to
    // dismiss. In newer expo-router versions calling it on an empty stack
    // triggers a POP_TO_TOP action that the root navigator can't handle,
    // logging "The action 'POP_TO_TOP' was not handled by any navigator"
    // in dev. router.replace below already enforces a clean root anyway.
    try {
      if (router.canGoBack()) (router as any).dismissAll?.();
    } catch (e) {
      // Non-critical: some expo-router versions reject dismissAll on an empty
      // stack. router.replace below still enforces a clean root either way.
      logger.debug('role-selection dismissAll skipped', e);
    }

    if (isLoggedIn) {
      // Each group layout gates itself (technician/courier verification), so
      // jumping straight in is safe for any role.
      const target =
        role === 'technician' ? '/(technician)' : role === 'courier' ? '/(courier)' : '/(customer)';
      router.replace(target as any);
      return;
    }
    if (role === 'technician') {
      router.replace('/technician-auth');
    } else if (role === 'courier') {
      router.replace('/courier-auth' as any);
    } else {
      router.replace('/login-otp');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (e) {
      // Sign-out is best-effort here; we still return the user to a clean
      // start. Surface the failure in logs rather than swallowing it silently.
      logger.warn('role-selection sign-out failed', e);
    }
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
        {/* Scrollable since the portal now offers three roles — on small
            screens (SE-class) the third card + footer must stay reachable. */}
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
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

          {/* Logo — swap to the dark-mode asset when isDark so the brand
              mark reads correctly on both themes. */}
          <View style={styles.logoContainer}>
            <Image
              source={
                isDark
                  ? require('../assets/fixate-logo-dark.png')
                  : require('../assets/fixate-logo-main.png')
              }
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          {/* Title — no tagline underneath: the screen reads logo → title →
              role question, so the extra sentence was removed for balance. */}
          <Text style={styles.title}>Fixate</Text>

          {/* Subtitle */}
          <Text style={styles.question}>
            {isLoggedIn
              ? (language === 'ar' ? 'اختر القسم الذي تريد الدخول إليه' : 'Choose which side to enter')
              : (language === 'ar' ? 'كيف تود استخدام التطبيق؟' : 'How would you like to use the app?')}
          </Text>

          {isLoggedIn && (
            <TouchableOpacity
              onPress={handleLogout}
              style={{ alignSelf: 'center', marginBottom: 12 }}
              accessibilityRole="button"
            >
              <Text style={{ color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' }}>
                {language === 'ar' ? 'ليس أنت؟ تسجيل الخروج' : 'Not you? Sign out'}
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

            {/* Technician & Courier portal — providers side of the app. */}
            <Text style={styles.portalLabel}>
              {language === 'ar' ? 'بوابة الفنيين والمناديب' : 'Technician & Courier Portal'}
            </Text>

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
                  {language === 'ar' ? 'أقدم عروض أسعار وأنفذ الإصلاحات' : 'Quote on requests & do the repairs'}
                </Text>
                <RoleChip status={roleStatus?.technician ?? null} />
              </View>
              <RTLMaterialIcon name="chevron-right"
                size={28}
                color={COLORS.info}
              />
            </TouchableOpacity>

            {/* Courier Card — a distinct first-class role, not a technician
                subtype: couriers move devices between customers and
                technicians on pickup&delivery orders. */}
            <TouchableOpacity
              style={[styles.roleCard, SHADOWS.neuFlat]}
              onPress={() => handleRoleSelect('courier')}
              activeOpacity={0.8}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#f59e0b20' }]}>
                <MaterialCommunityIcons name="moped" size={40} color="#f59e0b" />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.roleTitle}>
                  {language === 'ar' ? 'مندوب توصيل' : 'Courier'}
                </Text>
                <Text style={styles.roleDescription}>
                  {language === 'ar' ? 'أوصل الأجهزة بين العملاء والفنيين' : 'Deliver devices between customers & technicians'}
                </Text>
                <RoleChip status={roleStatus?.courier ?? null} />
              </View>
              <RTLMaterialIcon name="chevron-right"
                size={28}
                color="#f59e0b"
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
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (COLORS: any, SHADOWS: any, isRTL: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    // Sits below the absolutely-positioned language pill, so it needs its own
    // top offset to clear it rather than crowding the top edge.
    marginTop: SPACING.l,
    // The 510x380 asset letterboxes inside the square 120x120 box, leaving ~15px
    // of transparent space under the mark. Pull the wordmark back up over it.
    marginBottom: -14,
  },
  logoImage: {
    width: 120,
    height: 120,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xl,
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
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  portalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textAlign: isRTL ? 'right' : 'left',
    marginTop: SPACING.xs,
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
