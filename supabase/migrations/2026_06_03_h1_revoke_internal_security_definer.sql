-- H-1: lock down SECURITY DEFINER functions that are only meant to fire
-- from triggers / internal code paths, so anon and authenticated cannot
-- call them as RPCs. Triggers themselves do NOT need EXECUTE — the
-- planner installs the trigger as owner, so this revoke is behaviour-
-- neutral for the existing app flows.
--
-- Functions intentionally KEPT executable for authenticated:
--   is_admin(uid)                      — read-only boolean, used by client
--                                        feature gates AND by RLS policies
--   broadcast_targets(text)            — has internal is_admin() check
--   broadcast_mark_sent(uuid,int,int)  — has internal is_admin() check
--   support_close_thread(uuid,text)    — has internal owner/admin check
--   support_close_idle_threads(int)    — hardened in 2026_06_03_h1_harden_support_close_idle_threads.sql
--
-- Functions REVOKED here are all trigger bodies, not RPCs.

REVOKE EXECUTE ON FUNCTION public.fn_auto_credit_technician()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_reopen_thread_on_message()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.market_message_after_insert()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_listing_review()                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_market_message()                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_comment()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_message()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_order_changes()                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_technicians_new_order()          FROM PUBLIC, anon, authenticated;

-- Rollback:
--   GRANT EXECUTE ON FUNCTION public.fn_auto_credit_technician()      TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.fn_reopen_thread_on_message()    TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.market_message_after_insert()    TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.notify_listing_review()          TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.notify_market_message()          TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.notify_new_comment()             TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.notify_new_message()             TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.notify_order_changes()           TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.notify_technicians_new_order()   TO anon, authenticated;
