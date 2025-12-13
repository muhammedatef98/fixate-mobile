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
  ScrollView,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../constants/theme';

export default function SignupScreen() {
  const router = useRouter();
  const { isDark } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSignup = () => {
    if (!name || !email || !phone || !password) {
      Alert.alert('خطأ', 'الرجاء ملء جميع الحقول');
      return;
    }

    Alert.alert('نجح', 'تم إنشاء الحساب بنجاح', [
      {
        text: 'حسناً',
        onPress: () => router.push('/'),
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Ionicons name="person-add" size={64} color="#10b981" />
          <Text style={styles.title}>إنشاء حساب جديد</Text>
          <Text style={styles.subtitle}>انضم إلى Fixate الآن</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>الاسم الكامل</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person" size={20} color="#6b7280" />
              <TextInput
                style={styles.input}
                placeholder="محمد أحمد"
                value={name}
                onChangeText={setName}
              />
            </View>
          </View>

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
            <Text style={styles.label}>رقم الجوال</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="call" size={20} color="#6b7280" />
              <TextInput
                style={styles.input}
                placeholder="05xxxxxxxx"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
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

          <TouchableOpacity style={styles.signupButton} onPress={handleSignup}>
            <Text style={styles.signupButtonText}>إنشاء حساب</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>لديك حساب بالفعل؟</Text>
            <Link href="/login" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>تسجيل الدخول</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  form: {
    gap: 16,
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
  signupButton: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  signupButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
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
});
