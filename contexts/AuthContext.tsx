import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabaseClient';
import * as authService from '../services/authService';
import * as userService from '../services/userService';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userProfile: userService.UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  login: (email: string, password: string) => Promise<'admin' | 'customer' | 'technician'>;
  signup: (data: authService.SignUpData) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<userService.UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Get initial session — fast path. Don't block on a profile fetch:
    // mark loading=false immediately so navigation is responsive, then
    // hydrate the profile in the background. A missing profile row is
    // tolerated (getUserProfile uses maybeSingle() and returns null).
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsAuthenticated(!!session);
      setLoading(false);

      if (session?.user) {
        userService
          .getUserProfile(session.user.id)
          .then(setUserProfile)
          .catch(() => undefined);
      }
    });

    // Listen for auth changes — set state synchronously, fetch profile in
    // background. If we awaited getUserProfile here a slow query would block
    // every subsequent auth event, including signOut().
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsAuthenticated(!!session);
      setLoading(false);

      if (session?.user) {
        userService
          .getUserProfile(session.user.id)
          .then(setUserProfile)
          .catch(() => undefined);
      } else {
        setUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    // Clear in-memory state first so the auth guard sees a logged-out user
    // immediately on the next render.
    setSession(null);
    setUser(null);
    setUserProfile(null);
    setIsAuthenticated(false);

    // Best-effort Supabase signOut (idempotent, never throws)
    try { await supabase.auth.signOut({ scope: 'local' }); } catch {}

    // Aggressively wipe every Supabase auth key from AsyncStorage so a
    // subsequent app reload cannot auto-restore the session.
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const authKeys = allKeys.filter(
        (k) => k.startsWith('sb-') || k.includes('supabase') || k.includes('auth-token')
      );
      if (authKeys.length) await AsyncStorage.multiRemove(authKeys);
    } catch {}
  };

  const deleteAccount = async () => {
    // Calls the delete-account Edge Function (uses service-role to remove the
    // auth.users row plus owned data). Server-side does the cascade; we just
    // sign out locally afterwards.
    const { error } = await supabase.functions.invoke('delete-account');
    if (error) throw error;
    await signOut();
  };

  // login resolves with the routing target so callers don't have to make a
  // second round-trip themselves. Order of preference:
  //   1. is_admin → '/admin'
  //   2. role === 'technician' → '/(technician)'
  //   3. fallback → '/(customer)'
  // The is_admin lookup hits the user's own row, which is allowed by the
  // existing "Users can view their own profile" RLS policy.
  const login = async (
    email: string,
    password: string
  ): Promise<'admin' | 'customer' | 'technician'> => {
    const { user } = await authService.loginWithPhoneOrEmail({ email, password });
    if (!user) return 'customer';

    // Belt-and-braces: read is_admin from BOTH the user_metadata (cheap,
    // attached to the auth response) and from public.users (canonical).
    // Either being true is enough — protects against the public.users
    // lookup failing on a flaky network.
    let isAdmin = (user.user_metadata as any)?.is_admin === true;
    let role: 'customer' | 'technician' =
      (user.user_metadata as any)?.role === 'technician' ? 'technician' : 'customer';

    try {
      const { data } = await supabase
        .from('users')
        .select('role, is_admin')
        .eq('id', user.id)
        .maybeSingle();
      if (data) {
        if ((data as any).is_admin === true) isAdmin = true;
        if ((data as any).role === 'technician') role = 'technician';
      }
    } catch {
      // user_metadata fallback already applied above
    }

    return isAdmin ? 'admin' : role;
  };

  const signup = async (data: authService.SignUpData) => {
    const { user } = await authService.signUpWithPhoneOrEmail(data);
    if (user) {
      const profile = await userService.getUserProfile(user.id);
      setUserProfile(profile);
    }
  };

  const refreshUser = async () => {
    // Pull the latest auth user from the server. This bypasses the JWT
    // cached in AsyncStorage and picks up server-side mutations (most
    // importantly an email change that completed after the current token
    // was issued) without waiting for the next auto-refresh tick.
    try {
      const { data: { user: freshUser } } = await supabase.auth.getUser();
      if (freshUser) setUser(freshUser);
    } catch {
      // Non-fatal — fall through to the public profile refresh below.
    }

    // Re-fetch the public.users row (existing behaviour, unchanged).
    if (user) {
      const profile = await userService.getUserProfile(user.id);
      setUserProfile(profile);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, userProfile, loading, isAuthenticated, signOut, deleteAccount, login, signup, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
