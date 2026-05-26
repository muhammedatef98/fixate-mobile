import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import { normalizeSaudiPhone } from '../utils/validation';

// 4-digit phone OTP, 5-minute expiry, resend supported.
//
// Talks to two edge functions:
//   - send-phone-otp   → generates code, dispatches SMS, stores hash in DB
//   - verify-phone-otp → validates code and returns a magic-link token_hash
//                        the mobile client converts into a Supabase session

export const OTP_LENGTH = 4;
export const OTP_TTL_SECONDS = 5 * 60;
export const RESEND_COOLDOWN_SECONDS = 30;

const withTimeout = <T>(p: PromiseLike<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    ),
  ]);

const extractError = (data: any, error: any): string | undefined => {
  let serverMsg: string | undefined = data?.error;
  if (!serverMsg && error) {
    try {
      const ctx: any = (error as any).context;
      if (ctx?.body) {
        const parsed = typeof ctx.body === 'string' ? JSON.parse(ctx.body) : ctx.body;
        serverMsg = parsed?.error;
      }
    } catch {}
    serverMsg = serverMsg || error.message;
  }
  return serverMsg;
};

const friendly = (key: string | undefined, lang: 'ar' | 'en') => {
  const ar: Record<string, string> = {
    invalid_phone: 'رقم الجوال غير صحيح',
    cooldown: 'الرجاء الانتظار قبل إعادة إرسال الكود',
    storage_failed: 'تعذر إرسال الكود، حاول مرة أخرى',
    invalid_input: 'بيانات غير صحيحة',
    otp_not_found_or_expired: 'الكود غير صالح أو انتهت صلاحيته',
    too_many_attempts: 'تم تجاوز عدد المحاولات، اطلب كوداً جديداً',
    wrong_code: 'الكود غير صحيح',
    user_create_failed: 'تعذر إنشاء الحساب',
    token_failed: 'تعذر إنشاء الجلسة',
  };
  const en: Record<string, string> = {
    invalid_phone: 'Invalid phone number',
    cooldown: 'Please wait before requesting another code',
    storage_failed: 'Could not send the code, please try again',
    invalid_input: 'Invalid input',
    otp_not_found_or_expired: 'The code is invalid or has expired',
    too_many_attempts: 'Too many attempts, request a new code',
    wrong_code: 'Wrong code',
    user_create_failed: 'Could not create the account',
    token_failed: 'Could not create the session',
  };
  return (lang === 'ar' ? ar : en)[key ?? ''] ?? key ?? 'Unknown error';
};

/* ────────────────────────────────────────────────────────────────────
 * Dev OTP auto-fill (temporary — until a real SMS provider is wired)
 *
 * Until you subscribe to a real SMS provider (Brevo, Twilio, etc.)
 * the edge function can't deliver a code. To keep the sign-in flow
 * usable in development, the helpers below transparently fall back to:
 *   • returning a fixed devCode "0000" from sendPhoneOtp when the edge
 *     function fails or doesn't include a dev_code in its response.
 *   • signing in with a synthetic email/password derived from the
 *     phone when verifyPhoneOtp is called with the fallback code.
 *
 * Both branches are wrapped in `__DEV__` so a real production EAS
 * build never activates this path. Remove this whole block once a
 * real SMS provider is live and the edge function is returning a
 * real code.
 *
 * Requirements (Supabase project settings):
 *   – "Confirm email" should be OFF on the Email provider
 *     (Auth → Providers → Email → Confirm email). This is the common
 *     dev default. Without it, signUp returns a user but no session.
 * ──────────────────────────────────────────────────────────────────── */

const DEV_FALLBACK_CODE = '0000';
let _pendingDevPhone: string | null = null;

/**
 * Shared dev login account.
 *
 * This is a real, pre-created Supabase auth user with email_confirmed_at
 * set and a known bcrypt password — the schema was prepared via SQL so
 * the client doesn't have to call signUp() (which is unreliable on
 * projects with "Confirm email" on, signups disabled, or pre-existing
 * synthetic-email users that block re-signup).
 *
 * Every dev OTP sign-in lands on this single user regardless of the
 * phone the developer typed. We then UPSERT the entered phone onto
 * the user's public.users row so the rest of the app reads a usable
 * profile.
 *
 * To rotate: run the same UPDATE auth.users / auth.identities
 * statements you ran when this was first set up, with a new
 * encrypted_password / DEV_SHARED_PASSWORD pair.
 *
 * Production builds (`__DEV__` is false) never reach this code path —
 * the edge function path remains the only sign-in route.
 */
const DEV_SHARED_EMAIL = '966593343812@phone.fixate.local';
const DEV_SHARED_PASSWORD = 'fixate-dev-2026-shared';

/** Client-side dev sign-in: just signInWithPassword against the
 *  shared dev account. No signUp involved → no dependency on the
 *  project's "Confirm email" toggle or anonymous sign-in setting. */
const devFallbackVerify = async (phone: string, lang: 'ar' | 'en'): Promise<boolean> => {
  const signIn = await supabase.auth.signInWithPassword({
    email: DEV_SHARED_EMAIL,
    password: DEV_SHARED_PASSWORD,
  });
  if (signIn.error || !signIn.data?.user) {
    logger.warn(
      'dev OTP fallback: shared-account sign-in failed. The dev login ' +
        'account may have been rotated. Re-run the auth.users password ' +
        'reset SQL from supabase/SETUP_DEV_OTP.md.',
      signIn.error
    );
    throw new Error(friendly('token_failed', lang));
  }

  // Patch the entered phone onto the shared user's profile so screens
  // that read the customer phone show what the developer typed during
  // this session. Best-effort; never blocks login.
  try {
    await supabase
      .from('users')
      .upsert(
        { id: signIn.data.user.id, phone },
        { onConflict: 'id' }
      );
  } catch (patchErr) {
    logger.warn('dev OTP fallback: users-row patch failed (non-blocking)', patchErr);
  }

  _pendingDevPhone = null;
  return true;
};

export const sendPhoneOtp = async (
  rawPhone: string,
  lang: 'ar' | 'en' = 'ar'
): Promise<{ expiresIn: number; devCode?: string }> => {
  const phone = normalizeSaudiPhone(rawPhone);
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke('send-phone-otp', { body: { phone, lang } }),
      20000,
      'send-phone-otp'
    );
    const msg = extractError(data, error);
    if (msg) {
      logger.warn('send-phone-otp failed', msg);
      throw new Error(friendly(msg, lang));
    }
    const devCode = (data as any)?.dev_code as string | undefined;
    // Edge function succeeded but didn't include a code (no SMS
    // provider configured server-side either). Engage the client-side
    // fallback so the UI still auto-fills.
    if (__DEV__ && !devCode) {
      _pendingDevPhone = phone;
      return { expiresIn: (data as any)?.expires_in ?? OTP_TTL_SECONDS, devCode: DEV_FALLBACK_CODE };
    }
    return {
      expiresIn: (data as any)?.expires_in ?? OTP_TTL_SECONDS,
      devCode,
    };
  } catch (e) {
    // Edge function unreachable / errored — in dev, fall back to the
    // fixed code so the developer can still sign in.
    if (__DEV__) {
      logger.warn(
        'send-phone-otp dev fallback engaged. Configure an SMS provider ' +
          'and deploy the edge function to dispatch real codes.',
        e
      );
      _pendingDevPhone = phone;
      return { expiresIn: OTP_TTL_SECONDS, devCode: DEV_FALLBACK_CODE };
    }
    throw e;
  }
};

export const verifyPhoneOtp = async (
  rawPhone: string,
  code: string,
  lang: 'ar' | 'en' = 'ar'
): Promise<boolean> => {
  const phone = normalizeSaudiPhone(rawPhone);

  // Dev fallback path: when the matching phone engaged the fallback
  // in `sendPhoneOtp`, the user submitted the fixed code → sign in
  // client-side without touching the edge function.
  if (__DEV__ && code === DEV_FALLBACK_CODE && _pendingDevPhone === phone) {
    return devFallbackVerify(phone, lang);
  }

  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke<{ ok?: boolean; token_hash?: string; error?: string }>(
        'verify-phone-otp',
        { body: { phone, code } }
      ),
      20000,
      'verify-phone-otp'
    );
    const msg = extractError(data, error);
    if (msg) {
      logger.warn('verify-phone-otp failed', msg);
      throw new Error(friendly(msg, lang));
    }
    if (!data?.ok || !data.token_hash) {
      throw new Error(friendly('wrong_code', lang));
    }
    const { error: vErr } = await supabase.auth.verifyOtp({
      type: 'magiclink',
      token_hash: data.token_hash,
    });
    if (vErr) throw vErr;
    return true;
  } catch (e) {
    // Safety net: even if `_pendingDevPhone` was lost (e.g. the JS
    // bundle reloaded between send and verify), entering the
    // fallback code in dev still routes through the client sign-in.
    if (__DEV__ && code === DEV_FALLBACK_CODE) {
      logger.warn('verify-phone-otp dev fallback (post-error)', e);
      return devFallbackVerify(phone, lang);
    }
    throw e;
  }
};
