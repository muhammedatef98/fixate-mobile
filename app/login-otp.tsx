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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { supabase } from '../services/supabaseClient';
import { normalizeSaudiPhone, validatePhone, validateEmail } from '../utils/validation';
import { getFriendlyError } from '../utils/errorMessages';
import { tapMedium, success } from '../utils/haptics';
import { sendOtp as sendCustomOtp, verifyOtp as verifyCustomOtp } from '../services/customOtpService';

type Method = 'email' | 'phone';

export default function LoginOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ method?: Method }>();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  // Phone OTP requires a paid Saudi SMS provider on Supabase Auth, which
  // isn't configured yet. Email OTP via Resend is free and works today,
  // so we lock the screen to email and hide the toggle until SMS is wired.
  const [method, _setMethod] = useState<Method>('email');
  const setMethod = (m: Method) => _setMethod(m);
  // tslint:disable-next-line — params reserved for future re-enable
  void params;
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'identifier' | 'otp'>('identifier');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

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

  const isIdentifierValid =
    method === 'email' ? validateEmail(identifier.trim()) : validatePhone(identifier);

  const sendCode = async () => {
    if (!isIdentifierValid) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        method === 'email'
          ? (isRTL ? 'البريد الإلكتروني غير صحيح' : 'Invalid email')
          : (isRTL ? 'رقم الجوال غير صحيح' : 'Invalid phone number')
      );
      return;
    }
    setLoading(true);
    try {
      if (method === 'email') {
        await sendCustomOtp(identifier.trim().toLowerCase(), 'login', language);
      } else {
        const normalized = normalizeSaudiPhone(identifier);
        const { error } = await supabase.auth.signInWithOtp({ phone: normalized });
        if (error) throw error;
      }
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
      if (method === 'email') {
        await verifyCustomOtp(identifier.trim().toLowerCase(), code, 'login');
      } else {
        const { error } = await supabase.auth.verifyOtp({
          phone: normalizeSaudiPhone(identifier),
          token: code,
          type: 'sms',
        });
        if (error) throw error;
      }
      success();
      router.replace('/(customer)');
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    } finally {
      setLoading(false);
    }
  };

  const styles = createStyles(COLORS, isRTL);
  const sentTo = method === 'email' ? identifier.trim() : normalizeSaudiPhone(identifier);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (step === 'otp' ? setStep('identifier') : router.back())}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
        >
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isRTL ? 'دخول بكود' : 'Login with code'}</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          {step === 'identifier' ? (
            <>
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                <View style={{
                  width: 64, height: 64, borderRadius: 16, backgroundColor: COLORS.primary + '15',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="mail-outline" size={32} color={COLORS.primary} />
                </View>
              </View>
              <Text style={styles.bigTitle}>
                {isRTL ? 'الدخول برمز للبريد الإلكتروني' : 'Sign in with email code'}
              </Text>
              <Text style={styles.sub}>
                {isRTL ? 'سنرسل كود مكوّن من 6 أرقام إلى بريدك الإلكتروني' : "We'll email you a 6-digit code"}
              </Text>
              <TextInput
                value={identifier}
                onChangeText={setIdentifier}
                placeholder={method === 'email' ? 'name@example.com' : '05xxxxxxxx'}
                placeholderTextColor={COLORS.textSecondary}
                keyboardType={method === 'email' ? 'email-address' : 'phone-pad'}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, { color: COLORS.text, borderColor: COLORS.border }]}
                textAlign={isRTL ? 'right' : 'left'}
                autoFocus
              />
              <TouchableOpacity
                onPress={sendCode}
                disabled={!isIdentifierValid || loading}
                style={[styles.btn, { backgroundColor: COLORS.primary, opacity: !isIdentifierValid || loading ? 0.5 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={isRTL ? 'إرسال الكود' : 'Send code'}
                accessibilityState={{ disabled: !isIdentifierValid || loading }}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.btnText}>{isRTL ? 'إرسال الكود' : 'Send code'}</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.bigTitle}>{isRTL ? 'أدخل كود التحقّق' : 'Enter verification code'}</Text>
              <Text style={styles.sub}>
                {isRTL ? `أُرسل إلى ${sentTo}` : `Sent to ${sentTo}`}
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
    tabs: { flexDirection: 'row', backgroundColor: C.card, borderRadius: BORDER_RADIUS.md, padding: 4, marginBottom: 8 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: BORDER_RADIUS.md - 2, minHeight: 44 },
    tabActive: { backgroundColor: C.primary },
    tabText: { color: C.text, fontWeight: '600', fontSize: 14 },
    freeBadge: { backgroundColor: '#10B981', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 4 },
    freeBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    bigTitle: { fontSize: 24, fontWeight: 'bold', color: C.text, textAlign: isRTL ? 'right' : 'left' },
    sub: { fontSize: 14, color: C.textSecondary, textAlign: isRTL ? 'right' : 'left' },
    input: { borderWidth: 1, borderRadius: BORDER_RADIUS.md, padding: 16, fontSize: 16 },
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
