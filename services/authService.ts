import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import {
  validateEmail,
  validatePassword,
  validateName,
  normalizeSaudiPhone,
  validatePhone,
} from '../utils/validation';
import { pwnedCount } from '../utils/pwnedPassword';

export interface SignUpData {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role?: 'customer' | 'technician' | 'courier';
}

export interface LoginData {
  email: string;
  password: string;
}

// Map raw Supabase auth errors to user-readable Arabic messages. Anything we
// don't recognize falls through with its original message so real bugs stay
// visible instead of hiding behind a generic string.
const AUTH_ERROR_MESSAGES: { match: RegExp; message: string }[] = [
  {
    match: /invalid login credentials|invalid_credentials/i,
    message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
  },
  {
    match: /email not confirmed/i,
    message: 'يرجى تأكيد بريدك الإلكتروني أولاً عبر الرابط المرسل إليك',
  },
  {
    match: /captcha/i,
    message:
      'تعذر تسجيل الدخول بسبب إعدادات الحماية في الخادم (CAPTCHA). يرجى المحاولة لاحقاً أو التواصل مع الدعم',
  },
  {
    match: /rate limit|too many requests/i,
    message: 'محاولات كثيرة خلال وقت قصير، يرجى الانتظار قليلاً ثم المحاولة مجدداً',
  },
  {
    match: /network request failed|fetch failed|timeout/i,
    message: 'تعذر الاتصال بالخادم، تأكد من اتصالك بالإنترنت',
  },
  {
    match: /user banned|user is banned/i,
    message: 'هذا الحساب موقوف، يرجى التواصل مع الدعم',
  },
];

const translateAuthError = (error: unknown): Error => {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const known = AUTH_ERROR_MESSAGES.find(({ match }) => match.test(raw));
  return known ? new Error(known.message) : (error instanceof Error ? error : new Error(raw));
};

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
  role: 'customer' | 'technician' | 'courier';
  avatar_url?: string;
  is_admin?: boolean;
  created_at?: string;
}

const LEAKED_PASSWORD_MESSAGE =
  'كلمة المرور هذه ظهرت في تسريبات بيانات معروفة — الرجاء اختيار كلمة مرور أخرى';

export const signUpWithPhoneOrEmail = async (data: SignUpData) => {
  assertValidSignUp(data);
  if ((await pwnedCount(data.password)) > 0) {
    throw new Error(LEAKED_PASSWORD_MESSAGE);
  }
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
      // supabase-js v2 surfaces non-2xx replies as a FunctionsHttpError
      // whose `.context` is a real Response object — the JSON body has
      // to be read via `ctx.json()` / `ctx.text()`. Without this we get
      // the SDK's generic "Edge Function returned a non-2xx status
      // code" and miss the real reason (email_already_exists, etc.).
      let serverMsg: string | undefined;
      const ctx: any = (fnError as any).context;
      if (ctx) {
        if (typeof ctx.json === 'function') {
          try {
            serverMsg = (await ctx.clone().json())?.error;
          } catch {}
        }
        if (!serverMsg && typeof ctx.text === 'function') {
          try {
            const txt = await ctx.clone().text();
            if (txt) {
              try {
                serverMsg = JSON.parse(txt)?.error;
              } catch {}
            }
          } catch {}
        }
        if (!serverMsg && ctx.body) {
          try {
            const parsed = typeof ctx.body === 'string' ? JSON.parse(ctx.body) : ctx.body;
            serverMsg = parsed?.error;
          } catch {}
        }
      }
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
    throw translateAuthError(error);
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
  if ((await pwnedCount(newPassword)) > 0) {
    throw new Error(LEAKED_PASSWORD_MESSAGE);
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
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error: any) {
    logger.error('Get current user error', error);
    return null;
  }
};

export const getCurrentSession = async () => {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
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
