import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { supabase } from '../services/supabaseClient';
import { validateEmail, validatePassword } from '../utils/validation';
import { getFriendlyError } from '../utils/errorMessages';
import { tapMedium, success } from '../utils/haptics';

type Step = 'email' | 'otp' | 'newPassword';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const startTimer = () => {
    setResendIn(60);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setResendIn((s) => {
        if (s <= 1 && intervalRef.current) {
          clearInterval(intervalRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const sendCode = async () => {
    if (!validateEmail(email.trim())) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'البريد الإلكتروني غير صحيح' : 'Invalid email');
      return;
    }
    setLoading(true);
    try {
      // Use Supabase Auth's built-in email OTP. Delivered via Supabase SMTP,
      // so this no longer depends on the Resend sandbox-restricted sender
      // that was returning 502 from the send-otp edge function.
      // `shouldCreateUser: false` keeps "reset" semantics — never creates a
      // new account from a forgot-password attempt.
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      tapMedium();
      setStep('otp');
      startTimer();
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (code.length !== 6) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'الكود يجب أن يكون 6 أرقام' : 'Code must be 6 digits');
      return;
    }
    setLoading(true);
    try {
      // Verifying the email OTP establishes a real Supabase session, which
      // is required for the subsequent supabase.auth.updateUser() call.
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code,
        type: 'email',
      });
      if (error) throw error;
      tapMedium();
      setStep('newPassword');
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    } finally {
      setLoading(false);
    }
  };

  const setPassword = async () => {
    const check = validatePassword(newPassword);
    if (!check.isValid) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', check.errors[0] || (isRTL ? 'كلمة المرور ضعيفة' : 'Weak password'));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      success();
      Alert.alert(
        isRTL ? 'تم' : 'Done',
        isRTL ? 'تم تحديث كلمة المرور. يمكنك الدخول الآن.' : 'Password updated. You can now log in.',
        [{ text: 'OK', onPress: () => router.replace('/(customer)') }]
      );
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    } finally {
      setLoading(false);
    }
  };

  const styles = createStyles(COLORS, isRTL);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (step === 'email' ? router.back() : setStep(step === 'newPassword' ? 'otp' : 'email'))}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
        >
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isRTL ? 'استعادة كلمة المرور' : 'Reset password'}</Text>
        <Text style={styles.stepBadge}>
          {step === 'email' ? '1/3' : step === 'otp' ? '2/3' : '3/3'}
        </Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          {step === 'email' && (
            <>
              <Text style={styles.bigTitle}>{isRTL ? 'أدخل بريدك الإلكتروني' : 'Enter your email'}</Text>
              <Text style={styles.sub}>
                {isRTL ? 'سنرسل كود مكوّن من 6 أرقام لإعادة تعيين كلمة المرور' : "We'll send a 6-digit code to reset your password"}
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, { color: COLORS.text, borderColor: COLORS.border }]}
                textAlign={isRTL ? 'right' : 'left'}
                autoFocus
              />
              <TouchableOpacity
                onPress={sendCode}
                disabled={!validateEmail(email.trim()) || loading}
                style={[styles.btn, { backgroundColor: COLORS.primary, opacity: !validateEmail(email.trim()) || loading ? 0.5 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={isRTL ? 'إرسال الكود' : 'Send code'}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.btnText}>{isRTL ? 'إرسال الكود' : 'Send code'}</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {step === 'otp' && (
            <>
              <Text style={styles.bigTitle}>{isRTL ? 'أدخل الكود' : 'Enter code'}</Text>
              <Text style={styles.sub}>{isRTL ? `أُرسل إلى ${email}` : `Sent to ${email}`}</Text>
              <TextInput
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="------"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="number-pad"
                style={[styles.otpInput, { color: COLORS.text, borderColor: COLORS.border }]}
                textAlign="center"
                autoFocus
                maxLength={6}
              />
              <TouchableOpacity
                onPress={verifyCode}
                disabled={code.length !== 6 || loading}
                style={[styles.btn, { backgroundColor: COLORS.primary, opacity: code.length !== 6 || loading ? 0.5 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={isRTL ? 'تأكيد' : 'Verify'}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.btnText}>{isRTL ? 'تأكيد الكود' : 'Verify code'}</Text>
                )}
              </TouchableOpacity>
              {resendIn > 0 ? (
                <Text style={styles.resendDisabled}>
                  {isRTL ? `إعادة الإرسال خلال ${resendIn}ث` : `Resend in ${resendIn}s`}
                </Text>
              ) : (
                <TouchableOpacity onPress={sendCode} accessibilityRole="button">
                  <Text style={styles.resend}>{isRTL ? 'إعادة إرسال الكود' : 'Resend code'}</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {step === 'newPassword' && (
            <>
              <Text style={styles.bigTitle}>{isRTL ? 'كلمة مرور جديدة' : 'New password'}</Text>
              <Text style={styles.sub}>
                {isRTL
                  ? '8 أحرف، حرف كبير، صغير، رقم، ورمز خاص'
                  : '8 chars with upper, lower, number, special'}
              </Text>
              <View style={styles.passwordRow}>
                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder={isRTL ? 'كلمة مرور جديدة' : 'New password'}
                  placeholderTextColor={COLORS.textSecondary}
                  secureTextEntry={!showPassword}
                  style={[styles.input, { flex: 1, color: COLORS.text, borderColor: COLORS.border }]}
                  textAlign={isRTL ? 'right' : 'left'}
                  autoCapitalize="none"
                  autoFocus
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((s) => !s)}
                  accessibilityRole="button"
                  accessibilityLabel={isRTL ? 'إظهار كلمة المرور' : 'Show password'}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={22}
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={setPassword}
                disabled={loading || !validatePassword(newPassword).isValid}
                style={[styles.btn, { backgroundColor: COLORS.primary, opacity: loading || !validatePassword(newPassword).isValid ? 0.5 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={isRTL ? 'حفظ' : 'Save'}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.btnText}>{isRTL ? 'حفظ كلمة المرور' : 'Save password'}</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: SPACING.lg,
    },
    title: { fontSize: 16, fontWeight: 'bold', color: C.text },
    stepBadge: { color: C.primary, fontWeight: '700' },
    content: { flex: 1, padding: SPACING.lg, gap: SPACING.lg },
    bigTitle: { fontSize: 24, fontWeight: 'bold', color: C.text, textAlign: isRTL ? 'right' : 'left' },
    sub: { fontSize: 14, color: C.textSecondary, textAlign: isRTL ? 'right' : 'left' },
    input: { borderWidth: 1, borderRadius: BORDER_RADIUS.md, padding: 16, fontSize: 16 },
    passwordRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 },
    otpInput: {
      borderWidth: 2,
      borderRadius: BORDER_RADIUS.md,
      padding: 18,
      fontSize: 28,
      letterSpacing: 12,
      fontWeight: 'bold',
    },
    btn: { paddingVertical: 16, borderRadius: BORDER_RADIUS.md, alignItems: 'center', justifyContent: 'center', minHeight: 56 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    resend: { color: C.primary, fontWeight: '600', textAlign: 'center', marginTop: 8 },
    resendDisabled: { color: C.textSecondary, textAlign: 'center', marginTop: 8 },
  });
