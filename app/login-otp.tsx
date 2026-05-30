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
  Animated,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
import { supabase } from '../services/supabaseClient';

/**
 * Phone-only OTP login/registration. The same screen handles both cases —
 * the verify edge function creates the auth user on first sign-in. We do
 * NOT collect a name or password here; the goal is the fastest possible
 * path from "open app" to "signed in".
 *
 * UI brief:
 *  - one calm, premium screen with three phases (phone → otp → name)
 *  - large breathing room around the input, no dense form noise
 *  - per-digit OTP boxes for clear focus + better readability
 *  - status pill replaces a chain of alerts where possible
 *  - reassuring micro-copy on each step — Arabic-first, RTL-clean
 */
export default function LoginOtpScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp' | 'name'>('phone');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [expiresIn, setExpiresIn] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hiddenOtpRef = useRef<TextInput>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => () => { if (tickRef.current) clearInterval(tickRef.current); }, []);

  // Cross-fade content on step change so transitions don't feel jumpy.
  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [step, fadeAnim]);

  const runShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 1,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 1,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  };

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
  const sentTo = normalizeSaudiPhone(phone);

  const formatMmSs = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  };

  const sendCode = async () => {
    setError(null);
    if (!isPhoneValid) {
      setError(isRTL ? 'رقم الجوال غير صحيح' : 'Invalid phone number');
      runShake();
      return;
    }
    setLoading(true);
    try {
      const { expiresIn: ttl, devCode } = await sendPhoneOtp(phone, language);
      tapMedium();
      setCode('');
      setStep('otp');
      startTimers(ttl);
      // Test mode — backend returns the code so QA can verify without
      // a real SMS provider. Disappears as soon as SMS goes live.
      if (devCode) {
        setCode(devCode);
        Alert.alert(
          isRTL ? 'وضع الاختبار' : 'Test mode',
          isRTL
            ? `لا يوجد مزوّد رسائل بعد. كود التحقق: ${devCode}`
            : `No SMS provider yet. Verification code: ${devCode}`
        );
      }
      // Focus the hidden input so the keypad pops immediately.
      setTimeout(() => hiddenOtpRef.current?.focus(), 50);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      runShake();
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    setError(null);
    if (code.length !== OTP_LENGTH) {
      setError(isRTL ? `الكود يجب أن يكون ${OTP_LENGTH} أرقام` : `Code must be ${OTP_LENGTH} digits`);
      runShake();
      return;
    }
    if (expiresIn <= 0) {
      setError(isRTL ? 'انتهت صلاحية الكود، اطلب كوداً جديداً' : 'Code expired, request a new one');
      runShake();
      return;
    }
    setLoading(true);
    try {
      await verifyPhoneOtp(phone, code, language);
      success();
      // Role-gate first: a verified phone may belong to a technician
      // account. The customer entrypoint must NOT silently route a
      // technician into the customer app.
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('users')
            .select('name, role')
            .eq('id', user.id)
            .maybeSingle();
          const profileRole =
            ((profile as any)?.role as string | null) ??
            ((user.user_metadata as any)?.role as string | null) ??
            null;
          if (profileRole === 'technician') {
            try { await supabase.auth.signOut({ scope: 'local' }); } catch {}
            Alert.alert(
              isRTL ? 'هذا الحساب فني' : 'Technician account',
              isRTL
                ? 'هذا الرقم مسجّل كفني. الرجاء الدخول من بوابة الفنيين.'
                : 'This number is registered as a technician. Please sign in from the technician portal.',
              [
                { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
                { text: isRTL ? 'بوابة الفنيين' : 'Technician portal', onPress: () => router.replace('/technician-auth') },
              ]
            );
            setCode('');
            setLoading(false);
            return;
          }
          const existingName = ((profile as any)?.name ?? '').trim();
          if (!existingName) {
            setStep('name');
            setLoading(false);
            return;
          }
        }
      } catch {
        // Profile lookup failure: fall through to customer area; the
        // (customer) layout guard handles any role mismatch.
      }
      router.replace('/(customer)');
    } catch (e: any) {
      setError(e?.message ?? String(e));
      runShake();
    } finally {
      setLoading(false);
    }
  };

  const saveName = async () => {
    setError(null);
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError(isRTL ? 'الرجاء إدخال اسمك' : 'Please enter your name');
      runShake();
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('users').update({ name: trimmed }).eq('id', user.id);
      }
      success();
      router.replace('/(customer)');
    } catch (e: any) {
      setError(e?.message ?? String(e));
      runShake();
    } finally {
      setLoading(false);
    }
  };

  const styles = createStyles(COLORS, isRTL);
  const shake = shakeAnim.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });

  // Render the OTP as individual boxes driven off the hidden input.
  const otpDigits = code.padEnd(OTP_LENGTH, ' ').split('');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        {step === 'name' ? (
          <View style={{ width: 32 }} />
        ) : (
          <TouchableOpacity
            onPress={() => {
              setError(null);
              if (step === 'otp') {
                setStep('phone');
              } else if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/role-selection');
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
            style={styles.headerBtn}
          >
            <RTLIonicon name="chevron-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>
          {step === 'name'
            ? (isRTL ? 'إكمال الحساب' : 'Complete your account')
            : (isRTL ? 'دخول بكود' : 'Sign in with code')}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Step pill — three dots showing the user's place in the flow. */}
      <View style={styles.stepRow}>
        {(['phone', 'otp', 'name'] as const).map((s, i) => {
          const active =
            (step === 'phone' && i === 0) ||
            (step === 'otp' && i <= 1) ||
            (step === 'name' && i <= 2);
          return (
            <View
              key={s}
              style={[styles.stepDot, active && { backgroundColor: COLORS.primary, width: 22 }]}
            />
          );
        })}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateX: shake }] }]}>
          {step === 'phone' ? (
            <>
              <View style={styles.iconBubble}>
                <Ionicons name="phone-portrait-outline" size={30} color={COLORS.primary} />
              </View>
              <Text style={styles.bigTitle}>
                {isRTL ? 'مرحباً بك في Fixate' : 'Welcome to Fixate'}
              </Text>
              <Text style={styles.sub}>
                {isRTL
                  ? `ابدأ بتسجيل دخول سريع — سنرسل كوداً مكوّناً من ${OTP_LENGTH} أرقام إلى جوالك.`
                  : `Quick sign-in — we'll text a ${OTP_LENGTH}-digit code to your phone.`}
              </Text>

              <Text style={styles.fieldLabel}>{isRTL ? 'رقم الجوال' : 'Mobile number'}</Text>
              <View style={[styles.phoneRow, { borderColor: error ? COLORS.error : COLORS.border }]}>
                <View style={styles.dial}>
                  <Text style={styles.dialText}>+966</Text>
                </View>
                <TextInput
                  value={phone}
                  onChangeText={(v) => { setError(null); setPhone(v.replace(/[^\d+]/g, '')); }}
                  placeholder="5XXXXXXXX"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.phoneInput}
                  textAlign={isRTL ? 'right' : 'left'}
                  maxLength={13}
                  returnKeyType="send"
                  onSubmitEditing={() => isPhoneValid && !loading && sendCode()}
                />
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                onPress={sendCode}
                disabled={!isPhoneValid || loading}
                style={[styles.btn, { backgroundColor: COLORS.primary, opacity: !isPhoneValid || loading ? 0.55 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={isRTL ? 'إرسال الكود' : 'Send code'}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.btnText}>{isRTL ? 'إرسال الكود' : 'Send code'}</Text>
                    <RTLIonicon name="arrow-forward" size={16} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>

              {/* Reassurance chips — quiet trust signals, not noisy. */}
              <View style={styles.trustRow}>
                <View style={styles.trustChip}>
                  <MaterialCommunityIcons name="shield-check-outline" size={13} color={COLORS.primary} />
                  <Text style={styles.trustChipText}>
                    {isRTL ? 'تشفير آمن' : 'Encrypted'}
                  </Text>
                </View>
                <View style={styles.trustChip}>
                  <MaterialCommunityIcons name="flash-outline" size={13} color={COLORS.primary} />
                  <Text style={styles.trustChipText}>
                    {isRTL ? 'دخول فوري' : 'Instant sign-in'}
                  </Text>
                </View>
                <View style={styles.trustChip}>
                  <MaterialCommunityIcons name="key-outline" size={13} color={COLORS.primary} />
                  <Text style={styles.trustChipText}>
                    {isRTL ? 'بدون كلمة سر' : 'No password'}
                  </Text>
                </View>
              </View>

              {/* Secondary path — email auth for customers. Phone OTP
                  above remains the primary, visually-first option. */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{isRTL ? 'أو' : 'or'}</Text>
                <View style={styles.dividerLine} />
              </View>
              <TouchableOpacity
                onPress={() => router.push('/email-auth')}
                style={[styles.emailBtn, { borderColor: COLORS.border }]}
                accessibilityRole="button"
                accessibilityLabel={isRTL ? 'متابعة بالبريد الإلكتروني' : 'Continue with email'}
              >
                <Ionicons name="mail-outline" size={18} color={COLORS.text} />
                <Text style={[styles.emailBtnText, { color: COLORS.text }]}>
                  {isRTL ? 'متابعة بالبريد الإلكتروني' : 'Continue with email'}
                </Text>
              </TouchableOpacity>

              <Text style={styles.hint}>
                {isRTL
                  ? 'بمتابعتك توافق على شروط الاستخدام وسياسة الخصوصية.'
                  : 'By continuing you agree to the Terms and Privacy Policy.'}
              </Text>
            </>
          ) : step === 'otp' ? (
            <>
              <View style={styles.iconBubble}>
                <MaterialCommunityIcons name="message-text-outline" size={28} color={COLORS.primary} />
              </View>
              <Text style={styles.bigTitle}>
                {isRTL ? 'أدخل كود التحقق' : 'Enter verification code'}
              </Text>
              <Text style={styles.sub}>
                {isRTL ? `أُرسل إلى ` : `Sent to `}
                <Text style={{ color: COLORS.text, fontWeight: '800' }}>{sentTo}</Text>
              </Text>

              {/* Hidden TextInput collects the digits; the visible row of
                  boxes mirrors it. Tapping any box opens the keyboard. */}
              <TouchableOpacity activeOpacity={1} onPress={() => hiddenOtpRef.current?.focus()}>
                {/* OTP digits MUST always render LTR — the verification code is
                    a number, not Arabic text. Forcing row (not row-reverse)
                    keeps the first typed digit on the left in any locale. */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 10,
                    marginTop: 6,
                  }}
                >
                  {otpDigits.map((d, i) => {
                    const filled = d !== ' ';
                    const isCursor = i === code.length;
                    return (
                      <View
                        key={i}
                        style={[
                          styles.otpBox,
                          {
                            borderColor: error
                              ? COLORS.error
                              : isCursor
                                ? COLORS.primary
                                : filled
                                  ? COLORS.primary + '55'
                                  : COLORS.border,
                            backgroundColor: filled ? COLORS.primary + '10' : COLORS.card,
                          },
                        ]}
                      >
                        <Text style={[styles.otpBoxText, { color: COLORS.text }]}>
                          {filled ? d : ''}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </TouchableOpacity>
              <TextInput
                ref={hiddenOtpRef}
                value={code}
                onChangeText={(v) => { setError(null); setCode(v.replace(/\D/g, '').slice(0, OTP_LENGTH)); }}
                keyboardType="number-pad"
                style={styles.hiddenInput}
                autoFocus
                maxLength={OTP_LENGTH}
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                caretHidden
              />

              <View style={styles.expiryRow}>
                <MaterialCommunityIcons
                  name={expiresIn > 0 ? 'clock-outline' : 'clock-alert-outline'}
                  size={13}
                  color={expiresIn > 0 ? COLORS.textSecondary : COLORS.error}
                />
                <Text style={[styles.expiry, expiresIn === 0 && { color: COLORS.error }]}>
                  {expiresIn > 0
                    ? (isRTL ? `صالح لمدة ${formatMmSs(expiresIn)}` : `Valid for ${formatMmSs(expiresIn)}`)
                    : (isRTL ? 'انتهت صلاحية الكود' : 'Code expired')}
                </Text>
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                onPress={verify}
                disabled={code.length !== OTP_LENGTH || loading || expiresIn <= 0}
                style={[
                  styles.btn,
                  {
                    backgroundColor: COLORS.primary,
                    opacity: code.length !== OTP_LENGTH || loading || expiresIn <= 0 ? 0.55 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={isRTL ? 'تأكيد' : 'Verify'}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>{isRTL ? 'تأكيد ودخول' : 'Verify & sign in'}</Text>
                )}
              </TouchableOpacity>

              {resendIn > 0 ? (
                <View style={styles.resendRow}>
                  <Text style={styles.resendDisabled}>
                    {isRTL ? `إعادة الإرسال خلال ` : `Resend in `}
                    <Text style={{ fontWeight: '800' }}>{resendIn}s</Text>
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={sendCode}
                  disabled={loading}
                  style={styles.resendBtn}
                  accessibilityRole="button"
                >
                  <Ionicons name="refresh" size={14} color={COLORS.primary} />
                  <Text style={styles.resend}>
                    {isRTL ? 'إعادة إرسال الكود' : 'Resend code'}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => { setError(null); setStep('phone'); }}
                style={{ marginTop: 4, alignItems: 'center' }}
                accessibilityRole="button"
              >
                <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>
                  {isRTL ? 'تغيير الرقم' : 'Change number'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.iconBubble}>
                <Ionicons name="person-outline" size={30} color={COLORS.primary} />
              </View>
              <Text style={styles.bigTitle}>
                {isRTL ? 'ما اسمك؟' : "What's your name?"}
              </Text>
              <Text style={styles.sub}>
                {isRTL ? 'خطوة أخيرة لإكمال حسابك' : 'One last step to set up your account'}
              </Text>

              <Text style={styles.fieldLabel}>{isRTL ? 'الاسم الكامل' : 'Full name'}</Text>
              <View style={[styles.phoneRow, { borderColor: error ? COLORS.error : COLORS.border }]}>
                <TextInput
                  value={name}
                  onChangeText={(v) => { setError(null); setName(v); }}
                  placeholder={isRTL ? 'اكتب اسمك هنا' : 'Type your name'}
                  placeholderTextColor={COLORS.textSecondary}
                  autoCapitalize="words"
                  style={[styles.phoneInput, { paddingHorizontal: 14 }]}
                  textAlign={isRTL ? 'right' : 'left'}
                  autoFocus
                  maxLength={60}
                  returnKeyType="done"
                  onSubmitEditing={() => name.trim().length >= 2 && !loading && saveName()}
                />
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                onPress={saveName}
                disabled={name.trim().length < 2 || loading}
                style={[styles.btn, { backgroundColor: COLORS.primary, opacity: name.trim().length < 2 || loading ? 0.55 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={isRTL ? 'متابعة' : 'Continue'}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.btnText}>{isRTL ? 'متابعة' : 'Continue'}</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
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
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.sm,
    },
    headerBtn: {
      width: 32, height: 32, borderRadius: 16,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: C.card,
    },
    headerTitle: { fontSize: 15, fontWeight: '700', color: C.text },
    stepRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignSelf: 'center',
      gap: 6,
      marginTop: 2,
      marginBottom: 6,
    },
    stepDot: {
      width: 8, height: 8, borderRadius: 4,
      backgroundColor: C.border,
    },
    content: { flex: 1, padding: SPACING.lg, gap: 12 },
    iconBubble: {
      width: 64, height: 64, borderRadius: 20, backgroundColor: C.primary + '14',
      alignItems: 'center', justifyContent: 'center',
      alignSelf: isRTL ? 'flex-end' : 'flex-start',
      marginBottom: 4,
    },
    bigTitle: {
      fontSize: 26, fontWeight: '800', color: C.text,
      textAlign: isRTL ? 'right' : 'left',
      writingDirection: isRTL ? 'rtl' : 'ltr',
      letterSpacing: -0.3,
    },
    sub: {
      fontSize: 14, color: C.textSecondary,
      lineHeight: 22,
      textAlign: isRTL ? 'right' : 'left',
      writingDirection: isRTL ? 'rtl' : 'ltr',
    },
    fieldLabel: {
      color: C.textSecondary,
      fontWeight: '700',
      fontSize: 12,
      marginTop: 8,
      textAlign: isRTL ? 'right' : 'left',
    },
    phoneRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderRadius: BORDER_RADIUS.lg,
      overflow: 'hidden',
      backgroundColor: C.card,
    },
    dial: {
      paddingHorizontal: 14,
      paddingVertical: 16,
      backgroundColor: C.background,
      borderRightWidth: isRTL ? 0 : 1,
      borderLeftWidth: isRTL ? 1 : 0,
      borderColor: C.border,
    },
    dialText: { fontSize: 16, fontWeight: '800', color: C.text },
    phoneInput: { flex: 1, padding: 16, fontSize: 16, color: C.text },

    otpBox: {
      width: 46,
      height: 56,
      borderWidth: 1.5,
      borderRadius: BORDER_RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    otpBoxText: {
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: 0,
    },
    hiddenInput: {
      position: 'absolute',
      width: 1, height: 1, opacity: 0,
    },

    expiryRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      marginTop: 4,
    },
    expiry: { color: C.textSecondary, fontSize: 12, fontWeight: '600' },

    btn: {
      paddingVertical: 16,
      borderRadius: BORDER_RADIUS.lg,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 56,
      marginTop: 6,
    },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },

    resendRow: { alignItems: 'center', marginTop: 6 },
    resendDisabled: { color: C.textSecondary, fontSize: 13 },
    resendBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 8,
      marginTop: 2,
    },
    resend: { color: C.primary, fontWeight: '700', fontSize: 13.5 },

    errorText: {
      color: C.error,
      fontSize: 13,
      fontWeight: '600',
      textAlign: isRTL ? 'right' : 'left',
      writingDirection: isRTL ? 'rtl' : 'ltr',
      marginTop: 2,
    },

    trustRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 10,
    },
    trustChip: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: C.primary + '12',
    },
    trustChipText: { color: C.primary, fontWeight: '700', fontSize: 11.5 },

    hint: {
      color: C.textSecondary,
      fontSize: 11.5,
      textAlign: 'center',
      lineHeight: 18,
      marginTop: 6,
    },

    dividerRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 18,
      marginBottom: 12,
    },
    dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: C.border },
    dividerText: { color: C.textSecondary, fontSize: 11.5, fontWeight: '700' },
    emailBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1.5,
      backgroundColor: 'transparent',
    },
    emailBtnText: { fontSize: 14.5, fontWeight: '700' },
  });

// Re-export so legacy callers that imported the constant directly still build.
export { OTP_TTL_SECONDS };
