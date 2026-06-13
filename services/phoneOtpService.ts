import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import { normalizeSaudiPhone } from '../utils/validation';

// Dev-only OTP fallback allowlist. Set EXPO_PUBLIC_DEV_OTP_PHONE in your
// local .env (NEVER commit) to a normalized E.164 number when you want a
// specific tester to bypass real SMS in development. The variable is
// only read while __DEV__ is true; production builds ignore it.
const DEV_ALLOWLISTED_PHONE_RAW =
  (process.env.EXPO_PUBLIC_DEV_OTP_PHONE as string | undefined) || '';
const DEV_ALLOWLISTED_PHONE = DEV_ALLOWLISTED_PHONE_RAW
  ? (() => {
      try {
        return normalizeSaudiPhone(DEV_ALLOWLISTED_PHONE_RAW);
      } catch {
        return '';
      }
    })()
  : '';

// 6-digit phone OTP, 5-minute expiry, resend supported.
//
// Talks to two edge functions:
//   - send-phone-otp   → generates code, dispatches SMS, stores hash in DB
//   - verify-phone-otp → validates code and returns a magic-link token_hash
//                        the mobile client converts into a Supabase session

export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 5 * 60;
export const RESEND_COOLDOWN_SECONDS = 30;

const withTimeout = <T>(p: PromiseLike<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms)),
  ]);

/**
 * Pull the server-supplied error key out of a Supabase Edge Functions
 * response. Async because supabase-js v2 surfaces non-2xx replies as a
 * `FunctionsHttpError` whose `.context` is a real `Response` object —
 * the JSON body has to be read with `await ctx.json()` / `ctx.text()`,
 * never accessed as `.body` synchronously. Without this, every error
 * just surfaces as the SDK's generic "Edge Function returned a non-2xx
 * status code" string and the user never sees the real reason
 * (`wrong_code`, `too_many_attempts`, etc.).
 */
const extractError = async (data: any, error: any): Promise<string | undefined> => {
  let serverMsg: string | undefined = data?.error;
  if (serverMsg || !error) return serverMsg;

  // 1) supabase-js v2 — `error.context` is a Response (or Response-like).
  const ctx: any = (error as any).context;
  if (ctx) {
    if (typeof ctx.json === 'function') {
      try {
        const parsed = await ctx.clone().json();
        if (parsed?.error) return parsed.error;
      } catch {}
    }
    if (typeof ctx.text === 'function') {
      try {
        const txt = await ctx.clone().text();
        if (txt) {
          try {
            const parsed = JSON.parse(txt);
            if (parsed?.error) return parsed.error;
          } catch {
            // Body wasn't JSON — fall through to other paths below.
          }
        }
      } catch {}
    }
    // 2) Legacy / older SDK shape — `context.body` was a string or object.
    if (ctx.body) {
      try {
        const parsed = typeof ctx.body === 'string' ? JSON.parse(ctx.body) : ctx.body;
        if (parsed?.error) return parsed.error;
      } catch {}
    }
  }

  // 3) Last resort — the raw SDK message. If we get here we couldn't pull
  // a server-provided key, so surface a translatable fallback instead of
  // the unfriendly "Edge Function returned a non-2xx status code".
  if (/non-2xx/i.test(error.message ?? '')) return 'token_failed';
  return error.message;
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
 * Dev OTP fallback — allowlist of ONE phone (the admin/dev tester)
 *
 * Until a real SMS provider is wired, this fallback lets the single
 * allowlisted phone sign in without a code. Every other phone is
 * rejected with a clear error so we never:
 *   • silently sign someone into a shared account, or
 *   • overwrite an existing profile row with a stranger's phone.
 *
 * The allowlisted phone is the same as the admin phone — see
 * constants/admin.ts. Production EAS builds skip this path entirely
 * (`__DEV__` is false). Remove the fallback once a real SMS provider
 * is live and the edge function is returning real codes.
 * ──────────────────────────────────────────────────────────────────── */

const DEV_FALLBACK_CODE = '0000';
let _pendingDevPhone: string | null = null;

/** Pre-created auth user that the allowlisted phone signs into. Read
 *  from env so no credentials are baked into the shipped bundle. The
 *  dev fallback only engages when ALL of EXPO_PUBLIC_DEV_OTP_PHONE,
 *  EXPO_PUBLIC_DEV_OTP_EMAIL and EXPO_PUBLIC_DEV_OTP_PASSWORD are set
 *  (and __DEV__ is true). Missing any one → fallback is disabled and
 *  the user is told SMS is not configured. */
const DEV_ADMIN_EMAIL = (process.env.EXPO_PUBLIC_DEV_OTP_EMAIL as string | undefined) || '';
const DEV_ADMIN_PASSWORD = (process.env.EXPO_PUBLIC_DEV_OTP_PASSWORD as string | undefined) || '';
const DEV_FALLBACK_ENABLED =
  !!__DEV__ && !!DEV_ALLOWLISTED_PHONE && !!DEV_ADMIN_EMAIL && !!DEV_ADMIN_PASSWORD;

/** Friendly error key for any non-allowlisted phone in dev fallback. */
const NOT_ALLOWLISTED_AR =
  'تسجيل الدخول التجريبي مُتاح فقط لرقم المدير. اربط مزوّد رسائل SMS لتفعيل الدخول لباقي الأرقام.';
const NOT_ALLOWLISTED_EN =
  'Dev sign-in is restricted to the admin phone. Wire an SMS provider to allow other numbers.';

const notAllowlistedError = (lang: 'ar' | 'en') =>
  new Error(lang === 'ar' ? NOT_ALLOWLISTED_AR : NOT_ALLOWLISTED_EN);

/** Client-side dev sign-in. Only runs for the allowlisted phone; never
 *  touches a shared account and never patches the phone column. */
const devFallbackVerify = async (phone: string, lang: 'ar' | 'en'): Promise<boolean> => {
  if (!DEV_FALLBACK_ENABLED || phone !== DEV_ALLOWLISTED_PHONE) {
    // Defensive — sendPhoneOtp also gates this, so we should never get
    // here for a non-allowlisted phone. Bail without signing anyone in.
    _pendingDevPhone = null;
    throw notAllowlistedError(lang);
  }
  const signIn = await supabase.auth.signInWithPassword({
    email: DEV_ADMIN_EMAIL,
    password: DEV_ADMIN_PASSWORD,
  });
  if (signIn.error || !signIn.data?.user) {
    logger.warn(
      'dev OTP fallback: admin-account sign-in failed. The dev password ' +
        'may have been rotated. Re-run the password reset SQL from ' +
        'supabase/SETUP_DEV_OTP.md.',
      signIn.error
    );
    throw new Error(friendly('token_failed', lang));
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
    const msg = await extractError(data, error);
    if (msg) {
      logger.warn('send-phone-otp failed', msg);
      throw new Error(friendly(msg, lang));
    }
    const devCode = (data as any)?.dev_code as string | undefined;
    const devFlag = (data as any)?.dev === true;
    // Trust the edge function's success response. If it returns
    // `{ ok: true }` without `dev_code`, the SMS provider (Authentica)
    // dispatched a real code over SMS — the user enters that code. The
    // client-side dev fallback is ONLY engaged when the edge function
    // itself explicitly signals dev mode (`dev: true`) or returns a
    // `dev_code` (legacy shape) AND the allowlist matches.
    if (__DEV__ && devFlag && !devCode) {
      if (!DEV_FALLBACK_ENABLED || phone !== DEV_ALLOWLISTED_PHONE) {
        throw notAllowlistedError(lang);
      }
      _pendingDevPhone = phone;
      return {
        expiresIn: (data as any)?.expires_in ?? OTP_TTL_SECONDS,
        devCode: DEV_FALLBACK_CODE,
      };
    }
    return {
      expiresIn: (data as any)?.expires_in ?? OTP_TTL_SECONDS,
      devCode,
    };
  } catch (e) {
    // Edge function unreachable / errored — in dev, fall back to the
    // fixed code only for the allowlisted admin phone. Other numbers
    // surface the real error so we never silently sign them into the
    // dev account.
    // Only the explicitly env-configured dev tester can fall through to
    // the offline fallback. Real users — including the admin — must see
    // the underlying network error so they can retry once the edge
    // function or Authentica recovers.
    if (DEV_FALLBACK_ENABLED && phone === DEV_ALLOWLISTED_PHONE) {
      logger.warn(
        'send-phone-otp dev fallback engaged (offline) for the env-configured dev tester.',
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
    const msg = await extractError(data, error);
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
    // fallback code in dev still routes through the client sign-in
    // — but only for the allowlisted admin phone, never anyone else.
    if (DEV_FALLBACK_ENABLED && code === DEV_FALLBACK_CODE && phone === DEV_ALLOWLISTED_PHONE) {
      logger.warn('verify-phone-otp dev fallback (post-error)', e);
      return devFallbackVerify(phone, lang);
    }
    throw e;
  }
};
