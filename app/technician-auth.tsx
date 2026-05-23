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
  SafeAreaView,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';
import { RTLIonicon } from '../components/RTLIcon';
import { signUpWithPhoneOrEmail } from '../services/authService';
import { getFriendlyError } from '../utils/errorMessages';
import { getColors } from '../constants/theme';

const { width } = Dimensions.get('window');

export default function TechnicianAuthScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const isRTL = language === 'ar';
  const themeColors = getColors(isDark);
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const COLORS = {
    primary: themeColors.primary,
    background: themeColors.background,
    white: themeColors.card,
    text: themeColors.text,
    gray: themeColors.textSecondary,
    lightGray: isDark ? '#1f2937' : '#f3f4f6',
    border: themeColors.border,
  };

  const handleAuth = async () => {
    if (!email || !password || (!isLogin && !name)) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'الرجاء ملء جميع الحقول' : 'Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        // 1. Sign in with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) throw authError;

        if (authData.user) {
          // Verify role from users table (was incorrectly querying 'profiles' before)
          const { data: profileData } = await supabase
            .from('users')
            .select('role')
            .eq('id', authData.user.id)
            .maybeSingle();

          const userRole =
            (profileData as any)?.role ||
            authData.user.user_metadata?.role ||
            'customer';

          if (userRole !== 'technician') {
            await supabase.auth.signOut();
            Alert.alert(
              isRTL ? 'تنبيه' : 'Access Denied',
              isRTL
                ? 'هذا الحساب غير مسجل كفني. يرجى الدخول من بوابة العملاء.'
                : 'This account is not registered as a technician. Please login from the customer portal.'
            );
            return;
          }

          router.replace('/(technician)');
        }
      } else {
        // Route signup through the auto-confirming Edge Function so we don't
        // depend on Supabase project SMTP being configured.
        await signUpWithPhoneOrEmail({
          email,
          password,
          name,
          phone,
          role: 'technician',
        });

        Alert.alert(
          isRTL ? 'تم بنجاح' : 'Success',
          isRTL ? 'تم إنشاء حسابك. أكمل ملفك الشخصي للموافقة.' : 'Account created. Complete your profile to get approved.'
        );
        router.replace('/technician-onboarding');
      }
    } catch (error: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const styles = createStyles(COLORS, isRTL);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Green Header Bar */}
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
            <Text style={styles.headerTitle}>{isRTL ? 'بوابة الفنيين' : 'Technician Portal'}</Text>
            <View style={{ width: 80 }} />
          </View>
        </SafeAreaView>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <View style={styles.logoCircle}>
              <Image
                source={require('../assets/fixate-logo-main.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brandName}>Fixate</Text>
            <Text style={styles.brandSlogan}>{isRTL ? 'انضم لفريق الفنيين المعتمدين' : 'Join our certified technicians team'}</Text>
          </View>

          {/* Toggle Login/Signup */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity 
              style={[styles.toggleButton, !isLogin && styles.activeToggle]} 
              onPress={() => setIsLogin(false)}
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

          {/* Form Section */}
          <View style={styles.form}>
            {!isLogin && (
              <>
                <View style={styles.inputContainer}>
                  <MaterialCommunityIcons name="account-outline" size={20} color={COLORS.gray} />
                  <TextInput
                    style={styles.input}
                    placeholder={isRTL ? 'الاسم الكامل' : 'Full Name'}
                    placeholderTextColor={COLORS.gray}
                    value={name}
                    onChangeText={setName}
                    textAlign={isRTL ? 'right' : 'left'}
                  />
                </View>
                <View style={styles.inputContainer}>
                  <MaterialCommunityIcons name="phone-outline" size={20} color={COLORS.gray} />
                  <TextInput
                    style={styles.input}
                    placeholder={isRTL ? 'رقم الجوال' : 'Phone Number'}
                    placeholderTextColor={COLORS.gray}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    textAlign={isRTL ? 'right' : 'left'}
                  />
                </View>
                <View style={styles.inputContainer}>
                  <MaterialCommunityIcons name="tools" size={20} color={COLORS.gray} />
                  <TextInput
                    style={styles.input}
                    placeholder={isRTL ? 'التخصص' : 'Specialization'}
                    placeholderTextColor={COLORS.gray}
                    value={specialization}
                    onChangeText={setSpecialization}
                    textAlign={isRTL ? 'right' : 'left'}
                  />
                </View>
              </>
            )}

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

            <TouchableOpacity style={styles.mainButton} onPress={handleAuth} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.mainButtonText}>
                  {isLogin ? (isRTL ? 'تسجيل الدخول' : 'Login') : (isRTL ? 'إنشاء حساب' : 'Sign Up')}
                </Text>
              )}
            </TouchableOpacity>

            {isLogin && (
              <View style={styles.altRow}>
                <TouchableOpacity onPress={() => router.push('/login-otp')} accessibilityRole="button">
                  <Text style={styles.altLink}>{isRTL ? 'الدخول بكود الجوال' : 'Login with phone code'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/forgot-password')} accessibilityRole="button">
                  <Text style={styles.altLink}>{isRTL ? 'نسيت كلمة المرور؟' : 'Forgot password?'}</Text>
                </TouchableOpacity>
              </View>
            )}

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (COLORS: any, isRTL: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  greenHeader: {
    backgroundColor: COLORS.primary,
    paddingBottom: 10,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerContent: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 50,
  },
  headerBackButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  headerBackText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 4,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  logoImage: {
    width: 84,
    height: 84,
  },
  brandName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  brandSlogan: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 4,
  },
  toggleContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeToggle: {
    backgroundColor: COLORS.primary,
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray,
  },
  activeToggleText: {
    color: '#fff',
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    marginHorizontal: 12,
  },
  mainButton: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  mainButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  altRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  altLink: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});
