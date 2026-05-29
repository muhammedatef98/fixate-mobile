-- H-1 (follow-up): the function had no internal caller check, so any
-- authenticated user could close every idle support thread platform-wide.
-- Add an admin gate. Service-role callers (the auto-close-support edge
-- function and the supabase-cron job) have auth.uid() = NULL, so they
-- still pass through. The client wrapper supportService.closeIdleThreads
-- already tolerates errors silently (returns 0), so non-admin clients
-- experience no UX regression.

DROP FUNCTION IF EXISTS public.support_close_idle_threads(integer);

CREATE FUNCTION public.support_close_idle_threads(idle_minutes integer DEFAULT 5)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  closed_count int;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: admin only' USING ERRCODE = '42501';
  END IF;

  WITH idle AS (
    SELECT t.id
    FROM public.support_threads t
    JOIN public.support_messages m ON m.thread_id = t.id
    WHERE t.status = 'open'
      AND m.is_admin = false
      AND m.created_at < NOW() - (idle_minutes || ' minutes')::interval
      AND NOT EXISTS (
        SELECT 1 FROM public.support_messages m2
        WHERE m2.thread_id = t.id
          AND m2.created_at > m.created_at
      )
    GROUP BY t.id
  )
  UPDATE public.support_threads
  SET status = 'closed',
      closed_at = NOW(),
      closed_reason = 'idle_auto_close'
  WHERE id IN (SELECT id FROM idle);

  GET DIAGNOSTICS closed_count = ROW_COUNT;
  RETURN closed_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.support_close_idle_threads(integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.support_close_idle_threads(integer) TO authenticated;
