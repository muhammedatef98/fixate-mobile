import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { translations } from '../constants/translations';
import { auth } from '../lib/supabase';
import { RTLMaterialIcon } from '../components/RTLIcon';
import { getFriendlyError } from '../utils/errorMessages';
import { signInWithGoogle, isGoogleSignInAvailable } from '../services/googleAuthService';

export default function AuthScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const userRole = (role as 'customer' | 'technician') || 'customer';
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const t = translations[language];
  const isRTL = language === 'ar';

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [experience, setExperience] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password || (!isLogin && !name)) {
      Alert.alert(
        (t as any).error || 'Error',
        isLogin
          ? (language === 'ar' ? 'الرجاء إدخال البريد الإلكتروني وكلمة المرور' : 'Please enter email and password')
          : (language === 'ar' ? 'الرجاء إدخال جميع الحقول' : 'Please fill all fields')
      );
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await auth.signIn(email, password);
        Alert.alert(
          (t as any).success || 'Success',
          language === 'ar' ? 'تم تسجيل الدخول بنجاح!' : 'Logged in successfully!'
        );
        const user = await auth.getCurrentUser();
        const userType = user?.user_metadata?.role || userRole;
        router.replace(userType === 'technician' ? '/(technician)' : '/(customer)');
      } else {
        await auth.signUp(email, password, name, userRole);
        Alert.alert(
          (t as any).success || 'Success',
          language === 'ar' ? 'تم إنشاء الحساب بنجاح! يرجى التحقق من بريدك الإلكتروني.' : 'Account created! Please check your email.'
        );
        setIsLogin(true);
      }
    } catch (error: any) {
      Alert.alert(
        (t as any).error || 'Error',
        error.message || (language === 'ar' ? 'حدث خطأ. حاول مرة أخرى.' : 'An error occurred. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      // AuthContext will pick up the new Supabase session and _layout.tsx
      // routing logic will redirect to the correct screen automatically.
    } catch (error: any) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar'
          ? 'فشل تسجيل الدخول بـ Google. حاول مرة أخرى.'
          : 'Google sign-in failed. Please try again.'
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const styles = createStyles(COLORS, SHADOWS, isRTL);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={[styles.logoCircle, SHADOWS.neuFlat]}>
              <Image 
                source={require('../assets/logo.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.appName}>{t.appName}</Text>
            <Text style={styles.appTagline}>{t.appTagline}</Text>
          </View>

          {/* Auth Form */}
          <View style={styles.formContainer}>
            {/* Toggle Buttons */}
            <View style={[styles.toggleContainer, SHADOWS.neuFlat]}>
              <TouchableOpacity
                style={[styles.toggleButton, isLogin && styles.toggleButtonActive, isLogin && SHADOWS.neuPressed]}
                onPress={() => setIsLogin(true)}
              >
                <Text style={[styles.toggleText, isLogin && styles.toggleTextActive]}>
                  {language === 'ar' ? 'تسجيل الدخول' : 'Login'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, !isLogin && styles.toggleButtonActive]}
                onPress={() => setIsLogin(false)}
              >
                <Text style={[styles.toggleText, !isLogin && styles.toggleTextActive]}>
                  {language === 'ar' ? 'إنشاء حساب' : 'Sign Up'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Name Input (Sign Up only) */}
            {!isLogin && (
              <>
              <View style={[styles.inputContainer, SHADOWS.neuFlat]}>
                <MaterialIcons name="person" size={20} color={COLORS.textSecondary} />
                <TextInput
                  style={styles.input}
                  placeholder={language === 'ar' ? 'الاسم الكامل' : 'Full Name'}
                  placeholderTextColor={COLORS.textLight}
                  value={name}
                  onChangeText={setName}
                  textAlign={isRTL ? 'right' : 'left'}
                />
              </View>

              {userRole === 'technician' && (
                <View style={[styles.inputContainer, SHADOWS.neuFlat]}>
                  <MaterialIcons name="phone" size={20} color={COLORS.textSecondary} />
                  <TextInput
                    style={styles.input}
                    placeholder={language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
                    placeholderTextColor={COLORS.textLight}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    textAlign={isRTL ? 'right' : 'left'}
                  />
                </View>
              )}

              {userRole === 'technician' && (
                <View style={[styles.inputContainer, SHADOWS.neuFlat]}>
                  <MaterialIcons name="build" size={20} color={COLORS.textSecondary} />
                  <TextInput
                    style={styles.input}
                    placeholder={language === 'ar' ? 'التخصص (مثال: صيانة موبايلات)' : 'Specialization'}
                    placeholderTextColor={COLORS.textLight}
                    value={specialization}
                    onChangeText={setSpecialization}
                    textAlign={isRTL ? 'right' : 'left'}
                  />
                </View>
              )}

              {userRole === 'technician' && (
                <View style={[styles.inputContainer, SHADOWS.neuFlat]}>
                  <MaterialIcons name="work" size={20} color={COLORS.textSecondary} />
                  <TextInput
                    style={styles.input}
                    placeholder={language === 'ar' ? 'سنوات الخبرة' : 'Years of Experience'}
                    placeholderTextColor={COLORS.textLight}
                    value={experience}
                    onChangeText={setExperience}
                    keyboardType="numeric"
                    textAlign={isRTL ? 'right' : 'left'}
                  />
                </View>
              )}
              </>
            )}

            {/* Email Input */}
            <View style={[styles.inputContainer, SHADOWS.neuInset]}>
              <MaterialIcons name="email" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder={language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                placeholderTextColor={COLORS.textLight}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            {/* Password Input */}
            <View style={[styles.inputContainer, SHADOWS.neuInset]}>
              <MaterialIcons name="lock" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder={language === 'ar' ? 'كلمة المرور' : 'Password'}
                placeholderTextColor={COLORS.textLight}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                textAlign={isRTL ? 'right' : 'left'}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <MaterialIcons 
                  name={showPassword ? 'visibility' : 'visibility-off'} 
                  size={20} 
                  color={COLORS.textSecondary} 
                />
              </TouchableOpacity>
            </View>

            {/* Action Button */}
            <TouchableOpacity
              style={[styles.actionButton, SHADOWS.neuFlat]}
              onPress={handleAuth}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.actionButtonText}>
                  {isLogin 
                    ? (language === 'ar' ? 'تسجيل الدخول' : 'Login')
                    : (language === 'ar' ? 'إنشاء حساب' : 'Sign Up')
                  }
                </Text>
              )}
            </TouchableOpacity>

            {/* Google Sign-In — only shown when the native module is present
                in this binary (a dev client / store build compiled with
                @react-native-google-signin). Hidden in Expo Go or older builds
                so users never tap a button that can't work. */}
            {isGoogleSignInAvailable() && (
              <>
                {/* Divider */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>
                    {language === 'ar' ? 'أو' : 'OR'}
                  </Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Google Sign-In Button */}
                <TouchableOpacity
                  style={[styles.googleButton, SHADOWS.neuFlat]}
                  onPress={handleGoogleSignIn}
                  disabled={googleLoading}
                  accessibilityLabel={language === 'ar' ? 'تسجيل الدخول بـ Google' : 'Sign in with Google'}
                >
                  {googleLoading ? (
                    <ActivityIndicator color={COLORS.text} />
                  ) : (
                    <>
                      <View style={styles.googleIconContainer}>
                        {/* Google G icon via SVG path colours */}
                        <Text style={styles.googleIconText}>G</Text>
                      </View>
                      <Text style={styles.googleButtonText}>
                        {language === 'ar' ? 'المتابعة بـ Google' : 'Continue with Google'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* Back Button */}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <RTLMaterialIcon name="arrow-back" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any, SHADOWS: any, isRTL: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.lg,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  logoImage: {
    width: 60,
    height: 60,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  appTagline: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  formContainer: {
    width: '100%',
    marginBottom: SPACING.xl,
  },
  toggleContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: 4,
    marginBottom: SPACING.lg,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.background,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  toggleTextActive: {
    color: COLORS.primary,
  },
  inputContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    height: 50,
  },
  input: {
    flex: 1,
    marginHorizontal: SPACING.sm,
    color: COLORS.text,
    fontSize: 16,
  },
  actionButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border ?? COLORS.textLight,
    opacity: 0.4,
  },
  dividerText: {
    marginHorizontal: SPACING.sm,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  googleButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.border ?? '#E0E0E0',
    gap: SPACING.sm,
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  googleIconText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4285F4',
    lineHeight: 16,
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  backButton: {
    alignItems: 'center',
    marginTop: SPACING.md,
    padding: SPACING.sm,
  },
});
