import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../constants/theme';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { isDark, language } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'الرجاء ملء جميع الحقول' : 'Please fill all fields');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', error.message);
      return;
    }

    Alert.alert(isRTL ? 'نجح' : 'Success', isRTL ? 'تم تسجيل الدخول بنجاح' : 'Logged in successfully', [
      {
        text: isRTL ? 'حسناً' : 'OK',
        onPress: () => router.push('/'),
      },
    ]);
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    });

    if (error) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', error.message);
    }
  };

  const handleAppleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
    });

    if (error) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', error.message);
    }
  };

  const handleFacebookLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
    });

    if (error) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', error.message);
    }
  };

  const styles = createStyles(COLORS, SHADOWS, isRTL);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Back Button */}
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.push('/role-selection')}
        >
          <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="log-in" size={48} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>{isRTL ? 'مرحباً بعودتك!' : 'Welcome Back!'}</Text>
          <Text style={styles.subtitle}>{isRTL ? 'سجل دخولك للمتابعة' : 'Sign in to continue'}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{isRTL ? 'البريد الإلكتروني' : 'Email'}</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={COLORS.gray} />
              <TextInput
                style={styles.input}
                placeholder="example@email.com"
                placeholderTextColor={COLORS.gray}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{isRTL ? 'كلمة المرور' : 'Password'}</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.gray} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={COLORS.gray}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                textAlign={isRTL ? 'right' : 'left'}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={COLORS.gray}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>
              {isRTL ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginButtonText}>{isRTL ? 'تسجيل الدخول' : 'Login'}</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{isRTL ? 'أو' : 'OR'}</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialButtons}>
            <TouchableOpacity style={styles.socialButton} onPress={handleGoogleLogin}>
              <Ionicons name="logo-google" size={24} color="#DB4437" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton} onPress={handleAppleLogin}>
              <Ionicons name="logo-apple" size={24} color={isDark ? '#fff' : '#000'} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton} onPress={handleFacebookLogin}>
              <Ionicons name="logo-facebook" size={24} color="#1877F2" />
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{isRTL ? 'ليس لديك حساب؟' : "Don't have an account?"}</Text>
            <Link href="/signup" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>{isRTL ? 'إنشاء حساب' : 'Sign Up'}</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (COLORS: any, SHADOWS: any, isRTL: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: SPACING.xl,
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 40 : 60,
    left: isRTL ? undefined : SPACING.lg,
    right: isRTL ? SPACING.lg : undefined,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    ...SHADOWS.sm,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary + '15', // 15% opacity
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.gray,
  },
  form: {
    gap: SPACING.lg,
  },
  inputGroup: {
    gap: SPACING.xs,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: isRTL ? 'right' : 'left',
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    height: 56,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
    ...SHADOWS.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    height: '100%',
  },
  forgotPassword: {
    alignItems: isRTL ? 'flex-start' : 'flex-end',
  },
  forgotPasswordText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.sm,
    ...SHADOWS.md,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    marginHorizontal: SPACING.md,
    fontSize: 14,
    color: COLORS.gray,
    fontWeight: '600',
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.lg,
  },
  socialButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  footer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.xl,
  },
  footerText: {
    fontSize: 16,
    color: COLORS.gray,
  },
  footerLink: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
});
