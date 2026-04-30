import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
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
    await authService.logout();
    // Forcibly clear in-memory auth state in case onAuthStateChange
    // doesn't fire (e.g. with scope:'local' or on transient network failure).
    // Without this the auth guard would still see user as logged-in and
    // immediately route the customer back to /(customer) or /(technician).
    setSession(null);
    setUser(null);
    setUserProfile(null);
    setIsAuthenticated(false);
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
    <AuthContext.Provider value={{ session, user, userProfile, loading, isAuthenticated, signOut, login, signup, refreshUser }}>
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
