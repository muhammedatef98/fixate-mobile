import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

export interface UseIsAdminResult {
  /** True only when the signed-in user has the admin claim in JWT app_metadata. */
  isAdmin: boolean;
  /** True while auth is still loading. */
  checking: boolean;
}

/**
 * Lightweight observer — returns whether the current user is an admin.
 * Reads the `is_admin` claim from the Supabase JWT `app_metadata`. This
 * claim is server-controlled and cannot be set by the client.
 */
export const useIsAdmin = (): UseIsAdminResult => {
  const { user, loading } = useAuth();
  const isAdmin = (user as any)?.app_metadata?.is_admin === true;
  return { isAdmin: !loading && isAdmin, checking: loading };
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
