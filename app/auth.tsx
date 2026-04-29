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
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { translations } from '../constants/translations';
import { auth } from '../lib/supabase';
import { RTLMaterialIcon } from '../components/RTLIcon';

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

  const handleAuth = async () => {
    if (!email || !password || (!isLogin && !name)) {
      Alert.alert(
        t.error || 'Error',
        isLogin
          ? (language === 'ar' ? 'الرجاء إدخال البريد الإلكتروني وكلمة المرور' : 'Please enter email and password')
          : (language === 'ar' ? 'الرجاء إدخال جميع الحقول' : 'Please fill all fields')
      );
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        // Login
        await auth.signIn(email, password);
        Alert.alert(
          t.success || 'Success',
          language === 'ar' ? 'تم تسجيل الدخول بنجاح!' : 'Logged in successfully!'
        );
        // Navigate based on user role
        const user = await auth.getCurrentUser();
        const userType = user?.user_metadata?.role || userRole;
        router.replace(userType === 'technician' ? '/(technician)' : '/(customer)');
      } else {
        // Sign up
        await auth.signUp(email, password, name, userRole);
        Alert.alert(
          t.success || 'Success',
          language === 'ar' ? 'تم إنشاء الحساب بنجاح! يرجى التحقق من بريدك الإلكتروني.' : 'Account created! Please check your email.'
        );
        setIsLogin(true);
      }
    } catch (error: any) {
      Alert.alert(
        t.error || 'Error',
        error.message || (language === 'ar' ? 'حدث خطأ. حاول مرة أخرى.' : 'An error occurred. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGuestContinue = () => {
    router.replace('/(customer)');
  };

  const handleGoogleLogin = () => {
    Alert.alert(
      language === 'ar' ? 'تسجيل الدخول بجوجل' : 'Google Login',
      language === 'ar' ? 'هذه الميزة قريباً!' : 'Coming soon!'
    );
  };

  const handleFacebookLogin = () => {
    Alert.alert(
      language === 'ar' ? 'تسجيل الدخول بفيسبوك' : 'Facebook Login',
      language === 'ar' ? 'هذه الميزة قريباً!' : 'Coming soon!'
    );
  };

  const handleAppleLogin = () => {
    Alert.alert(
      language === 'ar' ? 'تسجيل الدخول بأبل' : 'Apple Login',
      language === 'ar' ? 'هذه الميزة قريباً!' : 'Coming soon!'
    );
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

              {/* Phone Input (Technician only) */}
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

              {/* Specialization Input (Technician only) */}
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

              {/* Experience Input (Technician only) */}
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
                  name={showPassword ? "visibility" : "visibility-off"} 
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

            {/* Back Button */}
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <RTLMaterialIcon name="arrow-back" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Social Login (Customer only) */}
          {userRole === 'customer' && (
            <View style={styles.socialContainer}>
              <Text style={styles.socialText}>{language === 'ar' ? 'أو سجل الدخول عبر' : 'Or login with'}</Text>
              <View style={styles.socialButtons}>
                <TouchableOpacity style={[styles.socialButton, SHADOWS.neuFlat]} onPress={handleGoogleLogin}>
                  <FontAwesome5 name="google" size={20} color="#DB4437" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.socialButton, SHADOWS.neuFlat]} onPress={handleFacebookLogin}>
                  <FontAwesome5 name="facebook-f" size={20} color="#4267B2" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.socialButton, SHADOWS.neuFlat]} onPress={handleAppleLogin}>
                  <FontAwesome5 name="apple" size={20} color={isDark ? '#FFF' : '#000'} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Guest Option (Customer only) */}
          {userRole === 'customer' && (
            <TouchableOpacity onPress={handleGuestContinue} style={styles.guestButton}>
              <Text style={styles.guestText}>{language === 'ar' ? 'المتابعة كضيف' : 'Continue as Guest'}</Text>
            </TouchableOpacity>
          )}
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
    backgroundColor: COLORS.background, // Neumorphic pressed state handled by shadow
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
  backButton: {
    alignItems: 'center',
    marginTop: SPACING.md,
    padding: SPACING.sm,
  },
  socialContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  socialText: {
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  socialButtons: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: SPACING.lg,
  },
  socialButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestButton: {
    alignItems: 'center',
  },
  guestText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
