import { normalizeSaudiPhone } from '../utils/validation';

/**
 * Single source of truth for admin access. Only the customer account with
 * this phone number is allowed into the admin panel. Stored here (one
 * constant) so the gate can be changed in one place when the owner of
 * the platform changes.
 *
 * The number is stored in fully-qualified E.164 form so it can be
 * compared directly against the result of `normalizeSaudiPhone`. Update
 * this value to grant admin access to a different account.
 */
export const ADMIN_PHONE = '+966548940042';

/**
 * True if the given phone (any of the common Saudi input formats —
 * 05XXXXXXXX, 5XXXXXXXX, +966XXXXXXXXX) normalizes to the admin phone.
 */
export const isAdminPhone = (phone: string | null | undefined): boolean => {
  if (!phone) return false;
  try {
    return normalizeSaudiPhone(String(phone)) === ADMIN_PHONE;
  } catch {
    return false;
  }
};
