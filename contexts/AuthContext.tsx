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
  login: (email: string, password: string) => Promise<'customer' | 'technician'>;
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

  const login = async (email: string, password: string): Promise<'customer' | 'technician'> => {
    // ONLY the auth call. No follow-up profile fetch — that was the source
    // of the "login button spins forever" symptom: a second Supabase round-
    // trip serialised behind the first, and any blip on the second one
    // would trap the spinner. The role comes from user_metadata (set at
    // signup), which arrives with the auth response itself. The profile
    // hydrates in the background via onAuthStateChange — by the time the
    // user reaches the home screen, userProfile in context is populated.
    const { user } = await authService.loginWithPhoneOrEmail({ email, password });
    const metaRole = (user?.user_metadata as any)?.role;
    return metaRole === 'technician' ? 'technician' : 'customer';
  };

  const signup = async (data: authService.SignUpData) => {
    const { user } = await authService.signUpWithPhoneOrEmail(data);
    if (user) {
      const profile = await userService.getUserProfile(user.id);
      setUserProfile(profile);
    }
  };

  const refreshUser = async () => {
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
