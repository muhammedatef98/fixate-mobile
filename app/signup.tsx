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

  const styles = createStyles(COLORS, SHADOWS, isRTL);

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
          <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="person-add" size={48} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>{isRTL ? 'إنشاء حساب جديد' : 'Create Account'}</Text>
          <Text style={styles.subtitle}>{isRTL ? 'انضم إلى Fixate الآن' : 'Join Fixate Now'}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{isRTL ? 'الاسم الكامل' : 'Full Name'}</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={COLORS.gray} />
              <TextInput
                style={styles.input}
                placeholder={isRTL ? "محمد أحمد" : "John Doe"}
                placeholderTextColor={COLORS.gray}
                value={name}
                onChangeText={setName}
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>
          </View>

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
            <Text style={styles.label}>{isRTL ? 'رقم الجوال' : 'Phone Number'}</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={20} color={COLORS.gray} />
              <TextInput
                style={styles.input}
                placeholder="05xxxxxxxx"
                placeholderTextColor={COLORS.gray}
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
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.gray} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={COLORS.gray}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
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
              <Ionicons name="logo-apple" size={24} color={isDark ? '#fff' : '#000'} />
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

const createStyles = (COLORS: any, SHADOWS: any, isRTL: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.xl,
    paddingTop: Platform.OS === 'android' ? 40 : 60,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    alignSelf: isRTL ? 'flex-end' : 'flex-start',
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
    fontSize: 28,
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
  signupButton: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.sm,
    ...SHADOWS.md,
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
    gap: SPACING.xs,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
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
  passwordStrength: {
    marginTop: 8,
  },
  strengthBar: {
    height: 4,
    backgroundColor: COLORS.border,
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
});
