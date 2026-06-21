-- Phase 2:
--   1. Commitment-fee platform setting + per-order column so each order
--      carries the amount the customer agreed to before inspection.
--   2. Broadcasts table + RPC for admin announcements/push fan-out.
--   3. public.users.push_token mirror so admins/RPCs can resolve tokens
--      without depending on auth.users.user_metadata (which is per-row
--      readable only to its owner).
--   4. market_listings.contact_preference so sellers can choose direct
--      message, phone, or both.

------------------------------------------------------------
-- 1. Commitment fee
------------------------------------------------------------
INSERT INTO public.platform_settings (key, value, description) VALUES
  ('commitment_fee_default', '50',  'Fixed commitment amount (SAR) the customer pays before inspection. Establishes seriousness of booking and creates revenue floor pre-inspection.'),
  ('commitment_enabled',     'true','Master switch for the pre-inspection commitment fee. When false, the commitment line is dropped from the invoice and skipped at payment.')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS commitment_fee     numeric,
  ADD COLUMN IF NOT EXISTS commitment_paid_at timestamptz;

------------------------------------------------------------
-- 2. Push tokens stored on public.users (mirror of auth metadata).
------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS push_token      text,
  ADD COLUMN IF NOT EXISTS push_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_users_push_token
  ON public.users(push_token)
  WHERE push_token IS NOT NULL;

------------------------------------------------------------
-- 3. Broadcasts (admin announcements).
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.broadcasts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  body        text NOT NULL,
  category    text NOT NULL DEFAULT 'announcement'
              CHECK (category IN ('announcement','promo','update','maintenance')),
  audience    text NOT NULL DEFAULT 'all'
              CHECK (audience IN ('all','customers','technicians')),
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_count  integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  sent_at     timestamptz
);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created
  ON public.broadcasts(created_at DESC);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read broadcasts" ON public.broadcasts;
CREATE POLICY "Admins read broadcasts" ON public.broadcasts FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins insert broadcasts" ON public.broadcasts;
CREATE POLICY "Admins insert broadcasts" ON public.broadcasts FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins update broadcasts" ON public.broadcasts;
CREATE POLICY "Admins update broadcasts" ON public.broadcasts FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- RPC: returns the list of (user_id, push_token) tuples for an audience.
-- Admin-only. Mobile client uses this to resolve which devices to push to.
-- For a production setup the broadcast is dispatched server-side; until
-- then the admin app can use this and POST to Expo's push API directly.
CREATE OR REPLACE FUNCTION public.broadcast_targets(p_audience text)
RETURNS TABLE(user_id uuid, push_token text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  RETURN QUERY
    SELECT u.id, u.push_token
      FROM public.users u
     WHERE u.push_token IS NOT NULL
       AND (
            p_audience = 'all'
         OR (p_audience = 'customers'   AND COALESCE(u.role,'customer') = 'customer')
         OR (p_audience = 'technicians' AND u.role = 'technician')
       );
END;
$$;
GRANT EXECUTE ON FUNCTION public.broadcast_targets(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.broadcast_mark_sent(
  p_broadcast_id uuid,
  p_sent integer,
  p_failed integer
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  UPDATE public.broadcasts
     SET sent_count   = COALESCE(p_sent, 0),
         failed_count = COALESCE(p_failed, 0),
         sent_at      = now()
   WHERE id = p_broadcast_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.broadcast_mark_sent(uuid, integer, integer) TO authenticated;

------------------------------------------------------------
-- 4. Market listing: seller-chosen contact preference.
------------------------------------------------------------
ALTER TABLE public.market_listings
  ADD COLUMN IF NOT EXISTS contact_preference text NOT NULL DEFAULT 'both'
    CHECK (contact_preference IN ('dm','phone','both'));

-- For DM contact we route through the existing support_messages table
-- (re-purposed as a generic 1:1 channel between two users for a listing).
-- A lightweight market_threads table groups messages by listing + buyer.
CREATE TABLE IF NOT EXISTS public.market_threads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid NOT NULL REFERENCES public.market_listings(id) ON DELETE CASCADE,
  buyer_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at timestamptz DEFAULT now(),
  unread_for_buyer  boolean NOT NULL DEFAULT false,
  unread_for_seller boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(listing_id, buyer_id)
);
CREATE INDEX IF NOT EXISTS idx_market_threads_seller ON public.market_threads(seller_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_threads_buyer  ON public.market_threads(buyer_id,  last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.market_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  uuid NOT NULL REFERENCES public.market_threads(id) ON DELETE CASCADE,
  sender_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_market_messages_thread ON public.market_messages(thread_id, created_at);

ALTER TABLE public.market_threads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants read market thread" ON public.market_threads;
CREATE POLICY "Participants read market thread" ON public.market_threads FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Buyer creates market thread" ON public.market_threads;
CREATE POLICY "Buyer creates market thread" ON public.market_threads FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Participants update market thread" ON public.market_threads;
CREATE POLICY "Participants update market thread" ON public.market_threads FOR UPDATE
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

DROP POLICY IF EXISTS "Participants read market messages" ON public.market_messages;
CREATE POLICY "Participants read market messages" ON public.market_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.market_threads t
     WHERE t.id = market_messages.thread_id
       AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid() OR public.is_admin(auth.uid()))
  ));

DROP POLICY IF EXISTS "Participants insert market messages" ON public.market_messages;
CREATE POLICY "Participants insert market messages" ON public.market_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.market_threads t
       WHERE t.id = market_messages.thread_id
         AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.market_message_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_buyer uuid;
  v_seller uuid;
BEGIN
  SELECT buyer_id, seller_id INTO v_buyer, v_seller
    FROM public.market_threads WHERE id = NEW.thread_id;

  UPDATE public.market_threads
     SET last_message_at  = NEW.created_at,
         unread_for_buyer  = CASE WHEN NEW.sender_id = v_buyer  THEN unread_for_buyer  ELSE true END,
         unread_for_seller = CASE WHEN NEW.sender_id = v_seller THEN unread_for_seller ELSE true END
   WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.market_message_after_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_market_message_insert ON public.market_messages;
CREATE TRIGGER trg_market_message_insert
  AFTER INSERT ON public.market_messages
  FOR EACH ROW EXECUTE FUNCTION public.market_message_after_insert();

ALTER PUBLICATION supabase_realtime ADD TABLE public.market_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.market_threads;
