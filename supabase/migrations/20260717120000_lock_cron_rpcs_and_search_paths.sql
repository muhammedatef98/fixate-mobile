-- Security-advisor cleanup (2026-07-17 audit follow-up).
--
-- 1. Cron-only SECURITY DEFINER functions had EXECUTE granted to anon /
--    authenticated but contain NO internal auth guard. Any app user could
--    e.g. call support_close_idle_threads(0) and close every open support
--    thread. pg_cron runs as postgres (function owner), so revoking client
--    roles does not affect the scheduled jobs. service_role keeps EXECUTE
--    in case an edge function ever needs to trigger them.
revoke execute on function public.process_due_scheduled_notifications() from public, anon, authenticated;
revoke execute on function public.support_close_idle_threads(integer) from public, anon, authenticated;
revoke execute on function public.support_idle_sweep(integer, integer) from public, anon, authenticated;
grant execute on function public.process_due_scheduled_notifications() to service_role;
grant execute on function public.support_close_idle_threads(integer) to service_role;
grant execute on function public.support_idle_sweep(integer, integer) to service_role;

-- 2. Pin search_path on the four remaining role-mutable-search_path
--    functions (prevents search_path hijack of SECURITY DEFINER bodies).
alter function public.tg_user_verifications_touch() set search_path = public;
alter function public.tg_user_verifications_propagate() set search_path = public;
alter function public._zatca_tlv(text, text, timestamp with time zone, numeric, numeric) set search_path = public;
alter function public.order_customer_total(orders) set search_path = public;
