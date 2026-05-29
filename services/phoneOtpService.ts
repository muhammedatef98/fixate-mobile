import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import { normalizeSaudiPhone } from '../utils/validation';

// Phone OTP login client, backed by Authentica via two edge functions:
//   - send-phone-otp   → triggers Authentica `POST /send-otp` (channel = sms)
//   - verify-phone-otp → validates the code with Authentica and returns a
//                        Supabase magic-link `token_hash` the client converts
//                        into a session.
//
// The function signatures here are stable so the login UI does not need to
// change when the OTP provider is swapped.

// Authentica issues 6-digit codes by default but the legacy provider used
// 4 digits. The UI binds to this constant for the per-digit input layout.
export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 10 * 60;
export const RESEND_COOLDOWN_SECONDS = 60;

const withTimeout = <T>(p: PromiseLike<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    ),
  ]);

// Pull an error key out of either the edge function's JSON body or the
// Supabase function client's wrapped error envelope.
const extractError = (data: unknown, error: unknown): string | undefined => {
  let key: string | undefined = (data as { error?: string } | null | undefined)?.error;
  if (!key && error) {
    try {
      const ctx = (error as { context?: { body?: unknown } }).context;
      if (ctx?.body) {
        const parsed =
          typeof ctx.body === 'string' ? JSON.parse(ctx.body) : (ctx.body as { error?: string });
        key = parsed?.error;
      }
    } catch {
      /* ignore */
    }
    key = key || (error as { message?: string }).message;
  }
  return key;
};

// Localised mapping from our small set of stable error keys to a user-facing
// string. Anything we don't know how to map falls through to the raw key so
// support can correlate logs with reports.
const friendly = (key: string | undefined, lang: 'ar' | 'en'): string => {
  const ar: Record<string, string> = {
    invalid_phone: 'رقم الجوال غير صحيح',
    invalid_input: 'بيانات غير صحيحة',
    cooldown: 'الرجاء الانتظار قبل إعادة إرسال الكود',
    storage_failed: 'تعذر إرسال الكود، حاول مرة أخرى',
    otp_not_found_or_expired: 'الكود غير صالح أو انتهت صلاحيته',
    too_many_attempts: 'تم تجاوز عدد المحاولات، حاول لاحقاً',
    wrong_code: 'الكود غير صحيح',
    user_create_failed: 'تعذر إنشاء الحساب',
    token_failed: 'تعذر إنشاء الجلسة',
  };
  const en: Record<string, string> = {
    invalid_phone: 'Invalid phone number',
    invalid_input: 'Invalid input',
    cooldown: 'Please wait before requesting another code',
    storage_failed: 'Could not send the code, please try again',
    otp_not_found_or_expired: 'The code is invalid or has expired',
    too_many_attempts: 'Too many attempts, please try again later',
    wrong_code: 'Wrong code',
    user_create_failed: 'Could not create the account',
    token_failed: 'Could not create the session',
  };
  return (lang === 'ar' ? ar : en)[key ?? ''] ?? key ?? 'Unknown error';
};

export interface SendPhoneOtpResult {
  expiresIn: number;
}

export const sendPhoneOtp = async (
  rawPhone: string,
  lang: 'ar' | 'en' = 'ar'
): Promise<SendPhoneOtpResult> => {
  const phone = normalizeSaudiPhone(rawPhone);
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke('send-phone-otp', { body: { phone, lang } }),
      20000,
      'send-phone-otp'
    );
    const key = extractError(data, error);
    if (key) {
      logger.warn('send-phone-otp failed', key);
      throw new Error(friendly(key, lang));
    }
    return {
      expiresIn:
        (data as { expires_in?: number } | null | undefined)?.expires_in ?? OTP_TTL_SECONDS,
    };
  } catch (e) {
    if (e instanceof Error && e.message) throw e;
    throw new Error(friendly('storage_failed', lang));
  }
};

export const verifyPhoneOtp = async (
  rawPhone: string,
  code: string,
  lang: 'ar' | 'en' = 'ar'
): Promise<boolean> => {
  const phone = normalizeSaudiPhone(rawPhone);
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke<{ ok?: boolean; token_hash?: string; error?: string }>(
        'verify-phone-otp',
        { body: { phone, code } }
      ),
      20000,
      'verify-phone-otp'
    );
    const key = extractError(data, error);
    if (key) {
      logger.warn('verify-phone-otp failed', key);
      throw new Error(friendly(key, lang));
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
    if (e instanceof Error && e.message) throw e;
    throw new Error(friendly('token_failed', lang));
  }
};
