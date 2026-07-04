-- Technician registration review: add a 'changes_requested' verification state.
--
-- Until now the admin could only Approve or Reject a technician application.
-- 'rejected' is a final decision; 'changes_requested' is a distinct, recoverable
-- state that returns the application to the technician with a note so they can
-- fix the flagged items and resubmit (which flips verification_status back to
-- 'submitted' via submitTechnicianApplication).
--
-- The technician-visible note lives in the existing `verification_notes` column
-- (already read by the technician gate in app/(technician)/_layout.tsx). No new
-- column is required — only the CHECK constraint needs to allow the new value.

alter table public.technicians
  drop constraint if exists technicians_verification_status_check;

alter table public.technicians
  add constraint technicians_verification_status_check
  check (
    verification_status = any (
      array['pending', 'submitted', 'approved', 'rejected', 'changes_requested']::text[]
    )
  );
