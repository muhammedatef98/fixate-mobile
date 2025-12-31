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
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { language } = useApp();
  const isRTL = language === 'ar';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Pure white theme colors
  const COLORS = {
    primary: '#10b981',
    background: '#ffffff',
    card: '#ffffff',
    text: '#1f2937',
    gray: '#6b7280',
    border: '#e5e7eb',
  };

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

  const styles = createStyles(COLORS, isRTL);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
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
                <Ionicons name="logo-apple" size={24} color="#000" />
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
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any, isRTL: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: isRTL ? undefined : 24,
    right: isRTL ? 24 : undefined,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    // Ensure no border or shadow that creates a "box" look
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.gray,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: isRTL ? 'right' : 'left',
  },
  inputContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: '#f3f4f6', // Very light border
    gap: 12,
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
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: COLORS.gray,
    fontWeight: '600',
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  socialButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
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
