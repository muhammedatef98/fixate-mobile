import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { canAccessAdmin } from '../constants/admin';

export interface UseIsAdminResult {
  /**
   * True when the signed-in user may enter the admin area — either a legacy
   * full admin (JWT `app_metadata` claim) OR an active RBAC staff member
   * (non-empty `my_admin_permissions`). See constants/admin.ts `canAccessAdmin`.
   */
  isAdmin: boolean;
  /** True while auth or the admin permission set is still resolving. */
  checking: boolean;
}

/**
 * Lightweight observer — returns whether the current user may access the admin
 * area. Delegates to `canAccessAdmin`, which combines the server-controlled JWT
 * claim (client cannot mint it) with the server-computed RBAC permission set
 * (loaded once per session by AuthContext). Per-capability scoping is handled
 * separately by usePermissions; the database RLS remains authoritative.
 */
export const useIsAdmin = (): UseIsAdminResult => {
  const { user, loading, adminPermissions, adminPermissionsLoaded } = useAuth();
  const checking = loading || !adminPermissionsLoaded;
  return { isAdmin: !checking && canAccessAdmin(user, adminPermissions), checking };
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
