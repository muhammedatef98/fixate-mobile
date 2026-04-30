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
  if (error) {
    logger.error('send-otp invoke error', error);
    throw new Error((data as any)?.error || error.message);
  }
  if ((data as any)?.error) {
    throw new Error((data as any).error);
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
