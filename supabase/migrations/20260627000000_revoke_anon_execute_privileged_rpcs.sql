-- Revoke the implicit PUBLIC / anon EXECUTE grant on privileged, self-authorizing
-- RPCs. Postgres grants EXECUTE to PUBLIC by default, and the `anon` role
-- inherits it, so these functions were reachable (over /rest/v1/rpc) by the
-- anonymous role even though each one already enforces authorization internally
-- (admin_* check has_admin_permission(auth.uid(),'staff_management');
-- wallet_add_transaction rejects a null auth.uid() and only touches the caller's
-- own wallet). An unauthenticated call could therefore never succeed — but these
-- endpoints should not be reachable by the anon role at all.
--
-- This adds the `revoke ... from public, anon` line that the original grants
-- omitted, mirroring the pattern already used for public._effective_admin_perms
-- and public.user_has_role in earlier migrations. Legitimate (authenticated)
-- access is preserved, so no client flow changes.
--
-- Safe to run more than once (revoke/grant are idempotent).

-- ── Staff / RBAC management (admin_rbac.sql) ──────────────────────────────────
revoke execute on function public.admin_assign_staff(uuid, text, text) from public, anon;
grant  execute on function public.admin_assign_staff(uuid, text, text) to authenticated;

revoke execute on function public.admin_set_staff_active(uuid, boolean) from public, anon;
grant  execute on function public.admin_set_staff_active(uuid, boolean) to authenticated;

revoke execute on function public.admin_remove_staff(uuid) from public, anon;
grant  execute on function public.admin_remove_staff(uuid) to authenticated;

revoke execute on function public.admin_set_permission_override(uuid, text, text) from public, anon;
grant  execute on function public.admin_set_permission_override(uuid, text, text) to authenticated;

-- ── Customer wallet (customer_wallet.sql) ─────────────────────────────────────
revoke execute on function public.wallet_add_transaction(text, numeric, text, uuid) from public, anon;
grant  execute on function public.wallet_add_transaction(text, numeric, text, uuid) to authenticated;
