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

// Stable error code thrown by signUpWithPhoneOrEmail when the email is
// already taken. Callers match on this exact message to offer the user a
// "sign in instead" affordance — see app/email-auth.tsx.
export const EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS';

// Stable error codes for strict role separation between customers and
// technicians. Thrown by assertExpectedRole below.
//
// WRONG_ROLE_TECHNICIAN  → a technician account hit a customer-only path
// WRONG_ROLE_CUSTOMER    → a customer account hit a technician-only path
export const WRONG_ROLE_TECHNICIAN = 'WRONG_ROLE_TECHNICIAN';
export const WRONG_ROLE_CUSTOMER = 'WRONG_ROLE_CUSTOMER';

/**
 * Confirm the freshly-signed-in user holds the expected role, otherwise
 * sign them out locally and throw a stable role-mismatch code. Canonical
 * source is public.users.role (set once at signup via handle_new_user and
 * locked from non-admin updates by the users_guard_role_columns trigger).
 * auth user_metadata is the fall-back when the public row hasn't been
 * fetched yet.
 *
 * Note: this is a routing concern, not a security boundary. The real
 * security boundary is RLS plus the role-update trigger (B-1).
 */
export const assertExpectedRole = async (
  userId: string,
  expected: 'customer' | 'technician',
): Promise<void> => {
  let role: string | null = null;
  try {
    const { data } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    role = ((data as any)?.role as string | null) ?? null;
  } catch {
    /* fall through to metadata */
  }

  if (!role) {
    try {
      const { data } = await supabase.auth.getUser();
      role =
        ((data.user?.user_metadata as any)?.role as string | null) ??
        ((data.user?.app_metadata as any)?.role as string | null) ??
        null;
    } catch {
      /* keep null */
    }
  }

  if (role && role !== expected) {
    // Drop the session locally so the UI can't accidentally route into
    // the wrong app surface on the next render.
    try { await supabase.auth.signOut({ scope: 'local' }); } catch {}
    if (expected === 'customer' && role === 'technician') {
      throw new Error(WRONG_ROLE_TECHNICIAN);
    }
    if (expected === 'technician' && role === 'customer') {
      throw new Error(WRONG_ROLE_CUSTOMER);
    }
  }
};

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

    // Duplicate-email detection (the common case Supabase makes awkward):
    // When "Confirm email" is ON, supabase.auth.signUp does NOT throw for
    // an already-registered email. It silently returns a fake user object
    // with an empty `identities` array and no real session, to avoid
    // leaking which emails are taken. Detect that and surface a stable
    // EMAIL_ALREADY_EXISTS code so the UI can offer "Sign in instead".
    //
    // When "Confirm email" is OFF, Supabase DOES throw "User already
    // registered" — handled in the catch below.
    if (!signUpError) {
      const identities = (signUpData?.user as any)?.identities;
      if (signUpData?.user && Array.isArray(identities) && identities.length === 0) {
        throw new Error(EMAIL_ALREADY_EXISTS);
      }
    }

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
    // Normalise the "Confirm email = OFF" Supabase error and the auth
    // server's other phrasings into the same stable code the UI matches.
    const raw = String(error?.message ?? '').toLowerCase();
    if (
      error?.message === EMAIL_ALREADY_EXISTS ||
      raw.includes('already registered') ||
      raw.includes('already exists') ||
      raw.includes('user already') ||
      error?.code === 'user_already_exists'
    ) {
      throw new Error(EMAIL_ALREADY_EXISTS);
    }
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
