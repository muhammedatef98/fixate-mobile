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
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../constants/theme';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const { isDark } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('خطأ', 'الرجاء ملء جميع الحقول');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      Alert.alert('خطأ', error.message);
      return;
    }

    Alert.alert('نجح', 'تم تسجيل الدخول بنجاح', [
      {
        text: 'حسناً',
        onPress: () => router.push('/'),
      },
    ]);
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    });

    if (error) {
      Alert.alert('خطأ', error.message);
    }
  };

  const handleAppleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
    });

    if (error) {
      Alert.alert('خطأ', error.message);
    }
  };

  const handleFacebookLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
    });

    if (error) {
      Alert.alert('خطأ', error.message);
    }
  };

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
          <Ionicons name="arrow-back" size={24} color="#6b7280" />
          <Text style={styles.backText}>رجوع</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Ionicons name="log-in" size={64} color="#10b981" />
          <Text style={styles.title}>مرحباً بعودتك!</Text>
          <Text style={styles.subtitle}>سجل دخولك للمتابعة</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>البريد الإلكتروني</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail" size={20} color="#6b7280" />
              <TextInput
                style={styles.input}
                placeholder="example@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>كلمة المرور</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed" size={20} color="#6b7280" />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color="#6b7280"
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginButtonText}>تسجيل الدخول</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>أو</Text>
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
            <Text style={styles.footerText}>ليس لديك حساب؟</Text>
            <Link href="/signup" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>إنشاء حساب</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
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
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  loginButton: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
  },
  footerText: {
    fontSize: 16,
    color: '#6b7280',
  },
  footerLink: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: 'bold',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    paddingVertical: 8,
  },
  backText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#6b7280',
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  socialButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
