import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { isAdminUser } from '../constants/admin';
import { getMyPermissions } from '../services/adminTeamService';
import { hasPermission, type PermissionKey } from '../constants/permissions';

// Lightweight in-memory cache keyed by user id so navigating between admin
// screens doesn't refetch the permission set on every mount.
let cache: { userId: string | null; perms: string[] } | null = null;

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
 * Resolves the signed-in user's effective admin permissions from the server
 * (`my_admin_permissions` RPC). Used for UX gating only — RLS enforces access.
 */
export const usePermissions = (): UsePermissionsResult => {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [permissions, setPermissions] = useState<string[]>(
    cache && cache.userId === userId ? cache.perms : []
  );
  const [loading, setLoading] = useState<boolean>(!(cache && cache.userId === userId));

  const load = useCallback(async () => {
    if (!userId) {
      cache = { userId: null, perms: [] };
      setPermissions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Legacy full admins (JWT claim) short-circuit to full access even if the
    // RPC is briefly unavailable.
    const claimAdmin = isAdminUser(user);
    const perms = await getMyPermissions();
    const finalPerms = perms.length ? perms : claimAdmin ? ['full_admin_access'] : [];
    cache = { userId, perms: finalPerms };
    setPermissions(finalPerms);
    setLoading(false);
  }, [userId, user]);

  useEffect(() => {
    if (authLoading) return;
    if (cache && cache.userId === userId) {
      setPermissions(cache.perms);
      setLoading(false);
      return;
    }
    load();
  }, [authLoading, userId, load]);

  const can = useCallback(
    (perm: PermissionKey) => hasPermission(permissions, perm),
    [permissions]
  );

  return {
    permissions,
    loading: loading || authLoading,
    isFullAdmin: permissions.includes('full_admin_access'),
    can,
    refresh: load,
  };
};

/** Invalidate the cached permission set (call after staff changes). */
export const invalidatePermissionsCache = (): void => {
  cache = null;
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
