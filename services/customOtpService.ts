import { logger } from '../utils/logger';
import { callEdgeFunction } from './edgeInvoke';
import { verifyMagicLinkOtp } from './authXhr';

export type OtpPurpose = 'login' | 'verify_email' | 'reset_password';

export const sendOtp = async (
  email: string,
  purpose: OtpPurpose = 'login',
  lang: 'ar' | 'en' = 'ar'
): Promise<void> => {
  const { errorMessage } = await callEdgeFunction('send-otp', { email, purpose, lang });
  if (errorMessage) {
    logger.warn('send-otp failed', errorMessage);
    if (/can only send testing emails|verify a domain|sandbox/i.test(errorMessage)) {
      throw new Error(
        lang === 'ar'
          ? 'خدمة البريد قيد الإعداد. الرجاء استخدام البريد الإلكتروني وكلمة المرور أو التواصل مع الدعم.'
          : 'Email service is being set up. Please use email + password instead, or contact support.'
      );
    }
    throw new Error(errorMessage);
  }
};

/**
 * Verify code and create a Supabase session (creates user if new).
 * Returns true on success — supabase auth state is now signed in.
 */
export const verifyOtp = async (
  email: string,
  code: string,
  purpose: OtpPurpose = 'login'
): Promise<boolean> => {
  const { data, errorMessage } = await callEdgeFunction<{
    ok?: boolean;
    token_hash?: string;
  }>('verify-otp', { email, code, purpose });
  if (errorMessage) {
    throw new Error(errorMessage);
  }
  if (!data?.ok || !data.token_hash) {
    throw new Error('Verification failed');
  }
  await verifyMagicLinkOtp(data.token_hash, 'magiclink');
  return true;
};
