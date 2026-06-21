-- ============================================================================
-- 2026_05_31_market_chat_phase2.sql
--
-- Phase 2 of the customer-to-customer marketplace chat.
--
-- The 2026_05_20 / 2026_05_21 migrations already established the
-- market_threads / market_messages baseline (per-listing buyer↔seller DM,
-- RLS, realtime, in-app notification on new messages). This migration
-- builds the production-grade additions on top of it without breaking any
-- existing behaviour:
--
--   1. Inbox-grade columns on market_threads:
--        last_read_at_buyer, last_read_at_seller   — per-participant read mark
--        archived_for_buyer, archived_for_seller   — soft "hide" per side
--        last_message_preview                       — short snippet for inbox row
--   2. Integrity guards:
--        buyer_id <> seller_id                      — no self-DM
--        content length 1..4000                     — DB-side cap
--   3. Trigger update to populate last_message_preview alongside
--      last_message_at and the unread flags.
--   4. RPC list_my_market_threads(p_limit, p_before)
--        Returns one row per thread the caller participates in, joined to
--        the counterparty's public profile card and a slim listing summary,
--        with a stable cursor (last_message_at) for pagination. One call
--        replaces the N+1 the client would otherwise do.
--   5. RPC mark_market_thread_read(p_thread_id)
--        Atomically clears the caller's unread flag and stamps
--        last_read_at_<role>. SECURITY DEFINER + auth.uid() check so the
--        write is allowed regardless of the column-level update policy.
--
-- All changes are idempotent (IF NOT EXISTS, OR REPLACE).
-- No payment-related tables touched. No auth tables touched.
-- ============================================================================

-- --- 1. New columns on market_threads ---------------------------------------

ALTER TABLE public.market_threads
  ADD COLUMN IF NOT EXISTS last_read_at_buyer    timestamptz,
  ADD COLUMN IF NOT EXISTS last_read_at_seller   timestamptz,
  ADD COLUMN IF NOT EXISTS archived_for_buyer    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_for_seller   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_message_preview  text;

-- Helpful inbox index: list "my threads" by recent activity, filtering out
-- the side the participant has archived. Partial index keeps it small.
CREATE INDEX IF NOT EXISTS idx_market_threads_buyer_inbox
  ON public.market_threads (buyer_id, last_message_at DESC)
  WHERE archived_for_buyer = false;

CREATE INDEX IF NOT EXISTS idx_market_threads_seller_inbox
  ON public.market_threads (seller_id, last_message_at DESC)
  WHERE archived_for_seller = false;

-- --- 2. Integrity guards -----------------------------------------------------

-- A buyer cannot DM the seller of their own listing — that's just the
-- seller talking to themselves. Drop-and-add pattern is safe even on a
-- partially-migrated remote.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'market_threads_no_self_dm'
       AND conrelid = 'public.market_threads'::regclass
  ) THEN
    ALTER TABLE public.market_threads
      ADD CONSTRAINT market_threads_no_self_dm
      CHECK (buyer_id <> seller_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'market_messages_content_length'
       AND conrelid = 'public.market_messages'::regclass
  ) THEN
    ALTER TABLE public.market_messages
      ADD CONSTRAINT market_messages_content_length
      CHECK (char_length(btrim(content)) BETWEEN 1 AND 4000);
  END IF;
END $$;

-- --- 3. Trigger: keep last_message_preview in sync ---------------------------
--
-- We keep the existing trigger name (trg_market_message_insert) so the
-- previous migration's CREATE TRIGGER call still owns the binding. We just
-- replace the function body to also populate the preview.

CREATE OR REPLACE FUNCTION public.market_message_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_buyer  uuid;
  v_seller uuid;
BEGIN
  SELECT buyer_id, seller_id INTO v_buyer, v_seller
    FROM public.market_threads WHERE id = NEW.thread_id;

  UPDATE public.market_threads
     SET last_message_at      = NEW.created_at,
         last_message_preview = left(btrim(NEW.content), 140),
         unread_for_buyer     = CASE WHEN NEW.sender_id = v_buyer  THEN unread_for_buyer  ELSE true END,
         unread_for_seller    = CASE WHEN NEW.sender_id = v_seller THEN unread_for_seller ELSE true END,
         -- A new message un-archives the thread for both sides: it's active
         -- again. Without this, an archived inbox row would silently keep
         -- collecting messages the user never sees.
         archived_for_buyer   = CASE WHEN NEW.sender_id = v_seller THEN false ELSE archived_for_buyer  END,
         archived_for_seller  = CASE WHEN NEW.sender_id = v_buyer  THEN false ELSE archived_for_seller END
   WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

-- --- 4. RPC: list_my_market_threads -----------------------------------------
--
-- Returns inbox rows for the caller. SECURITY DEFINER so the JOIN onto
-- public.users / public.market_listings still respects the caller's
-- identity via auth.uid(); we never expose threads the caller is not a
-- participant in.
--
-- Cursor: `p_before` is the last_message_at of the last row from the
-- previous page. Pass NULL for the first page.

DROP FUNCTION IF EXISTS public.list_my_market_threads(int, timestamptz);
CREATE OR REPLACE FUNCTION public.list_my_market_threads(
  p_limit  int          DEFAULT 50,
  p_before timestamptz  DEFAULT NULL
)
RETURNS TABLE (
  thread_id              uuid,
  listing_id             uuid,
  listing_title          text,
  listing_price          numeric,
  listing_currency       text,
  listing_image          text,
  listing_status         text,
  counterparty_id        uuid,
  counterparty_name      text,
  counterparty_avatar    text,
  my_role                text,                -- 'buyer' | 'seller'
  last_message_at        timestamptz,
  last_message_preview   text,
  unread                 boolean,
  archived               boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    t.id                                                         AS thread_id,
    t.listing_id                                                 AS listing_id,
    l.title                                                      AS listing_title,
    l.price                                                      AS listing_price,
    l.currency                                                   AS listing_currency,
    (CASE WHEN array_length(l.images, 1) >= 1 THEN l.images[1] END) AS listing_image,
    l.status::text                                               AS listing_status,
    CASE WHEN t.buyer_id = v_uid THEN t.seller_id ELSE t.buyer_id END AS counterparty_id,
    uc.name                                                      AS counterparty_name,
    uc.avatar_url                                                AS counterparty_avatar,
    CASE WHEN t.buyer_id = v_uid THEN 'buyer' ELSE 'seller' END   AS my_role,
    t.last_message_at                                            AS last_message_at,
    t.last_message_preview                                       AS last_message_preview,
    CASE WHEN t.buyer_id = v_uid THEN t.unread_for_buyer ELSE t.unread_for_seller END AS unread,
    CASE WHEN t.buyer_id = v_uid THEN t.archived_for_buyer ELSE t.archived_for_seller END AS archived
  FROM public.market_threads t
  JOIN public.market_listings l ON l.id = t.listing_id
  LEFT JOIN public.public_user_cards uc
    ON uc.id = CASE WHEN t.buyer_id = v_uid THEN t.seller_id ELSE t.buyer_id END
  WHERE (t.buyer_id = v_uid OR t.seller_id = v_uid)
    AND (
      (t.buyer_id  = v_uid AND t.archived_for_buyer  = false) OR
      (t.seller_id = v_uid AND t.archived_for_seller = false)
    )
    AND (p_before IS NULL OR t.last_message_at < p_before)
  ORDER BY t.last_message_at DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 100));
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_my_market_threads(int, timestamptz) TO authenticated;

-- --- 5. RPC: mark_market_thread_read ----------------------------------------

DROP FUNCTION IF EXISTS public.mark_market_thread_read(uuid);
CREATE OR REPLACE FUNCTION public.mark_market_thread_read(p_thread_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_buyer  uuid;
  v_seller uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT buyer_id, seller_id INTO v_buyer, v_seller
    FROM public.market_threads WHERE id = p_thread_id;

  IF v_buyer IS NULL THEN
    RAISE EXCEPTION 'thread not found';
  END IF;

  IF v_uid = v_buyer THEN
    UPDATE public.market_threads
       SET unread_for_buyer   = false,
           last_read_at_buyer = now()
     WHERE id = p_thread_id;
  ELSIF v_uid = v_seller THEN
    UPDATE public.market_threads
       SET unread_for_seller   = false,
           last_read_at_seller = now()
     WHERE id = p_thread_id;
  ELSE
    RAISE EXCEPTION 'not a thread participant';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_market_thread_read(uuid) TO authenticated;

-- --- 6. RPC: archive / unarchive thread for caller --------------------------

DROP FUNCTION IF EXISTS public.set_market_thread_archived(uuid, boolean);
CREATE OR REPLACE FUNCTION public.set_market_thread_archived(
  p_thread_id uuid,
  p_archived  boolean
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_buyer  uuid;
  v_seller uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT buyer_id, seller_id INTO v_buyer, v_seller
    FROM public.market_threads WHERE id = p_thread_id;

  IF v_buyer IS NULL THEN
    RAISE EXCEPTION 'thread not found';
  END IF;

  IF v_uid = v_buyer THEN
    UPDATE public.market_threads
       SET archived_for_buyer = p_archived
     WHERE id = p_thread_id;
  ELSIF v_uid = v_seller THEN
    UPDATE public.market_threads
       SET archived_for_seller = p_archived
     WHERE id = p_thread_id;
  ELSE
    RAISE EXCEPTION 'not a thread participant';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_market_thread_archived(uuid, boolean) TO authenticated;

-- --- 7. Backfill last_message_preview for existing rows ---------------------
--
-- One-shot — fills in the snippet column for threads that already exist.
-- Safe to re-run.

UPDATE public.market_threads t
   SET last_message_preview = left(btrim(m.content), 140)
  FROM (
    SELECT DISTINCT ON (thread_id) thread_id, content
      FROM public.market_messages
      ORDER BY thread_id, created_at DESC
  ) m
 WHERE m.thread_id = t.id
   AND t.last_message_preview IS NULL;
