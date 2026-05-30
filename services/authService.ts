import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import { validateEmail, validatePassword, validateName, normalizeSaudiPhone, validatePhone } from '../utils/validation';

export interface SignUpData {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role?: 'customer' | 'technician';
}

export interface LoginData {
  email: string;
  password: string;
}

const assertValidSignUp = (data: SignUpData) => {
  if (!validateEmail(data.email)) {
    throw new Error('البريد الإلكتروني غير صحيح');
  }
  const passCheck = validatePassword(data.password);
  if (!passCheck.isValid) {
    throw new Error(passCheck.errors[0] || 'كلمة المرور ضعيفة');
  }
  const nameCheck = validateName(data.name);
  if (!nameCheck.valid) {
    throw new Error(nameCheck.message);
  }
  if (data.phone && !validatePhone(data.phone)) {
    throw new Error('رقم الجوال غير صحيح');
  }
};

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'customer' | 'technician';
  avatar_url?: string;
  is_admin?: boolean;
  created_at?: string;
}

export interface SignUpResult {
  user: import('@supabase/supabase-js').User | null;
  session: import('@supabase/supabase-js').Session | null;
  // true when Supabase requires email confirmation before signing the user
  // in. Callers MUST check this and route the user to the OTP confirmation
  // step instead of assuming they're signed in.
  requiresConfirmation: boolean;
}

export const signUpWithPhoneOrEmail = async (data: SignUpData): Promise<SignUpResult> => {
  assertValidSignUp(data);
  const normalizedPhone = data.phone ? normalizeSaudiPhone(data.phone) : undefined;
  const email = data.email.trim().toLowerCase();
  const name = data.name.trim();
  const role = data.role || 'customer';

  try {
    // Use Supabase Auth's native signUp so the project's "Confirm email"
    // setting + the "Confirm signup" template ({{ .Token }}) are honoured.
    // When confirmation is required Supabase returns session=null and
    // sends the OTP email; the caller routes the user to the OTP step.
    //
    // We deliberately do NOT use the legacy `signup` edge function here.
    // That path called admin.createUser({ email_confirm: true }) which
    // pre-confirms the email and bypasses verification entirely, then
    // immediately signInWithPassword to mint a session — the customer
    // never saw a confirmation code. The edge function is left in place
    // for any other caller that explicitly needs the bypass.
    //
    // Role flows through user_metadata. handle_new_user (M-3 hardening)
    // applies the ('customer','technician') whitelist server-side, so
    // tampering with raw_user_meta_data.role still resolves to 'customer'.
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: data.password,
      options: {
        data: {
          name,
          role,
          user_type: role,
          phone: normalizedPhone ?? null,
        },
      },
    });
    if (signUpError) throw signUpError;

    return {
      user: signUpData.user,
      session: signUpData.session,
      // session === null when "Confirm email" is enabled. Callers must
      // not auto-route the user into the app in that case.
      requiresConfirmation: signUpData.session === null,
    };
  } catch (error: any) {
    // Duplicate email / weak password are user-correctable, not real errors.
    logger.warn('Sign up failed', error);
    throw error;
  }
};

export const loginWithPhoneOrEmail = async (data: LoginData) => {
  if (!data.email?.trim() || !data.password) {
    throw new Error('البريد الإلكتروني وكلمة المرور مطلوبان');
  }

  try {
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email.trim().toLowerCase(),
      password: data.password,
    });

    if (error) throw error;

    return { user: authData.user, session: authData.session };
  } catch (error: any) {
    // Wrong-password / unknown-email is expected user input, not a bug.
    // Logging at warn keeps the dev red-overlay quiet while still leaving
    // a breadcrumb for debugging real auth failures.
    logger.warn('Login failed', error);
    throw error;
  }
};

export const sendPasswordReset = async (email: string) => {
  if (!validateEmail(email)) {
    throw new Error('البريد الإلكتروني غير صحيح');
  }
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    logger.warn('Password reset failed', error);
    throw error;
  }
};

export const updatePassword = async (newPassword: string) => {
  const passCheck = validatePassword(newPassword);
  if (!passCheck.isValid) {
    throw new Error(passCheck.errors[0] || 'كلمة المرور ضعيفة');
  }
  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    logger.error('Update password error', error);
    throw error;
  }
};

export const logout = async () => {
  try {
    // Always clear locally even if the server-side session is gone
    await supabase.auth.signOut({ scope: 'local' });
  } catch (error: any) {
    logger.error('Logout error (ignored, local session cleared)', error);
  }
};

export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error: any) {
    logger.error('Get current user error', error);
    return null;
  }
};

export const getCurrentSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  } catch (error: any) {
    logger.error('Get session error', error);
    return null;
  }
};

export const updateProfile = async (userId: string, updates: Partial<UserProfile>) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    logger.error('Update profile error', error);
    throw error;
  }
};

export const onAuthStateChange = (callback: (event: string, session: any) => void) => {
  return supabase.auth.onAuthStateChange(callback);
};
