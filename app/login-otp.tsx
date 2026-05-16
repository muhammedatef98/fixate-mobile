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
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { normalizeSaudiPhone, validatePhone } from '../utils/validation';
import { tapMedium, success } from '../utils/haptics';
import {
  sendPhoneOtp,
  verifyPhoneOtp,
  OTP_LENGTH,
  OTP_TTL_SECONDS,
  RESEND_COOLDOWN_SECONDS,
} from '../services/phoneOtpService';

// Phone-only OTP login/registration. The same screen handles both cases —
// the verify edge function will create the auth user on first sign-in. We
// intentionally do NOT collect a name or password here; the goal is the
// fastest possible path from "open app" to "signed in".
export default function LoginOtpScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  // Resend cooldown (server-enforced ~30s) AND code expiry (5 min) tracked
  // as two separate countdowns so the UI can show both: when resend unlocks
  // and when the existing code becomes invalid.
  const [resendIn, setResendIn] = useState(0);
  const [expiresIn, setExpiresIn] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (tickRef.current) clearInterval(tickRef.current); }, []);

  const startTimers = (ttl: number) => {
    setResendIn(RESEND_COOLDOWN_SECONDS);
    setExpiresIn(ttl);
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setResendIn((s) => (s > 0 ? s - 1 : 0));
      setExpiresIn((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
  };

  const isPhoneValid = validatePhone(phone);

  const sendCode = async () => {
    if (!isPhoneValid) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'رقم الجوال غير صحيح' : 'Invalid phone number'
      );
      return;
    }
    setLoading(true);
    try {
      const { expiresIn: ttl } = await sendPhoneOtp(phone, language);
      tapMedium();
      setStep('otp');
      startTimers(ttl);
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    if (code.length !== OTP_LENGTH) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? `الكود يجب أن يكون ${OTP_LENGTH} أرقام` : `Code must be ${OTP_LENGTH} digits`
      );
      return;
    }
    if (expiresIn <= 0) {
      Alert.alert(
        isRTL ? 'انتهت الصلاحية' : 'Expired',
        isRTL ? 'انتهت صلاحية الكود، اطلب كوداً جديداً' : 'Code expired, request a new one'
      );
      return;
    }
    setLoading(true);
    try {
      await verifyPhoneOtp(phone, code, language);
      success();
      router.replace('/(customer)');
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const styles = createStyles(COLORS, isRTL);
  const sentTo = normalizeSaudiPhone(phone);

  const formatMmSs = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (step === 'otp') {
              setStep('phone');
            } else if (router.canGoBack()) {
              router.back();
            } else {
              // login-otp is often reached via router.replace (role-selection,
              // legacy /login redirect), so there is no history to pop.
              router.replace('/role-selection');
            }
          }}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
        >
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isRTL ? 'دخول بكود' : 'Sign in with code'}</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          {step === 'phone' ? (
            <>
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                <View style={styles.iconBubble}>
                  <Ionicons name="phone-portrait-outline" size={32} color={COLORS.primary} />
                </View>
              </View>
              <Text style={styles.bigTitle}>
                {isRTL ? 'تسجيل دخول سريع' : 'Quick sign-in'}
              </Text>
              <Text style={styles.sub}>
                {isRTL
                  ? `سنرسل كوداً مكوّناً من ${OTP_LENGTH} أرقام إلى رقم جوالك`
                  : `We'll text you a ${OTP_LENGTH}-digit code`}
              </Text>
              <View style={[styles.phoneRow, { borderColor: COLORS.border }]}>
                <View style={styles.dial}>
                  <Text style={[styles.dialText, { color: COLORS.text }]}>+966</Text>
                </View>
                <TextInput
                  value={phone}
                  onChangeText={(v) => setPhone(v.replace(/[^\d+]/g, ''))}
                  placeholder="5XXXXXXXX"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.phoneInput, { color: COLORS.text }]}
                  textAlign={isRTL ? 'right' : 'left'}
                  autoFocus
                  maxLength={13}
                />
              </View>
              <TouchableOpacity
                onPress={sendCode}
                disabled={!isPhoneValid || loading}
                style={[styles.btn, { backgroundColor: COLORS.primary, opacity: !isPhoneValid || loading ? 0.5 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={isRTL ? 'إرسال الكود' : 'Send code'}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.btnText}>{isRTL ? 'إرسال الكود' : 'Send code'}</Text>
                )}
              </TouchableOpacity>
              <Text style={styles.hint}>
                {isRTL
                  ? 'بمتابعتك توافق على شروط الاستخدام وسياسة الخصوصية.'
                  : 'By continuing you agree to the Terms and Privacy Policy.'}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.bigTitle}>{isRTL ? 'أدخل كود التحقّق' : 'Enter verification code'}</Text>
              <Text style={styles.sub}>
                {isRTL ? `أُرسل إلى ${sentTo}` : `Sent to ${sentTo}`}
              </Text>
              <TextInput
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, OTP_LENGTH))}
                placeholder={'-'.repeat(OTP_LENGTH)}
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="number-pad"
                style={[styles.otpInput, { color: COLORS.text, borderColor: COLORS.border }]}
                textAlign="center"
                autoFocus
                maxLength={OTP_LENGTH}
              />
              <Text style={styles.expiry}>
                {expiresIn > 0
                  ? (isRTL ? `صالح لمدة ${formatMmSs(expiresIn)}` : `Valid for ${formatMmSs(expiresIn)}`)
                  : (isRTL ? 'انتهت صلاحية الكود' : 'Code expired')}
              </Text>
              <TouchableOpacity
                onPress={verify}
                disabled={code.length !== OTP_LENGTH || loading || expiresIn <= 0}
                style={[styles.btn, { backgroundColor: COLORS.primary, opacity: code.length !== OTP_LENGTH || loading || expiresIn <= 0 ? 0.5 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={isRTL ? 'تأكيد' : 'Verify'}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.btnText}>{isRTL ? 'تأكيد ودخول' : 'Verify & sign in'}</Text>
                )}
              </TouchableOpacity>

              {resendIn > 0 ? (
                <Text style={styles.resendDisabled}>
                  {isRTL ? `إعادة الإرسال خلال ${resendIn}ث` : `Resend in ${resendIn}s`}
                </Text>
              ) : (
                <TouchableOpacity onPress={sendCode} accessibilityRole="button" disabled={loading}>
                  <Text style={[styles.resend, { opacity: loading ? 0.5 : 1 }]}>
                    {isRTL ? 'إعادة إرسال الكود' : 'Resend code'}
                  </Text>
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
    iconBubble: {
      width: 64, height: 64, borderRadius: 16, backgroundColor: C.primary + '15',
      alignItems: 'center', justifyContent: 'center',
    },
    bigTitle: { fontSize: 24, fontWeight: 'bold', color: C.text, textAlign: isRTL ? 'right' : 'left' },
    sub: { fontSize: 14, color: C.textSecondary, textAlign: isRTL ? 'right' : 'left' },
    phoneRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: BORDER_RADIUS.md,
      overflow: 'hidden',
    },
    dial: {
      paddingHorizontal: 14,
      paddingVertical: 16,
      backgroundColor: C.card,
      borderRightWidth: isRTL ? 0 : 1,
      borderLeftWidth: isRTL ? 1 : 0,
      borderColor: C.border,
    },
    dialText: { fontSize: 16, fontWeight: '700' },
    phoneInput: { flex: 1, padding: 16, fontSize: 16 },
    otpInput: {
      borderWidth: 2,
      borderRadius: BORDER_RADIUS.md,
      padding: 18,
      fontSize: 32,
      letterSpacing: 18,
      fontWeight: 'bold',
    },
    btn: { paddingVertical: 16, borderRadius: BORDER_RADIUS.md, alignItems: 'center', justifyContent: 'center', minHeight: 56 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    expiry: { color: C.textSecondary, textAlign: 'center', fontSize: 13 },
    resend: { color: C.primary, fontWeight: '600', textAlign: 'center', marginTop: 8 },
    resendDisabled: { color: C.textSecondary, textAlign: 'center', marginTop: 8 },
    hint: { color: C.textSecondary, fontSize: 12, textAlign: 'center' },
  });

// Re-export so legacy callers that imported the constant directly still build.
export { OTP_TTL_SECONDS };
