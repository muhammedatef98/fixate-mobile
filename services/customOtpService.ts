import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

export type OtpPurpose = 'login' | 'verify_email' | 'reset_password';

export const sendOtp = async (
  email: string,
  purpose: OtpPurpose = 'login',
  lang: 'ar' | 'en' = 'ar'
): Promise<void> => {
  const { data, error } = await supabase.functions.invoke('send-otp', {
    body: { email, purpose, lang },
  });

  // Pull the server-side error string out of either the function response
  // body or the Edge function context, then translate the most common
  // Resend sandbox failure ("can only send to your own email address") into
  // a friendly bilingual message so users in test mode aren't confused.
  let serverMsg: string | undefined = (data as any)?.error;
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

  if (serverMsg) {
    logger.warn('send-otp failed', serverMsg);
    if (/can only send testing emails|verify a domain|sandbox/i.test(serverMsg)) {
      throw new Error(
        lang === 'ar'
          ? 'خدمة البريد قيد الإعداد. الرجاء استخدام البريد الإلكتروني وكلمة المرور أو التواصل مع الدعم.'
          : 'Email service is being set up. Please use email + password instead, or contact support.'
      );
    }
    throw new Error(serverMsg);
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
  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean;
    token_hash?: string;
    error?: string;
  }>('verify-otp', { body: { email, code, purpose } });
  if (error) {
    throw new Error((data as any)?.error || error.message);
  }
  if (!data?.ok || !data.token_hash) {
    throw new Error(data?.error || 'Verification failed');
  }
  // Establish a real session from the magic-link token_hash
  const { error: vErr } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: data.token_hash,
  });
  if (vErr) throw vErr;
  return true;
};
