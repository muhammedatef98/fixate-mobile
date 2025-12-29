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
import { validatePassword, validateEmail, validatePhone, getPasswordStrengthColor, getPasswordStrengthText } from '../utils/validation';
import { supabase } from '../lib/supabase';

export default function SignupScreen() {
  const router = useRouter();
  const { isDark, language } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  
  const passwordValidation = validatePassword(password, language);

  const handleSignup = async () => {
    if (!name || !email || !phone || !password) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'الرجاء ملء جميع الحقول' : 'Please fill all fields'
      );
      return;
    }
    
    if (!validateEmail(email)) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'البريد الإلكتروني غير صحيح' : 'Invalid email address'
      );
      return;
    }
    
    if (!validatePhone(phone)) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'رقم الهاتف غير صحيح' : 'Invalid phone number'
      );
      return;
    }
    
    if (!passwordValidation.isValid) {
      Alert.alert(
        isRTL ? 'كلمة مرور ضعيفة' : 'Weak Password',
        passwordValidation.errors.join('\n')
      );
      return;
    }

    try {
      // Sign up with Supabase
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            phone,
            user_type: 'customer',
          },
        },
      });

      if (error) {
        Alert.alert(
          isRTL ? 'خطأ' : 'Error',
          error.message
        );
        return;
      }

      Alert.alert(
        isRTL ? 'نجح' : 'Success',
        isRTL ? 'تم إنشاء الحساب بنجاح! يرجى التحقق من بريدك الإلكتروني.' : 'Account created successfully! Please check your email.',
        [
          {
            text: isRTL ? 'حسناً' : 'OK',
            onPress: () => router.push('/login'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        error.message || (isRTL ? 'حدث خطأ أثناء إنشاء الحساب' : 'An error occurred while creating account')
      );
    }
  };

  const styles = createStyles(isRTL);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Back Button */}
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.push('/role-selection')}
        >
          <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color="#6b7280" />
        </TouchableOpacity>

        <View style={styles.header}>
          <Ionicons name="person-add" size={64} color="#10b981" />
          <Text style={styles.title}>{isRTL ? 'إنشاء حساب جديد' : 'Create Account'}</Text>
          <Text style={styles.subtitle}>{isRTL ? 'انضم إلى Fixate الآن' : 'Join Fixate Now'}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{isRTL ? 'الاسم الكامل' : 'Full Name'}</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person" size={20} color="#6b7280" />
              <TextInput
                style={styles.input}
                placeholder={isRTL ? "محمد أحمد" : "John Doe"}
                value={name}
                onChangeText={setName}
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{isRTL ? 'البريد الإلكتروني' : 'Email'}</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail" size={20} color="#6b7280" />
              <TextInput
                style={styles.input}
                placeholder="example@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{isRTL ? 'رقم الجوال' : 'Phone Number'}</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="call" size={20} color="#6b7280" />
              <TextInput
                style={styles.input}
                placeholder="05xxxxxxxx"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{isRTL ? 'كلمة المرور' : 'Password'}</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed" size={20} color="#6b7280" />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                secureTextEntry={!showPassword}
                textAlign={isRTL ? 'right' : 'left'}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color="#6b7280"
                />
              </TouchableOpacity>
            </View>
            {password.length > 0 && (
              <View style={styles.passwordStrength}>
                <View style={styles.strengthBar}>
                  <View 
                    style={[
                      styles.strengthFill,
                      { 
                        width: passwordValidation.strength === 'weak' ? '33%' : passwordValidation.strength === 'medium' ? '66%' : '100%',
                        backgroundColor: getPasswordStrengthColor(passwordValidation.strength)
                      }
                    ]} 
                  />
                </View>
                <Text style={[styles.strengthText, { color: getPasswordStrengthColor(passwordValidation.strength), textAlign: isRTL ? 'right' : 'left' }]}>
                  {getPasswordStrengthText(passwordValidation.strength, language)}
                </Text>
              </View>
            )}
            {passwordFocused && password.length > 0 && !passwordValidation.isValid && (
              <View style={[styles.passwordHints, isRTL && { borderLeftWidth: 0, borderRightWidth: 3, borderRightColor: '#EF4444' }]}>
                {passwordValidation.errors.map((error, index) => (
                  <Text key={index} style={[styles.hintText, { textAlign: isRTL ? 'right' : 'left' }]}>• {error}</Text>
                ))}
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.signupButton} onPress={handleSignup}>
            <Text style={styles.signupButtonText}>{isRTL ? 'إنشاء حساب' : 'Sign Up'}</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{isRTL ? 'أو' : 'OR'}</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialButtons}>
            <TouchableOpacity style={styles.socialButton} onPress={async () => {
              const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
              if (error) Alert.alert(isRTL ? 'خطأ' : 'Error', error.message);
            }}>
              <Ionicons name="logo-google" size={24} color="#DB4437" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton} onPress={async () => {
              const { error } = await supabase.auth.signInWithOAuth({ provider: 'apple' });
              if (error) Alert.alert(isRTL ? 'خطأ' : 'Error', error.message);
            }}>
              <Ionicons name="logo-apple" size={24} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton} onPress={async () => {
              const { error } = await supabase.auth.signInWithOAuth({ provider: 'facebook' });
              if (error) Alert.alert(isRTL ? 'خطأ' : 'Error', error.message);
            }}>
              <Ionicons name="logo-facebook" size={24} color="#1877F2" />
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{isRTL ? 'لديك حساب بالفعل؟' : 'Already have an account?'}</Text>
            <Link href="/login" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>{isRTL ? 'تسجيل الدخول' : 'Login'}</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (isRTL: boolean) => StyleSheet.create({
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
    textAlign: isRTL ? 'right' : 'left',
  },
  inputContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
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
    flexDirection: isRTL ? 'row-reverse' : 'row',
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    paddingVertical: 8,
    alignSelf: isRTL ? 'flex-end' : 'flex-start',
  },
  passwordStrength: {
    marginTop: 8,
  },
  strengthBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '600',
  },
  passwordHints: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  hintText: {
    fontSize: 12,
    color: '#EF4444',
    marginBottom: 4,
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
