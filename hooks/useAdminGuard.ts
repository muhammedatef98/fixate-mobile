import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import { isAdminPhone } from '../constants/admin';

/**
 * Returns the resolved admin phone for the currently-signed-in user.
 * Reads from three independent sources (auth.user.phone, the users.phone
 * row, the local userProfile) so a stale cache can't lock the legitimate
 * owner out. The first non-empty value wins.
 */
const resolvePhone = async (
  authPhone: string | null | undefined,
  userProfile: any,
  userId: string | undefined
): Promise<string | null> => {
  if (authPhone) return authPhone;
  const profilePhone = userProfile?.phone;
  if (profilePhone) return profilePhone;
  if (!userId) return null;
  try {
    const { data } = await supabase
      .from('users')
      .select('phone')
      .eq('id', userId)
      .maybeSingle();
    return (data as any)?.phone ?? null;
  } catch {
    return null;
  }
};

export interface UseIsAdminResult {
  /** True only when the signed-in user's phone matches the admin phone. */
  isAdmin: boolean;
  /** While we're still resolving the phone (first paint), this is true. */
  checking: boolean;
}

/**
 * Lightweight observer — returns whether the current user is the admin.
 * Use this for UI visibility (e.g. hiding an "Admin panel" tile). It
 * does NOT redirect; if you need a route-level guard, see
 * `useAdminGuard` below.
 */
export const useIsAdmin = (): UseIsAdminResult => {
  const { user, userProfile, loading } = useAuth();
  const [phone, setPhone] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (loading) return;
    setChecking(true);
    resolvePhone((user as any)?.phone, userProfile, user?.id).then((p) => {
      if (!cancelled) {
        setPhone(p);
        setChecking(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, (user as any)?.phone, userProfile, loading]);

  return { isAdmin: !checking && isAdminPhone(phone), checking };
};

/**
 * Route-level admin guard. Apply at the top of every admin-* screen.
 * Redirects any non-admin user (including unauthenticated) away from the
 * screen — they never get to render the page, even momentarily.
 *
 * Returns `{ checking, isAdmin }` so the caller can render a spinner
 * while the phone lookup is in flight.
 */
export const useAdminGuard = (): UseIsAdminResult => {
  const router = useRouter();
  const { isAdmin, checking } = useIsAdmin();

  useEffect(() => {
    if (checking) return;
    if (!isAdmin) {
      // Bounce non-admins back to the customer home — never silently
      // render an admin surface. We use replace() so the back stack
      // doesn't keep the admin path around.
      router.replace('/(customer)');
    }
  }, [checking, isAdmin, router]);

  return { isAdmin, checking };
};
