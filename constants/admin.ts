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
