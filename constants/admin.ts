import type { User } from '@supabase/supabase-js';
import { normalizeSaudiPhone } from '../utils/validation';

/**
 * Admin authorization on the client.
 *
 * The admin claim lives in the JWT `app_metadata.is_admin` field (or
 * `app_metadata.roles` containing `"admin"`). `app_metadata` is set
 * ONLY by the server (service-role / Admin API) and is NOT writable
 * from the client — unlike `user_metadata`, which any signed-in user
 * can mutate via `supabase.auth.updateUser`. We therefore trust
 * `app_metadata` exclusively.
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
 * @deprecated Phone-based admin gate. Retained temporarily for
 * `services/phoneOtpService.ts` (dev-OTP allowlist) until its own change
 * migrates off `ADMIN_PHONE`. New code must use {@link isAdminUser}.
 *
 * Single source of truth for the legacy admin phone, stored in
 * fully-qualified E.164 form so it can be compared directly against the
 * result of `normalizeSaudiPhone`.
 */
export const ADMIN_PHONE = '+966548940042';

/**
 * @deprecated Use {@link isAdminUser}. True if the given phone (any of the
 * common Saudi input formats — 05XXXXXXXX, 5XXXXXXXX, +966XXXXXXXXX)
 * normalizes to the admin phone.
 */
export const isAdminPhone = (phone: string | null | undefined): boolean => {
  if (!phone) return false;
  try {
    return normalizeSaudiPhone(String(phone)) === ADMIN_PHONE;
  } catch {
    return false;
  }
};
