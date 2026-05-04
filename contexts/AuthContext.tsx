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
  login: (email: string, password: string) => Promise<void>;
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
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsAuthenticated(!!session);

      if (session?.user) {
        const profile = await userService.getUserProfile(session.user.id);
        setUserProfile(profile);

        // If the JWT is still valid locally but the auth.users row was
        // wiped on the server (DB reset, account deleted from another
        // device), the next supabase.auth.getUser() call returns no user.
        // Treat that as a hard logout so the app doesn't sit on a stale
        // session and spam profile-not-found errors.
        if (!profile) {
          const { data: { user: serverUser } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } as any }));
          if (!serverUser) {
            await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
            setSession(null);
            setUser(null);
            setIsAuthenticated(false);
          }
        }
      }

      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsAuthenticated(!!session);
      
      if (session?.user) {
        const profile = await userService.getUserProfile(session.user.id);
        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
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

  const login = async (email: string, password: string) => {
    const { user } = await authService.loginWithPhoneOrEmail({ email, password });
    if (user) {
      const profile = await userService.getUserProfile(user.id);
      setUserProfile(profile);
    }
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
