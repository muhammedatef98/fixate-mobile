import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import * as authService from '../services/authService';
import * as userService from '../services/userService';
import { notificationManager } from '../lib/notifications';
import { logger } from '../utils/logger';

/**
 * Acquire an Expo push token and persist it to the user's public.users row.
 * Runs only once per user per app session — `onAuthStateChange` fires on every
 * token refresh, and we must not re-prompt / re-register on each tick.
 */
async function registerPushForUser(userId: string): Promise<void> {
  try {
    const token = await notificationManager.registerForPushNotificationsAsync();
    if (token) {
      await notificationManager.saveTokenToProfile(userId, token);
    }
  } catch (e) {
    logger.warn('[PushToken] registration failed', e);
  }
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userProfile: userService.UserProfile | null;
  /**
   * True once the public.users row has been fetched at least once for the
   * current session, regardless of whether a row exists. Used by routing
   * to distinguish "still loading" from "settled, no profile row" — a
   * brand-new signup has a session but no profile row until onboarding
   * completes, and we must not block redirects forever on that case.
   */
  profileLoaded: boolean;
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
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // Tracks which user we've already registered a push token for this session,
  // so token-refresh auth events don't re-trigger registration.
  const pushRegisteredFor = useRef<string | null>(null);

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
        setProfileLoaded(false);
        // Register the device for push AFTER auth — once per user per session.
        if (pushRegisteredFor.current !== session.user.id) {
          pushRegisteredFor.current = session.user.id;
          void registerPushForUser(session.user.id);
        }
        userService
          .getUserProfile(session.user.id)
          .then((p) => {
            setUserProfile(p);
            setProfileLoaded(true);
          })
          .catch(() => {
            setProfileLoaded(true);
          });
      } else {
        setProfileLoaded(true);
      }
    });

    // Listen for auth changes — set state synchronously, fetch profile in
    // background. If we awaited getUserProfile here a slow query would block
    // every subsequent auth event, including signOut().
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsAuthenticated(!!session);
      setLoading(false);

      if (session?.user) {
        setProfileLoaded(false);
        if (pushRegisteredFor.current !== session.user.id) {
          pushRegisteredFor.current = session.user.id;
          void registerPushForUser(session.user.id);
        }
        userService
          .getUserProfile(session.user.id)
          .then((p) => {
            setUserProfile(p);
            setProfileLoaded(true);
          })
          .catch(() => {
            setProfileLoaded(true);
          });
      } else {
        setUserProfile(null);
        setProfileLoaded(true);
        pushRegisteredFor.current = null;
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
    setProfileLoaded(true);
    setIsAuthenticated(false);

    // Best-effort Supabase signOut (idempotent, never throws)
    try {
      await supabase.auth.signOut({ scope: 'local' });
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

    // Admin is decided ONLY by the server-controlled JWT app_metadata
    // claim — user_metadata is client-writable and must never be trusted
    // for authorization. Role for routing falls back to public.users.role
    // (canonical) and never to user_metadata.
    const meta = (user.app_metadata as any) ?? {};
    const isAdmin =
      meta.is_admin === true || (Array.isArray(meta.roles) && meta.roles.includes('admin'));
    let role: 'customer' | 'technician' = 'customer';

    try {
      const { data } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
      if (data && (data as any).role === 'technician') role = 'technician';
    } catch {
      // Best-effort role lookup — default to customer on failure.
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
      const {
        data: { user: freshUser },
      } = await supabase.auth.getUser();
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
    <AuthContext.Provider
      value={{
        session,
        user,
        userProfile,
        profileLoaded,
        loading,
        isAuthenticated,
        signOut,
        deleteAccount,
        login,
        signup,
        refreshUser,
      }}
    >
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
