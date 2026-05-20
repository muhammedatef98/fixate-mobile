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

// Pull the most informative message we can out of supabase-js's
// FunctionsHttpError. The shape changed between supabase-js versions:
//   - Older: error.context is the parsed body { error: '…' }
//   - Newer: error.context is the raw Response; body has to be read
//            asynchronously. We handle both, plus fall back to the
//            status + statusText so the user never just sees the
//            opaque "Edge Function returned a non-2xx status code".
const extractError = async (data: any, error: any): Promise<string | undefined> => {
  if (data?.error) return data.error;
  if (!error) return undefined;

  // Case 1: error.context already has a parsed body.
  const ctx: any = (error as any).context;
  if (ctx && !(ctx instanceof Response)) {
    try {
      const parsed = typeof ctx.body === 'string' ? JSON.parse(ctx.body) : ctx.body;
      if (parsed?.error) return parsed.error;
    } catch {
      // fall through
    }
  }

  // Case 2: error.context is a Response (supabase-js v2). Read the
  // body once and try to parse it.
  if (ctx instanceof Response) {
    try {
      const text = await ctx.text();
      try {
        const parsed = JSON.parse(text);
        if (parsed?.error) return parsed.error;
      } catch {
        // body isn't JSON — return raw text capped to keep alerts sane.
      }
      const head = text.slice(0, 200).trim();
      const statusBit = `${ctx.status}${ctx.statusText ? ` ${ctx.statusText}` : ''}`;
      return head ? `${statusBit} — ${head}` : statusBit;
    } catch {
      // body already consumed / unreadable
    }
  }

  return error.message || 'unknown_error';
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
  const table = lang === 'ar' ? ar : en;
  if (!key) return lang === 'ar' ? 'حدث خطأ غير متوقع' : 'Unknown error';
  // Known short codes get the localised string; anything else is shown
  // verbatim so the admin/user can actually diagnose the failure
  // ("Edge Function returned a non-2xx status code — 500 …" etc).
  return table[key] ?? key;
};

export const sendPhoneOtp = async (
  rawPhone: string,
  lang: 'ar' | 'en' = 'ar'
): Promise<{ expiresIn: number; devCode?: string }> => {
  const phone = normalizeSaudiPhone(rawPhone);
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
  return {
    expiresIn: (data as any)?.expires_in ?? OTP_TTL_SECONDS,
    // Present only while no real SMS provider is configured (dev mode).
    devCode: (data as any)?.dev_code,
  };
};

export const verifyPhoneOtp = async (
  rawPhone: string,
  code: string,
  lang: 'ar' | 'en' = 'ar'
): Promise<boolean> => {
  const phone = normalizeSaudiPhone(rawPhone);
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
};
