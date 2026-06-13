import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { isAdminUser } from '../constants/admin';

export interface UseIsAdminResult {
  /** True only when the signed-in user has the admin claim in JWT app_metadata. */
  isAdmin: boolean;
  /** True while auth is still loading. */
  checking: boolean;
}

/**
 * Lightweight observer — returns whether the current user is an admin.
 * Delegates to `isAdminUser`, which reads the server-controlled JWT
 * `app_metadata` (is_admin === true OR roles contains "admin"). The
 * client cannot mint or modify this claim.
 */
export const useIsAdmin = (): UseIsAdminResult => {
  const { user, loading } = useAuth();
  return { isAdmin: !loading && isAdminUser(user), checking: loading };
};

/**
 * Route-level admin guard. Apply at the top of every admin-* screen.
 * Redirects any non-admin user (including unauthenticated) away from the
 * screen — they never get to render the page, even momentarily.
 */
export const useAdminGuard = (): UseIsAdminResult => {
  const router = useRouter();
  const { isAdmin, checking } = useIsAdmin();

  useEffect(() => {
    if (checking) return;
    if (!isAdmin) {
      router.replace('/(customer)');
    }
  }, [checking, isAdmin, router]);

  return { isAdmin, checking };
};
