-- Phase 1 follow-up:
--   1. Admin-controlled loyalty config (stored as platform_settings rows
--      so the same RLS / cache path is reused — no new tables, no app
--      release required to change earn rate / tiers).
--   2. Support-chat auto-close: status + closed_at columns on
--      support_threads plus a SECURITY DEFINER RPC the app/cron can call
--      to close threads idle for N minutes (default 5) where the LAST
--      message was sent by the customer (so we don't auto-close while
--      waiting on the user — we close stalled conversations that the
--      customer abandoned after a reply).

------------------------------------------------------------
-- 1. Loyalty admin settings (default rows; UI edits via upsert).
------------------------------------------------------------
INSERT INTO public.platform_settings (key, value, description) VALUES
  ('loyalty_enabled',        'true', 'Master switch for the loyalty program. When false, earning and redeeming are both hidden from the app.'),
  ('loyalty_points_per_sar', '1',    'Points earned per 1 SAR spent on completed orders.'),
  ('loyalty_redeem_min',     '500',  'Minimum points required before any redemption is allowed.'),
  ('loyalty_redeem_rate',    '0.1',  'SAR value of a single point at redemption (e.g. 0.1 = each point is worth 0.10 SAR off a repair invoice).'),
  ('loyalty_redeem_max_pct', '0.3',  'Maximum portion of a repair invoice that can be paid with points. 0.3 = points cover up to 30% of the bill.'),
  ('loyalty_tiers',
    '[
      {"id":"tier_500","points":500,"category":"accessory","titleAr":"خصم على إكسسوار صغير","titleEn":"Small accessory discount","descAr":"استبدل نقاطك بخصم على إكسسوار صغير","descEn":"Redeem points for a discount on a small accessory","valueSAR":15},
      {"id":"tier_1000","points":1000,"category":"repair","titleAr":"إكسسوار أكبر أو خصم إصلاح","titleEn":"Larger accessory or repair discount","descAr":"خصم أكبر على إكسسوار أو على فاتورة الإصلاح","descEn":"A larger accessory or a discount on a repair invoice","valueSAR":35},
      {"id":"tier_2000","points":2000,"category":"repair","titleAr":"مكافأة مميزة أو خصم إصلاح كبير","titleEn":"Premium reward or large repair discount","descAr":"مكافأة مميزة أو خصم كبير على فاتورة إصلاح","descEn":"A premium reward or a large repair-invoice discount","valueSAR":80}
    ]'::jsonb,
    'Ordered list of redemption tiers shown in the loyalty screen. Admin-editable JSON.')
ON CONFLICT (key) DO NOTHING;

------------------------------------------------------------
-- 2. Support-chat auto-close columns.
------------------------------------------------------------
ALTER TABLE public.support_threads
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','closed')),
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_reason text;

CREATE INDEX IF NOT EXISTS idx_support_threads_status_last
  ON public.support_threads(status, last_message_at DESC);

-- When any message lands on a closed thread, re-open it. This is the
-- "customer came back" path: the existing AFTER INSERT trigger updates
-- last_message_at; we extend that update to flip status back to open.
CREATE OR REPLACE FUNCTION public.support_message_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.support_threads
     SET last_message_at = NEW.created_at,
         unread_for_admin = CASE WHEN NEW.is_admin THEN unread_for_admin ELSE true END,
         unread_for_user  = CASE WHEN NEW.is_admin THEN true ELSE unread_for_user  END,
         status     = 'open',
         closed_at  = NULL,
         updated_at = NEW.created_at
   WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.support_message_after_insert() FROM PUBLIC, anon, authenticated;

-- RPC: close any open thread whose LAST message was from the customer
-- (is_admin=false) AND was sent more than `idle_minutes` ago. Admins can
-- run this manually; the app can call it opportunistically on app
-- foreground; in production schedule it via pg_cron / a Supabase cron job.
CREATE OR REPLACE FUNCTION public.support_close_idle_threads(idle_minutes integer DEFAULT 5)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  WITH last_msgs AS (
    SELECT DISTINCT ON (m.thread_id) m.thread_id, m.is_admin, m.created_at
      FROM public.support_messages m
      ORDER BY m.thread_id, m.created_at DESC
  )
  UPDATE public.support_threads t
     SET status        = 'closed',
         closed_at     = now(),
         closed_reason = 'auto_idle'
    FROM last_msgs lm
   WHERE t.id = lm.thread_id
     AND t.status = 'open'
     AND lm.is_admin = false
     AND lm.created_at < now() - (idle_minutes || ' minutes')::interval;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
GRANT EXECUTE ON FUNCTION public.support_close_idle_threads(integer) TO authenticated;

-- Manual close (used by the admin "Close chat" button).
CREATE OR REPLACE FUNCTION public.support_close_thread(p_thread_id uuid, p_reason text DEFAULT 'manual')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true)
          OR EXISTS (SELECT 1 FROM public.support_threads t WHERE t.id = p_thread_id AND t.user_id = auth.uid())) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  UPDATE public.support_threads
     SET status = 'closed', closed_at = now(), closed_reason = COALESCE(p_reason, 'manual')
   WHERE id = p_thread_id AND status = 'open';
END;
$$;
GRANT EXECUTE ON FUNCTION public.support_close_thread(uuid, text) TO authenticated;
