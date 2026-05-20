import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import { validateEmail, validatePassword, validateName, normalizeSaudiPhone, validatePhone } from '../utils/validation';
import { callEdgeFunction } from './edgeInvoke';
import { signInWithPasswordXhr } from './authXhr';

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

export const signUpWithPhoneOrEmail = async (data: SignUpData) => {
  assertValidSignUp(data);
  const normalizedPhone = data.phone ? normalizeSaudiPhone(data.phone) : undefined;
  const email = data.email.trim().toLowerCase();
  const name = data.name.trim();
  const role = data.role || 'customer';

  try {
    // Route signup through the `signup` Edge Function via plain fetch
    // (NOT supabase.functions.invoke). On React Native the invoke path
    // can fail with "Unable to resolve data for blob: …" because the
    // body is staged through the Blob module; plain fetch avoids that.
    const { errorMessage } = await callEdgeFunction('signup', {
      email, password: data.password, name, phone: normalizedPhone, role,
    });
    if (errorMessage) {
      throw new Error(errorMessage);
    }

    // Account created and confirmed — sign in immediately so the client has
    // a session in hand. Routed through XHR to dodge the RN Blob bug.
    const { user } = await signInWithPasswordXhr(email, data.password);
    const { data: sess } = await supabase.auth.getSession();
    return { user, session: sess.session };
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
    const { user } = await signInWithPasswordXhr(
      data.email.trim().toLowerCase(),
      data.password
    );
    const { data: sess } = await supabase.auth.getSession();
    return { user, session: sess.session };
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
