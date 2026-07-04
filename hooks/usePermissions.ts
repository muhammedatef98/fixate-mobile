import { useCallback, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission, type PermissionKey } from '../constants/permissions';

export interface UsePermissionsResult {
  permissions: string[];
  /** True while permissions are being resolved for the first time. */
  loading: boolean;
  /** Convenience: does the user have full admin access? */
  isFullAdmin: boolean;
  /** Check a single permission (full_admin_access always satisfies). */
  can: (perm: PermissionKey) => boolean;
  refresh: () => Promise<void>;
}

/**
 * Reads the signed-in user's effective admin permissions from AuthContext,
 * which owns the single `my_admin_permissions` fetch for the session (see
 * AuthContext.loadAdminPermissions). Used for UX gating only — RLS + SECURITY
 * DEFINER RPCs enforce real access on the server.
 *
 * Backed by AuthContext (rather than a private module cache) so route guards
 * and screen-level `can()` checks never diverge, and a role change refreshed
 * in one place becomes visible everywhere.
 */
export const usePermissions = (): UsePermissionsResult => {
  const {
    adminPermissions,
    adminPermissionsLoaded,
    loading: authLoading,
    refreshAdminPermissions,
  } = useAuth();

  const can = useCallback(
    (perm: PermissionKey) => hasPermission(adminPermissions, perm),
    [adminPermissions]
  );

  return {
    permissions: adminPermissions,
    loading: authLoading || !adminPermissionsLoaded,
    isFullAdmin: adminPermissions.includes('full_admin_access'),
    can,
    refresh: refreshAdminPermissions,
  };
};

/**
 * Route-level permission guard. Redirects away if the user lacks `perm`.
 * Falls back to the admin dashboard (which itself requires dashboard_access)
 * so a scoped staff member who hits a forbidden deep link lands somewhere safe.
 */
export const useRequirePermission = (perm: PermissionKey): UsePermissionsResult => {
  const router = useRouter();
  const result = usePermissions();
  useEffect(() => {
    if (result.loading) return;
    if (!result.can(perm)) {
      router.replace('/admin');
    }
  }, [result.loading, result, perm, router]);
  return result;
};
