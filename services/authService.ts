import { supabase } from './supabaseClient';

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

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'customer' | 'technician';
  avatar_url?: string;
  created_at?: string;
}

/**
 * Sign up with email and password
 */
export const signUpWithPhoneOrEmail = async (data: SignUpData) => {
  try {
    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          name: data.name,
          phone: data.phone,
          role: data.role || 'customer',
        },
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create user');

    // 2. Create user profile
    const { error: profileError } = await supabase.from('users').insert({
      id: authData.user.id,
      email: data.email,
      name: data.name,
      phone: data.phone,
      role: data.role || 'customer',
    });

    if (profileError) throw profileError;

    return { user: authData.user, session: authData.session };
  } catch (error: any) {
    console.error('Sign up error:', error);
    throw error;
  }
};

/**
 * Login with email and password
 */
export const loginWithPhoneOrEmail = async (data: LoginData) => {
  try {
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) throw error;

    return { user: authData.user, session: authData.session };
  } catch (error: any) {
    console.error('Login error:', error);
    throw error;
  }
};

/**
 * Logout current user
 */
export const logout = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error: any) {
    console.error('Logout error:', error);
    throw error;
  }
};

/**
 * Get current authenticated user
 */
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error: any) {
    console.error('Get current user error:', error);
    return null;
  }
};

/**
 * Get current session
 */
export const getCurrentSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  } catch (error: any) {
    console.error('Get session error:', error);
    return null;
  }
};

/**
 * Update user profile
 */
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
    console.error('Update profile error:', error);
    throw error;
  }
};

/**
 * Listen to auth state changes
 */
export const onAuthStateChange = (callback: (event: string, session: any) => void) => {
  return supabase.auth.onAuthStateChange(callback);
};
