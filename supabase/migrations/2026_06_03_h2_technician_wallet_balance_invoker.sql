-- H-2: technician_wallet_balance is a SECURITY DEFINER view that exposes
-- every technician's balance to anyone with SELECT on the view. The
-- underlying technician_wallet_entries table has correct RLS
-- (technicians read own, admins read all), so switching the view to
-- security_invoker=true is the right fix.
--
-- After this migration:
--   - A technician reading their own balance row works (entries RLS allows).
--   - An admin reading any balance works.
--   - Any other authenticated user sees an empty result for technicians
--     other than themselves.
--   - Service-role keeps full access.

CREATE OR REPLACE VIEW public.technician_wallet_balance
  WITH (security_invoker = true)
AS
  SELECT technician_id,
         COALESCE(sum(amount), 0::numeric) AS balance
    FROM public.technician_wallet_entries
   GROUP BY technician_id;

REVOKE SELECT ON public.technician_wallet_balance FROM anon;
GRANT  SELECT ON public.technician_wallet_balance TO authenticated;

COMMENT ON VIEW public.technician_wallet_balance IS
  'security_invoker=true — relies on RLS of technician_wallet_entries. '
  'Each technician sees only their own row; admins see all.';
