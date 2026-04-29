import React, { useState, useRef, useEffect } from 'react';
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
import { useApp } from '../contexts/AppContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { supabase } from '../services/supabaseClient';
import { normalizeSaudiPhone, validatePhone } from '../utils/validation';
import { getFriendlyError } from '../utils/errorMessages';
import { tapMedium, success } from '../utils/haptics';

export default function LoginOtpScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startResendTimer = () => {
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
    if (!validatePhone(phone)) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'رقم الجوال غير صحيح' : 'Invalid phone number');
      return;
    }
    setLoading(true);
    try {
      const normalized = normalizeSaudiPhone(phone);
      const { error } = await supabase.auth.signInWithOtp({ phone: normalized });
      if (error) throw error;
      tapMedium();
      setStep('otp');
      startResendTimer();
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    if (code.length !== 6) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'الكود يجب أن يكون 6 أرقام' : 'Code must be 6 digits');
      return;
    }
    setLoading(true);
    try {
      const normalized = normalizeSaudiPhone(phone);
      const { error } = await supabase.auth.verifyOtp({
        phone: normalized,
        token: code,
        type: 'sms',
      });
      if (error) throw error;
      success();
      router.replace('/(customer)');
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
          onPress={() => (step === 'otp' ? setStep('phone') : router.back())}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
        >
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isRTL ? 'تسجيل الدخول بالجوال' : 'Phone login'}</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          {step === 'phone' ? (
            <>
              <Text style={styles.bigTitle}>{isRTL ? 'أدخل رقم جوالك' : 'Enter your phone'}</Text>
              <Text style={styles.sub}>
                {isRTL ? 'سنرسل لك كوداً للتحقق برسالة نصية' : "We'll send you an SMS verification code"}
              </Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="05xxxxxxxx"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="phone-pad"
                style={[styles.input, { color: COLORS.text, borderColor: COLORS.border }]}
                textAlign={isRTL ? 'right' : 'left'}
                autoFocus
              />
              <TouchableOpacity
                onPress={sendCode}
                disabled={!validatePhone(phone) || loading}
                style={[styles.btn, { backgroundColor: COLORS.primary, opacity: !validatePhone(phone) || loading ? 0.5 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={isRTL ? 'إرسال الكود' : 'Send code'}
                accessibilityState={{ disabled: !validatePhone(phone) || loading }}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.btnText}>{isRTL ? 'إرسال الكود' : 'Send code'}</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.bigTitle}>{isRTL ? 'أدخل كود التحقق' : 'Enter verification code'}</Text>
              <Text style={styles.sub}>
                {isRTL ? `أُرسل إلى ${normalizeSaudiPhone(phone)}` : `Sent to ${normalizeSaudiPhone(phone)}`}
              </Text>
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
                onPress={verify}
                disabled={code.length !== 6 || loading}
                style={[styles.btn, { backgroundColor: COLORS.primary, opacity: code.length !== 6 || loading ? 0.5 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={isRTL ? 'تأكيد' : 'Verify'}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.btnText}>{isRTL ? 'تأكيد' : 'Verify'}</Text>
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
    content: { flex: 1, padding: SPACING.lg, gap: SPACING.lg },
    bigTitle: { fontSize: 26, fontWeight: 'bold', color: C.text, textAlign: isRTL ? 'right' : 'left' },
    sub: { fontSize: 14, color: C.textSecondary, textAlign: isRTL ? 'right' : 'left' },
    input: { borderWidth: 1, borderRadius: BORDER_RADIUS.md, padding: 16, fontSize: 18 },
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
