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
  Animated,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { supabase } from '../services/supabaseClient';
import { validateEmail, validatePassword, validateName } from '../utils/validation';
import { tapMedium, success } from '../utils/haptics';
import {
  signUpWithPhoneOrEmail,
  loginWithPhoneOrEmail,
} from '../services/authService';
import { getFriendlyError } from '../utils/errorMessages';

/**
 * Secondary auth path: email-based login/signup for customers only.
 *
 * Phone OTP via Authentica remains the primary path (app/login-otp.tsx).
 * This screen is reachable through the "Continue with email" link on the
 * phone screen. Technician auth is unchanged — see app/technician-auth.tsx.
 *
 * Two top-level modes:
 *   - 'code'     → Supabase-side email OTP (send-otp / verify-otp edge fns)
 *   - 'password' → email + password, with an inner sign-in vs sign-up toggle
 *
 * Role is hard-pinned to 'customer'. The signup edge function honours
 * handle_new_user's whitelist (M-3), so any client tampering still resolves
 * to 'customer'. A post-auth role check (same as login-otp) signs out and
 * redirects technicians to their portal.
 */

const OTP_LENGTH = 6;
const OTP_TTL_SECONDS = 10 * 60;
const RESEND_COOLDOWN_SECONDS = 60;

type Mode = 'code' | 'password';
type PwSub = 'signin' | 'signup';
type CodeStep = 'email' | 'otp';

export default function EmailAuthScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  // Layout state
  const [mode, setMode]     = useState<Mode>('code');
  const [pwSub, setPwSub]   = useState<PwSub>('signin');
  const [codeStep, setCodeStep] = useState<CodeStep>('email');
  // Tracks which verifyOtp `type` to use:
  //   'email'  → arrived via signInWithOtp (Code mode quick login)
  //   'signup' → arrived via auth.signUp confirmation (password sign-up
  //              landed here because Supabase requires email confirmation)
  const [otpType, setOtpType] = useState<'email' | 'signup'>('email');

  // Field state — shared across modes where reasonable.
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]         = useState('');
  const [code, setCode]         = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // UI state
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [expiresIn, setExpiresIn] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const hiddenOtpRef = useRef<TextInput>(null);

  useEffect(() => () => { if (tickRef.current) clearInterval(tickRef.current); }, []);

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

  const formatMmSs = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  };

  // After ANY successful auth we check the resolved profile.role and bounce
  // technicians back to their portal so they never accidentally land in the
  // customer app from the email path.
  const finishAndRouteCustomer = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('role')
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
              ? 'هذا الحساب مسجّل كفني. الرجاء الدخول من بوابة الفنيين.'
              : 'This account is registered as a technician. Please sign in from the technician portal.',
            [
              { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
              { text: isRTL ? 'بوابة الفنيين' : 'Technician portal', onPress: () => router.replace('/technician-auth') },
            ]
          );
          return;
        }
      }
    } catch {
      // Profile lookup failure: fall through; the (customer) layout guard
      // handles any role mismatch and BlockedScreen handles suspended accounts.
    }
    success();
    router.replace('/(customer)');
  };

  // ─── Email OTP flow ───────────────────────────────────────────────────
  // Uses Supabase Auth's built-in email OTP. The provider handles delivery
  // (via Supabase's email service or your configured SMTP), code storage,
  // verification, and session creation. No custom edge function — that
  // removes the "non-2xx" failure path the Resend-backed pipeline produced.
  //
  // For new users, shouldCreateUser=true lets the same call double as
  // signup-by-OTP. The role is passed via raw_user_meta_data and locked to
  // 'customer' by handle_new_user's whitelist (M-3 hardening) even if the
  // client value is tampered with.
  const sendCodeEmail = async () => {
    setError(null);
    if (!validateEmail(email)) {
      setError(isRTL ? 'البريد الإلكتروني غير صحيح' : 'Invalid email address');
      runShake();
      return;
    }
    setLoading(true);
    try {
      const { error: sendErr } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
          data: { role: 'customer', user_type: 'customer' },
        },
      });
      if (sendErr) throw sendErr;
      tapMedium();
      setCode('');
      setOtpType('email');
      setCodeStep('otp');
      startTimers(OTP_TTL_SECONDS);
      setTimeout(() => hiddenOtpRef.current?.focus(), 50);
    } catch (e: any) {
      setError(getFriendlyError(e, language));
      runShake();
    } finally {
      setLoading(false);
    }
  };

  const verifyCodeEmail = async () => {
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
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code,
        // 'email' → quick OTP login (signInWithOtp)
        // 'signup' → confirming a brand-new account from auth.signUp
        type: otpType,
      });
      if (verifyErr) throw verifyErr;
      await finishAndRouteCustomer();
    } catch (e: any) {
      setError(getFriendlyError(e, language));
      runShake();
    } finally {
      setLoading(false);
    }
  };

  // ─── Email + password flow ────────────────────────────────────────────
  const submitPassword = async () => {
    setError(null);
    if (!validateEmail(email)) {
      setError(isRTL ? 'البريد الإلكتروني غير صحيح' : 'Invalid email address');
      runShake();
      return;
    }
    if (pwSub === 'signin') {
      if (!password) {
        setError(isRTL ? 'كلمة المرور مطلوبة' : 'Password is required');
        runShake();
        return;
      }
      setLoading(true);
      try {
        await loginWithPhoneOrEmail({ email: email.trim().toLowerCase(), password });
        await finishAndRouteCustomer();
      } catch (e: any) {
        setError(getFriendlyError(e, language));
        runShake();
      } finally {
        setLoading(false);
      }
      return;
    }

    // sign up
    const nameCheck = validateName(name);
    if (!nameCheck.valid) {
      setError(nameCheck.message);
      runShake();
      return;
    }
    const passCheck = validatePassword(password);
    if (!passCheck.isValid) {
      setError(passCheck.errors[0] ?? (isRTL ? 'كلمة المرور ضعيفة' : 'Weak password'));
      runShake();
      return;
    }
    setLoading(true);
    try {
      // Role is pinned to 'customer'. auth.signUp + handle_new_user
      // (M-3 whitelist) both enforce this; client tampering cannot
      // elevate the role.
      const result = await signUpWithPhoneOrEmail({
        email: email.trim().toLowerCase(),
        password,
        name: name.trim(),
        role: 'customer',
      });
      // When the project has "Confirm email" enabled, Supabase returns
      // session=null and sends the OTP "Confirm signup" email. Route
      // the user into the OTP step instead of pretending they're in.
      if (result.requiresConfirmation) {
        tapMedium();
        setCode('');
        setOtpType('signup');
        setMode('code');
        setCodeStep('otp');
        startTimers(OTP_TTL_SECONDS);
        setTimeout(() => hiddenOtpRef.current?.focus(), 50);
        Alert.alert(
          isRTL ? 'تأكيد البريد' : 'Verify your email',
          isRTL
            ? 'أرسلنا كوداً مكوّناً من 6 أرقام إلى بريدك. أدخله لإكمال إنشاء الحساب.'
            : 'We emailed you a 6-digit code. Enter it to finish creating your account.'
        );
        return;
      }
      // "Confirm email" disabled → session in hand, go straight in.
      await finishAndRouteCustomer();
    } catch (e: any) {
      setError(getFriendlyError(e, language));
      runShake();
    } finally {
      setLoading(false);
    }
  };

  const goBackFromOtp = () => {
    setError(null);
    setCode('');
    setCodeStep('email');
  };

  const styles = createStyles(COLORS, isRTL);
  const shake = shakeAnim.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });
  const otpDigits = code.padEnd(OTP_LENGTH, ' ').split('');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (mode === 'code' && codeStep === 'otp') {
              goBackFromOtp();
              return;
            }
            if (router.canGoBack()) router.back();
            else router.replace('/login-otp');
          }}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
          style={styles.headerBtn}
        >
          <RTLIonicon name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isRTL ? 'الدخول بالبريد' : 'Sign in with email'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        {/* Wrapping in TouchableWithoutFeedback lets a tap outside any input
            dismiss the keyboard; the inner ScrollView keeps the active
            input visible while typing on both iOS and Android. */}
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingBottom: SPACING.xl }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="interactive"
          >
            <Animated.View style={[styles.content, { transform: [{ translateX: shake }] }]}>
          {/* Mode segmented selector — hidden on the OTP digit step. */}
          {codeStep === 'email' && (
            <View style={styles.segment}>
              {(['code', 'password'] as const).map((m) => {
                const active = mode === m;
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={() => { setMode(m); setError(null); }}
                    style={[
                      styles.segmentBtn,
                      active && { backgroundColor: COLORS.primary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        { color: active ? '#fff' : COLORS.textSecondary },
                      ]}
                    >
                      {m === 'code'
                        ? (isRTL ? 'كود تحقّق' : 'Code')
                        : (isRTL ? 'كلمة مرور' : 'Password')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* CODE MODE */}
          {mode === 'code' && codeStep === 'email' && (
            <>
              <View style={styles.iconBubble}>
                <MaterialCommunityIcons name="email-outline" size={28} color={COLORS.primary} />
              </View>
              <Text style={styles.bigTitle}>
                {isRTL ? 'دخول سريع بكود' : 'Quick sign-in with a code'}
              </Text>
              <Text style={styles.sub}>
                {isRTL
                  ? `سنرسل كوداً مكوّناً من ${OTP_LENGTH} أرقام إلى بريدك.`
                  : `We'll email you a ${OTP_LENGTH}-digit code.`}
              </Text>

              <Text style={styles.fieldLabel}>{isRTL ? 'البريد الإلكتروني' : 'Email'}</Text>
              <View style={[styles.inputRow, { borderColor: error ? COLORS.error : COLORS.border }]}>
                <TextInput
                  value={email}
                  onChangeText={(v) => { setError(null); setEmail(v); }}
                  placeholder="name@example.com"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                  textAlign={isRTL ? 'right' : 'left'}
                  returnKeyType="send"
                  onSubmitEditing={() => !loading && sendCodeEmail()}
                />
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                onPress={sendCodeEmail}
                disabled={loading || !email}
                style={[styles.btn, { backgroundColor: COLORS.primary, opacity: (loading || !email) ? 0.55 : 1 }]}
                accessibilityRole="button"
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>{isRTL ? 'إرسال الكود' : 'Send code'}</Text>}
              </TouchableOpacity>
            </>
          )}

          {mode === 'code' && codeStep === 'otp' && (
            <>
              <View style={styles.iconBubble}>
                <MaterialCommunityIcons name="message-text-outline" size={28} color={COLORS.primary} />
              </View>
              <Text style={styles.bigTitle}>{isRTL ? 'أدخل كود التحقّق' : 'Enter the code'}</Text>
              <Text style={styles.sub}>
                {isRTL ? 'أُرسل إلى ' : 'Sent to '}
                <Text style={{ color: COLORS.text, fontWeight: '800' }}>{email}</Text>
              </Text>

              <TouchableOpacity activeOpacity={1} onPress={() => hiddenOtpRef.current?.focus()}>
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'center', gap: 8, marginTop: 6 }}>
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
                              : isCursor ? COLORS.primary : filled ? COLORS.primary + '55' : COLORS.border,
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

              <Text style={styles.expiry}>
                {expiresIn > 0
                  ? (isRTL ? `صالح لمدة ${formatMmSs(expiresIn)}` : `Valid for ${formatMmSs(expiresIn)}`)
                  : (isRTL ? 'انتهت صلاحية الكود' : 'Code expired')}
              </Text>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                onPress={verifyCodeEmail}
                disabled={loading || code.length !== OTP_LENGTH || expiresIn <= 0}
                style={[
                  styles.btn,
                  { backgroundColor: COLORS.primary, opacity: (loading || code.length !== OTP_LENGTH || expiresIn <= 0) ? 0.55 : 1 },
                ]}
                accessibilityRole="button"
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>{isRTL ? 'تأكيد ودخول' : 'Verify & sign in'}</Text>}
              </TouchableOpacity>

              {resendIn > 0 ? (
                <Text style={styles.resendDisabled}>
                  {isRTL ? `إعادة الإرسال خلال ${resendIn} ث` : `Resend in ${resendIn}s`}
                </Text>
              ) : (
                <TouchableOpacity onPress={sendCodeEmail} disabled={loading}>
                  <Text style={[styles.resend, { color: COLORS.primary }]}>
                    {isRTL ? 'إعادة إرسال الكود' : 'Resend code'}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* PASSWORD MODE */}
          {mode === 'password' && (
            <>
              <View style={styles.iconBubble}>
                <Ionicons name="lock-closed-outline" size={28} color={COLORS.primary} />
              </View>
              <Text style={styles.bigTitle}>
                {pwSub === 'signin'
                  ? (isRTL ? 'تسجيل الدخول' : 'Sign in')
                  : (isRTL ? 'إنشاء حساب' : 'Create account')}
              </Text>

              {/* Sign-in / Sign-up inner toggle */}
              <View style={[styles.subSegment, { borderColor: COLORS.border }]}>
                {(['signin', 'signup'] as const).map((s) => {
                  const active = pwSub === s;
                  return (
                    <TouchableOpacity
                      key={s}
                      onPress={() => { setPwSub(s); setError(null); }}
                      style={[
                        styles.subSegmentBtn,
                        active && { backgroundColor: COLORS.primary + '15' },
                      ]}
                    >
                      <Text style={[styles.subSegmentText, { color: active ? COLORS.primary : COLORS.textSecondary }]}>
                        {s === 'signin'
                          ? (isRTL ? 'لدي حساب' : 'I have an account')
                          : (isRTL ? 'حساب جديد' : 'New account')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {pwSub === 'signup' && (
                <>
                  <Text style={styles.fieldLabel}>{isRTL ? 'الاسم' : 'Name'}</Text>
                  <View style={[styles.inputRow, { borderColor: error ? COLORS.error : COLORS.border }]}>
                    <TextInput
                      value={name}
                      onChangeText={(v) => { setError(null); setName(v); }}
                      placeholder={isRTL ? 'اكتب اسمك الكامل' : 'Your full name'}
                      placeholderTextColor={COLORS.textSecondary}
                      autoCapitalize="words"
                      style={styles.input}
                      textAlign={isRTL ? 'right' : 'left'}
                      returnKeyType="next"
                    />
                  </View>
                </>
              )}

              <Text style={styles.fieldLabel}>{isRTL ? 'البريد الإلكتروني' : 'Email'}</Text>
              <View style={[styles.inputRow, { borderColor: error ? COLORS.error : COLORS.border }]}>
                <TextInput
                  value={email}
                  onChangeText={(v) => { setError(null); setEmail(v); }}
                  placeholder="name@example.com"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                  textAlign={isRTL ? 'right' : 'left'}
                  returnKeyType="next"
                />
              </View>

              <Text style={styles.fieldLabel}>{isRTL ? 'كلمة المرور' : 'Password'}</Text>
              <View style={[styles.inputRow, { borderColor: error ? COLORS.error : COLORS.border }]}>
                <TextInput
                  value={password}
                  onChangeText={(v) => { setError(null); setPassword(v); }}
                  placeholder={isRTL ? '••••••••' : 'Password'}
                  placeholderTextColor={COLORS.textSecondary}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  style={styles.input}
                  textAlign={isRTL ? 'right' : 'left'}
                  returnKeyType={pwSub === 'signin' ? 'send' : 'done'}
                  onSubmitEditing={() => !loading && submitPassword()}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={isRTL ? 'إظهار/إخفاء كلمة المرور' : 'Show/hide password'}
                  style={{ paddingHorizontal: 10 }}
                >
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                onPress={submitPassword}
                disabled={loading}
                style={[styles.btn, { backgroundColor: COLORS.primary, opacity: loading ? 0.55 : 1 }]}
                accessibilityRole="button"
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : (
                    <Text style={styles.btnText}>
                      {pwSub === 'signin'
                        ? (isRTL ? 'دخول' : 'Sign in')
                        : (isRTL ? 'إنشاء حساب' : 'Create account')}
                    </Text>
                  )}
              </TouchableOpacity>

              {pwSub === 'signin' && (
                <TouchableOpacity
                  onPress={() => router.push('/forgot-password')}
                  accessibilityRole="button"
                  style={{ marginTop: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: COLORS.primary, fontSize: 13, fontWeight: '700' }}>
                    {isRTL ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
            </Animated.View>
          </ScrollView>
        </TouchableWithoutFeedback>
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
    content: { flex: 1, padding: SPACING.lg, gap: 12 },

    segment: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.lg,
      padding: 4,
      gap: 4,
      marginBottom: 4,
    },
    segmentBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: BORDER_RADIUS.md,
      alignItems: 'center',
    },
    segmentText: { fontSize: 13.5, fontWeight: '700' },

    subSegment: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      borderWidth: 1,
      borderRadius: BORDER_RADIUS.md,
      padding: 3,
      gap: 4,
      marginTop: 2,
      marginBottom: 6,
    },
    subSegmentBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: BORDER_RADIUS.sm,
      alignItems: 'center',
    },
    subSegmentText: { fontSize: 12.5, fontWeight: '700' },

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
      fontSize: 14, color: C.textSecondary, lineHeight: 22,
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
    inputRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderRadius: BORDER_RADIUS.lg,
      overflow: 'hidden',
      backgroundColor: C.card,
    },
    input: { flex: 1, padding: 16, fontSize: 16, color: C.text },

    otpBox: {
      width: 42, height: 56,
      borderWidth: 1.5,
      borderRadius: BORDER_RADIUS.md,
      alignItems: 'center', justifyContent: 'center',
    },
    otpBoxText: { fontSize: 22, fontWeight: '800' },
    hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },

    expiry: { color: C.textSecondary, fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 4 },

    btn: {
      paddingVertical: 16,
      borderRadius: BORDER_RADIUS.lg,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 56,
      marginTop: 6,
    },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },

    resend: { fontWeight: '700', fontSize: 13.5, textAlign: 'center', marginTop: 6 },
    resendDisabled: { color: C.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 6 },

    errorText: {
      color: C.error,
      fontSize: 13,
      fontWeight: '600',
      textAlign: isRTL ? 'right' : 'left',
      writingDirection: isRTL ? 'rtl' : 'ltr',
      marginTop: 2,
    },
  });
