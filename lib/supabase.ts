import 'react-native-url-polyfill/auto';
// Single shared Supabase client — re-export so existing imports keep working
// while only one auth listener / one in-memory session exists app-wide.
export { supabase } from '../services/supabaseClient';
import { supabase } from '../services/supabaseClient';

// Database Types
export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'customer' | 'technician';
  avatar_url?: string;
  created_at: string;
}

// Helper Functions
export const auth = {
  // Sign up with email and password
  signUp: async (email: string, password: string, name: string, role: 'customer' | 'technician') => {
    // Route through the auto-confirming `signup` Edge Function so we don't
    // depend on Supabase project SMTP. The function uses the service-role
    // admin API to create a confirmed account, then we sign the user in.
    const cleanEmail = email.trim().toLowerCase();
    const { data: fnData, error: fnError } = await supabase.functions.invoke('signup', {
      body: { email: cleanEmail, password, name: name.trim(), role },
    });
    if (fnError) {
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

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    if (error) throw error;
    return data;
  },

  // Sign in with email and password
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  },

  // Sign out
  signOut: async () => {
    // scope:'local' clears the local session without requiring the server
    // session to still exist. This avoids "Auth session missing" errors
    // when the server-side row was already revoked.
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Even if Supabase fails, force-clear local state by signing out without scope
      await supabase.auth.signOut().catch(() => undefined);
    }
  },

  // Get current user
  getCurrentUser: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  // Get user profile by ID
  getUserProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    if (!data) throw new Error('User not found');

    return data as User;
  },
};
