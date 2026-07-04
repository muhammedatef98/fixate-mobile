import type { User } from '@supabase/supabase-js';

/**
 * Single source of truth for admin authorization on the client.
 *
 * The admin claim lives in the JWT `app_metadata.is_admin` field (or
 * `app_metadata.roles` containing `"admin"`). `app_metadata` is set
 * ONLY by the server (service-role / Admin API) and is NOT writable
 * from the client — unlike `user_metadata`, which any signed-in user
 * can mutate via `supabase.auth.updateUser`. We therefore trust
 * `app_metadata` exclusively.
 *
 * To grant admin to an account, run `scripts/grant-admin.ts` (which
 * uses the Supabase Admin API with the service-role key) — never set
 * the flag from the mobile client.
 */
export const isAdminUser = (user: User | null | undefined): boolean => {
  if (!user) return false;
  const meta = (user as { app_metadata?: Record<string, unknown> } | null)?.app_metadata;
  if (!meta) return false;
  if (meta.is_admin === true) return true;
  const roles = meta.roles;
  if (Array.isArray(roles) && roles.includes('admin')) return true;
  return false;
};

/**
 * Unified "may enter the admin area" check — the single client-side gate used
 * by routing/guards. True when EITHER:
 *   1. the user is a legacy full admin (JWT `app_metadata` claim above), OR
 *   2. the user is an active RBAC staff member — i.e. the server-computed
 *      `my_admin_permissions` set is non-empty.
 *
 * Case (2) is what makes manager/admin roles assigned from the admin Team page
 * actually take effect: those grants live in `admin_staff`, never in the JWT,
 * so a JWT-only check would bounce a freshly-promoted staff member before any
 * screen mounts. Per-capability visibility is still scoped by `hasPermission`
 * (usePermissions), and the database RLS + SECURITY DEFINER RPCs remain the
 * authoritative enforcement layer — this only decides area access.
 */
export const canAccessAdmin = (
  user: User | null | undefined,
  adminPermissions: readonly string[] | null | undefined
): boolean => {
  // A signed-out user never has admin access, even if a stale permission set
  // is still in memory — always require an authenticated user first.
  if (!user) return false;
  return isAdminUser(user) || (!!adminPermissions && adminPermissions.length > 0);
};
