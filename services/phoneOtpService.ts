import { logger } from '../utils/logger';
import { normalizeSaudiPhone } from '../utils/validation';
import { callEdgeFunction } from './edgeInvoke';
import { verifyMagicLinkOtp } from './authXhr';

export const OTP_LENGTH = 4;
export const OTP_TTL_SECONDS = 5 * 60;
export const RESEND_COOLDOWN_SECONDS = 30;

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
  return table[key] ?? key;
};

export const sendPhoneOtp = async (
  rawPhone: string,
  lang: 'ar' | 'en' = 'ar'
): Promise<{ expiresIn: number; devCode?: string }> => {
  const phone = normalizeSaudiPhone(rawPhone);
  const { data, errorMessage } = await callEdgeFunction<{
    expires_in?: number;
    dev_code?: string;
  }>('send-phone-otp', { phone, lang });
  if (errorMessage) {
    logger.warn('send-phone-otp failed', errorMessage);
    throw new Error(friendly(errorMessage, lang));
  }
  return {
    expiresIn: data?.expires_in ?? OTP_TTL_SECONDS,
    devCode: data?.dev_code,
  };
};

export const verifyPhoneOtp = async (
  rawPhone: string,
  code: string,
  lang: 'ar' | 'en' = 'ar'
): Promise<boolean> => {
  const phone = normalizeSaudiPhone(rawPhone);
  const { data, errorMessage } = await callEdgeFunction<{
    ok?: boolean;
    token_hash?: string;
  }>('verify-phone-otp', { phone, code });
  if (errorMessage) {
    logger.warn('verify-phone-otp failed', errorMessage);
    throw new Error(friendly(errorMessage, lang));
  }
  if (!data?.ok || !data?.token_hash) {
    throw new Error(friendly('wrong_code', lang));
  }
  // XHR-based verify avoids the RN Blob bug that breaks
  // supabase.auth.verifyOtp on iOS after a context reload.
  await verifyMagicLinkOtp(data.token_hash, 'magiclink');
  return true;
};
