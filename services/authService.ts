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

export const signUpWithPhoneOrEmail = async (data: SignUpData) => {
  assertValidSignUp(data);
  const normalizedPhone = data.phone ? normalizeSaudiPhone(data.phone) : undefined;
  const email = data.email.trim().toLowerCase();
  const name = data.name.trim();
  const role = data.role || 'customer';

  try {
    // Route signup through the `signup` Edge Function. It uses the service
    // role to admin.createUser({ email_confirm: true }) — bypassing the
    // "Error sending confirmation email" failure when project SMTP isn't
    // configured. The Edge Function also upserts the public.users row as
    // a defence in depth in case the handle_new_user trigger is missing.
    const { data: fnData, error: fnError } = await supabase.functions.invoke('signup', {
      body: { email, password: data.password, name, phone: normalizedPhone, role },
    });

    if (fnError) {
      // supabase.functions.invoke wraps non-2xx responses; pull the real
      // server-side message out of context.body when present.
      let serverMsg: string | undefined;
      try {
        const ctx: any = (fnError as any).context;
        if (ctx?.body) {
          const parsed = typeof ctx.body === 'string' ? JSON.parse(ctx.body) : ctx.body;
          serverMsg = parsed?.error;
        }
      } catch {}
      throw new Error(serverMsg || fnError.message || 'Sign up failed');
    }
    if (fnData?.error) throw new Error(fnData.error);

    // Account created and confirmed — sign in immediately so the client has
    // a session in hand without round-tripping through email verification.
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: data.password,
    });
    if (signInError) throw signInError;

    return { user: signInData.user, session: signInData.session };
  } catch (error: any) {
    logger.error('Sign up error', error);
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
    logger.error('Login error', error);
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
    logger.error('Password reset error', error);
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
