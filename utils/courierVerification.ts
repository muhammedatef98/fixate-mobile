/**
 * courierVerification.ts
 *
 * Pure helpers for the courier registration review state machine. Mirrors
 * utils/technicianVerification.ts so the admin review screen (admin-couriers)
 * and the courier gate (app/(courier)/_layout) share one tested source of
 * truth. Couriers are a first-class role — this is intentionally a separate
 * module from the technician machine even though the states line up today,
 * so the two flows can diverge later without cross-coupling.
 *
 * Status model (couriers.verification_status):
 *   pending | submitted | approved | rejected | changes_requested
 */

export type CourierVerificationStatus =
  | 'pending'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'changes_requested';

export type CourierGate =
  | { kind: 'allowed' }
  | { kind: 'pending'; status: string }
  | { kind: 'changes_requested'; notes?: string }
  | { kind: 'rejected'; notes?: string };

/**
 * Map a raw verification_status (+ note) to the gate the courier app should
 * render. Unknown / draft / pending / submitted all collapse to 'pending'.
 */
export const mapCourierGate = (
  rawStatus: string | null | undefined,
  notes?: string | null
): CourierGate => {
  const status = (rawStatus || 'pending').toLowerCase();
  if (status === 'verified' || status === 'approved') return { kind: 'allowed' };
  if (status === 'changes_requested')
    return { kind: 'changes_requested', notes: notes ?? undefined };
  if (status === 'rejected') return { kind: 'rejected', notes: notes ?? undefined };
  return { kind: 'pending', status };
};

/**
 * Whether a courier account may act on delivery tasks (see the eligibility
 * rules enforced server-side in accept_delivery_task).
 */
export const isCourierEligible = (
  verificationStatus: string | null | undefined,
  courierStatus: string | null | undefined
): boolean => {
  const v = (verificationStatus || '').toLowerCase();
  const s = (courierStatus || 'active').toLowerCase();
  return (v === 'approved' || v === 'verified') && s === 'active';
};
