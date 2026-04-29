import React, { useState, useEffect, useRef } from 'react';
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
  SafeAreaView,
  StatusBar,
  Image,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors } from '../constants/theme';
import { validateEmail } from '../utils/validation';
import { getFriendlyError } from '../utils/errorMessages';
import { RTLIonicon } from '../components/RTLIcon';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { login: authLogin } = useAuth();
  const isRTL = language === 'ar';
  const themeColors = getColors(isDark);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start();
  }, []);

  const COLORS = {
    primary: themeColors.primary,
    background: themeColors.background,
    white: '#ffffff',
    text: themeColors.text,
    gray: themeColors.textSecondary,
    lightGray: isDark ? '#1f2937' : '#f3f4f6',
    border: themeColors.border,
  };

  const isFormValid = validateEmail(email.trim()) && password.length >= 6;

  const handleLogin = async () => {
    if (!isFormValid) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'الرجاء إدخال بريد إلكتروني صحيح وكلمة مرور' : 'Please enter a valid email and password'
      );
      return;
    }

    setLoading(true);
    try {
      await authLogin(email.trim(), password);
      setTimeout(() => {
        router.replace('/(customer)');
      }, 500);
    } catch (error: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(error, language));
    } finally {
      setLoading(false);
    }
  };

  const styles = createStyles(COLORS, isRTL);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.greenHeader}>
        <SafeAreaView>
          <View style={styles.headerContent}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={isRTL ? 'رجوع' : 'Back'} 
              style={styles.headerBackButton}
              onPress={() => router.canGoBack() ? router.back() : router.replace('/role-selection')}
            >
              <RTLIonicon name="chevron-back" size={24} color="#fff" />
              <Text style={styles.headerBackText}>{isRTL ? 'رجوع' : 'Back'}</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{isRTL ? 'تسجيل الدخول' : 'Login'}</Text>
            <View style={{ width: 80 }} />
          </View>
        </SafeAreaView>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.logoSection}>
            <View style={styles.logoCircle}>
              <Image 
                source={require('../assets/fixate-logo-main.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brandName}>Fixate</Text>
            <Text style={styles.brandSlogan}>{isRTL ? 'شريكك الموثوق للصيانة' : 'Your Trusted Repair Partner'}</Text>
          </View>

          <View style={styles.toggleContainer}>
            <TouchableOpacity 
              style={[styles.toggleButton, !isLogin && styles.activeToggle]} 
              onPress={() => router.push('/signup')}
            >
              <Text style={[styles.toggleText, !isLogin && styles.activeToggleText]}>
                {isRTL ? 'إنشاء حساب' : 'Sign Up'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.toggleButton, isLogin && styles.activeToggle]} 
              onPress={() => setIsLogin(true)}
            >
              <Text style={[styles.toggleText, isLogin && styles.activeToggleText]}>
                {isRTL ? 'تسجيل الدخول' : 'Login'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons name="email-outline" size={20} color={COLORS.gray} />
              <TextInput
                style={styles.input}
                placeholder={isRTL ? 'البريد الإلكتروني' : 'Email'}
                placeholderTextColor={COLORS.gray}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            <View style={styles.inputContainer}>
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={COLORS.gray}
                />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder={isRTL ? 'كلمة المرور' : 'Password'}
                placeholderTextColor={COLORS.gray}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                textAlign={isRTL ? 'right' : 'left'}
              />
              <MaterialCommunityIcons name="lock-outline" size={20} color={COLORS.gray} />
            </View>

            <View style={styles.altActions}>
              <TouchableOpacity onPress={() => router.push('/login-otp')} accessibilityRole="button">
                <Text style={styles.altActionLink}>{isRTL ? 'الدخول بالجوال' : 'Login by phone'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.forgotPassword}
                onPress={() => router.push('/forgot-password')}
                accessibilityRole="button"
              >
                <Text style={styles.forgotPasswordText}>{isRTL ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.mainButton, (!isFormValid || loading) && styles.mainButtonDisabled]}
              onPress={handleLogin}
              disabled={loading || !isFormValid}
              accessibilityRole="button"
              accessibilityLabel={isRTL ? 'تسجيل الدخول' : 'Login'}
              accessibilityState={{ disabled: loading || !isFormValid }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.mainButtonText}>{isRTL ? 'تسجيل الدخول' : 'Login'}</Text>
              )}
            </TouchableOpacity>

          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (COLORS: any, isRTL: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  greenHeader: { backgroundColor: COLORS.primary, paddingBottom: 10, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  headerContent: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 50 },
  headerBackButton: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  headerBackText: { color: '#fff', fontSize: 14, fontWeight: '600', marginHorizontal: 4 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
  logoSection: { alignItems: 'center', marginBottom: 30 },
  logoCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5, marginBottom: 16, overflow: 'hidden' },
  logoImage: { width: 80, height: 80 },
  brandName: { fontSize: 28, fontWeight: 'bold', color: '#1f2937' },
  brandSlogan: { fontSize: 14, color: COLORS.gray, marginTop: 4 },
  toggleContainer: { flexDirection: isRTL ? 'row-reverse' : 'row', backgroundColor: '#fff', borderRadius: 12, padding: 4, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  toggleButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  activeToggle: { backgroundColor: COLORS.primary },
  toggleText: { fontSize: 16, fontWeight: '600', color: COLORS.gray },
  activeToggleText: { color: '#fff' },
  form: { gap: 16 },
  inputContainer: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, height: 56, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, borderWidth: 1, borderColor: '#f3f4f6' },
  input: { flex: 1, fontSize: 16, color: '#1f2937', marginHorizontal: 12 },
  forgotPassword: {},
  forgotPasswordText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  altActions: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' },
  altActionLink: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  mainButton: { backgroundColor: COLORS.primary, height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 8, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  mainButtonDisabled: { opacity: 0.5, shadowOpacity: 0 },
  mainButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  divider: { alignItems: 'center', marginVertical: 10 },
  dividerText: { fontSize: 14, color: COLORS.gray, fontWeight: '600' },
  guestButton: { flexDirection: isRTL ? 'row-reverse' : 'row', height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, gap: 8 },
  guestButtonText: { color: COLORS.primary, fontSize: 16, fontWeight: 'bold' },
});
