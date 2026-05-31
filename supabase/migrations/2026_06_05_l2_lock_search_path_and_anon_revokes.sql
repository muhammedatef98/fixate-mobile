-- L-2 batch: close the remaining Supabase advisor lints around
-- function_search_path_mutable and anon_security_definer_function_executable.
--
-- Two micro-issues, zero behavioural change:
--
-- A) Pin search_path = public, pg_temp on three SECURITY DEFINER
--    functions whose bodies don't qualify object references. This blocks
--    a hijack scenario where a sibling schema with a matching function
--    name shadows the call.
--
--    Functions touched:
--      - public.support_close_thread(uuid, text)
--      - public.touch_updated_at()                  (trigger)
--      - public.fn_reopen_thread_on_message()       (trigger)
--
-- B) Revoke EXECUTE from `anon` on two SECURITY DEFINER functions that
--    only legitimate authenticated clients ever invoke:
--      - public.is_admin(uuid)         — no client RPC; policies bypass GRANTs
--      - public.support_close_thread   — called by services/supportService.ts
--                                        from signed-in users only
--    `authenticated` keeps EXECUTE on both. anon loses an RPC surface it
--    never used.
--
-- Rollback:
--   ALTER FUNCTION public.support_close_thread(uuid,text)        RESET search_path;
--   ALTER FUNCTION public.touch_updated_at()                     RESET search_path;
--   ALTER FUNCTION public.fn_reopen_thread_on_message()          RESET search_path;
--   GRANT EXECUTE ON FUNCTION public.is_admin(uuid)              TO anon;
--   GRANT EXECUTE ON FUNCTION public.support_close_thread(uuid,text) TO anon;

ALTER FUNCTION public.support_close_thread(uuid, text)   SET search_path = public, pg_temp;
ALTER FUNCTION public.touch_updated_at()                 SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_reopen_thread_on_message()      SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid)                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.support_close_thread(uuid, text) FROM anon;
