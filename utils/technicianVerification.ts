/**
 * technicianVerification.ts
 *
 * Pure helpers for the technician registration review state machine. Kept
 * framework-free so both the admin review screen (admin-verifications) and the
 * technician gate (app/(technician)/_layout) share one source of truth and can
 * be unit-tested without a renderer.
 *
 * Status model (technicians.verification_status):
 *   pending | submitted | approved | rejected | changes_requested
 *
 * - submitted          → awaiting admin review
 * - approved / verified → technician can work
 * - rejected           → final, recoverable only by reapplying
 * - changes_requested  → returned to the technician with a note to fix & resend
 *
 * The technician-visible note lives in technicians.verification_notes.
 */

export type TechnicianVerificationStatus =
  | 'pending'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'changes_requested';

/** The three decisions an admin can take on a submitted application. */
export type VerificationDecision = 'approved' | 'rejected' | 'changes_requested';

export type TechnicianGate =
  | { kind: 'allowed' }
  | { kind: 'pending'; status: string }
  | { kind: 'changes_requested'; notes?: string }
  | { kind: 'rejected'; notes?: string };

/**
 * Map a raw verification_status (+ note) to the gate the technician app should
 * render. Unknown / draft / pending / submitted all collapse to 'pending'
 * (application in flight, nothing for the technician to do yet).
 */
export const mapTechnicianGate = (
  rawStatus: string | null | undefined,
  notes?: string | null
): TechnicianGate => {
  const status = (rawStatus || 'pending').toLowerCase();
  if (status === 'verified' || status === 'approved') return { kind: 'allowed' };
  if (status === 'changes_requested') return { kind: 'changes_requested', notes: notes ?? undefined };
  if (status === 'rejected') return { kind: 'rejected', notes: notes ?? undefined };
  return { kind: 'pending', status };
};

export interface VerificationUpdate {
  verification_status: VerificationDecision;
  verified_at: string | null;
  verification_notes: string | null;
}

/**
 * Build the technicians-row update for an admin decision.
 *
 * - approved          → stamps verified_at, clears the note.
 * - rejected          → clears verified_at, stores the (optional) reason.
 * - changes_requested → clears verified_at, stores the note.
 *
 * A blank/whitespace note is normalised to null so we never persist empty text.
 */
export const buildVerificationUpdate = (
  decision: VerificationDecision,
  note: string | null | undefined,
  nowIso: string
): VerificationUpdate => {
  const trimmed = note?.trim() ? note.trim() : null;
  return {
    verification_status: decision,
    verified_at: decision === 'approved' ? nowIso : null,
    verification_notes: decision === 'approved' ? null : trimmed,
  };
};
