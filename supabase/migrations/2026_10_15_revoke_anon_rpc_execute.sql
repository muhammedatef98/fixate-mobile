-- Lock action RPCs to signed-in users only.
--
-- These SECURITY DEFINER functions were executable by the `anon` role
-- (directly and via the default PUBLIC grant), so anyone holding the
-- publishable key could call them over /rest/v1/rpc without signing in.
-- None of them is referenced by an RLS policy, trigger or cron job, and
-- the app only calls support_close_thread from an authenticated session.
--
-- Intentionally NOT revoked: is_admin, is_technician, has_admin_permission,
-- my_admin_permissions. They are evaluated inside RLS policies on tables
-- that guests read (market_listings, technicians, ...); revoking anon
-- EXECUTE would make those reads fail with "permission denied for function".

REVOKE EXECUTE ON FUNCTION public.generate_invoice_for_order(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.support_assign_thread(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.support_close_thread(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.generate_invoice_for_order(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.support_assign_thread(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.support_close_thread(uuid, text) TO authenticated, service_role;
