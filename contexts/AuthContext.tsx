import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import * as authService from '../services/authService';
import * as userService from '../services/userService';
import { getMyPermissions } from '../services/adminTeamService';
import { isAdminUser } from '../constants/admin';
import { notificationManager, healPushTokenIfNeeded } from '../lib/notifications';
import { logger } from '../utils/logger';
import { clearLastRole } from '../utils/rolePreference';

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
    // Android-only self-heal: if a raw FCM token (from the Expo/Firebase
    // double-registration race) is sitting in public.users.push_token,
    // push-dispatch would reject and delete it. Re-register with a fresh Expo
    // token so delivery isn't silently broken. No-op on iOS.
    await healPushTokenIfNeeded(userId);
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
  /**
   * Server-computed admin permission keys for the current user (empty for
   * non-staff). Source of truth on the client for admin-area access and
   * per-capability gating — see constants/admin.ts `canAccessAdmin` and
   * hooks/usePermissions.
   */
  adminPermissions: string[];
  /**
   * True once `my_admin_permissions` has resolved for the current session.
   * Routing/guards must wait for this before deciding admin access, otherwise
   * a legitimate staff member would be bounced during the async load.
   */
  adminPermissionsLoaded: boolean;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  login: (email: string, password: string) => Promise<'admin' | 'customer' | 'technician'>;
  signup: (data: authService.SignUpData) => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Re-fetch admin permissions (call after a staff/role change). */
  refreshAdminPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<userService.UserProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [adminPermissionsLoaded, setAdminPermissionsLoaded] = useState(false);

  /**
   * Resolve the current user's admin permission set from the server. Legacy
   * full admins (JWT claim) short-circuit to ['full_admin_access'] even if the
   * RPC is briefly unavailable, so their access never depends on a network hop.
   * Non-staff resolve to [] — a single cheap RPC per session.
   */
  const loadAdminPermissions = async (u: User | null): Promise<void> => {
    if (!u) {
      setAdminPermissions([]);
      setAdminPermissionsLoaded(true);
      return;
    }
    try {
      const perms = await getMyPermissions();
      const finalPerms = perms.length ? perms : isAdminUser(u) ? ['full_admin_access'] : [];
      setAdminPermissions(finalPerms);
    } catch {
      setAdminPermissions(isAdminUser(u) ? ['full_admin_access'] : []);
    } finally {
      setAdminPermissionsLoaded(true);
    }
  };
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
        setAdminPermissionsLoaded(false);
        void loadAdminPermissions(session.user);
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
        setAdminPermissions([]);
        setAdminPermissionsLoaded(true);
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
        setAdminPermissionsLoaded(false);
        void loadAdminPermissions(session.user);
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
        setAdminPermissions([]);
        setAdminPermissionsLoaded(true);
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
    setAdminPermissions([]);
    setAdminPermissionsLoaded(true);
    setIsAuthenticated(false);

    // Forget the remembered flow so the next launch shows role-selection again.
    void clearLastRole();

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
      // Pick up admin role/permission changes applied since the session started.
      await loadAdminPermissions(user);
    }
  };

  const refreshAdminPermissions = async () => {
    await loadAdminPermissions(user);
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
        adminPermissions,
        adminPermissionsLoaded,
        signOut,
        deleteAccount,
        login,
        signup,
        refreshUser,
        refreshAdminPermissions,
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
