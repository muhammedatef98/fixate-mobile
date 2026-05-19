-- Phase 2 schema upgrade.
--
-- Root cause of the "تعذّر إرسال السعر" error: the orders.status CHECK
-- constraint did not include 'quoted' / 'waiting_parts' / 'testing', so any
-- UPDATE that moved the order into those states failed with a constraint
-- violation. We also need extra columns to support the
-- technician-inspection-first pricing flow, cancellation/inspection fees,
-- personal-handoff fulfillment, and a technician wallet ledger.
--
-- This migration is idempotent and safe to re-run.

-- 1. Widen orders.status to include every status the app already uses.
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check CHECK (
    status IN (
      'pending',
      'confirmed',
      'accepted',
      'picking_up',
      'diagnosing',
      'quoted',
      'waiting_parts',
      'repairing',
      'testing',
      'delivering',
      'completed',
      'cancelled'
    )
  );

-- 2. Inspection-quote columns.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS final_price numeric,
  ADD COLUMN IF NOT EXISTS quote_notes text,
  ADD COLUMN IF NOT EXISTS quoted_at timestamptz;

-- 3. Cancellation / inspection fee (applies if customer rejects the quote
-- or cancels after the technician has already inspected).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS inspection_fee numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS return_fee numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellation_fee_total numeric DEFAULT 0;

-- 4. Personal-handoff fulfillment option (customer hands over / receives
-- the device themselves at a meet-up point). Stored alongside service_type
-- so we can scale the option set later without touching app code.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_type text DEFAULT 'mobile';

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_fulfillment_type_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_fulfillment_type_check CHECK (
    fulfillment_type IN ('mobile', 'pickup', 'personal_handoff')
  );

-- 5. Platform-wide configurable settings (used for default inspection /
-- return fees, eastern-province expansion flag, etc.). Key/value so we can
-- add new admin-tweakable knobs without further migrations.
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read platform settings" ON public.platform_settings;
CREATE POLICY "Anyone can read platform settings"
  ON public.platform_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Only admins write platform settings" ON public.platform_settings;
CREATE POLICY "Only admins write platform settings"
  ON public.platform_settings FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.platform_settings (key, value, description) VALUES
  ('inspection_fee_default', '30', 'Default inspection fee in SAR charged when the customer rejects the technician quote.'),
  ('return_fee_default',     '20', 'Default return fee in SAR charged when a picked-up device must be returned after a rejected quote.'),
  ('service_areas_message_ar', '"الخدمة حالياً في القطيف والمناطق القريبة فقط، وقريباً سنغطي كامل المنطقة الشرقية ثم جميع مناطق المملكة"', 'Arabic service-area expansion message.'),
  ('service_areas_message_en', '"Service is currently available in Al Qatif and nearby areas only. Soon we will expand across the Eastern Province and then all of Saudi Arabia."', 'English service-area expansion message.')
ON CONFLICT (key) DO NOTHING;

-- 6. Technician wallet ledger. Every credit/debit is a row so we never
-- desynchronise from the orders source-of-truth. The technician's balance
-- is sum(amount) where amount is signed.
CREATE TABLE IF NOT EXISTS public.technician_wallet_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id     uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  amount       numeric NOT NULL,
  kind         text NOT NULL CHECK (kind IN (
    'job_earning',         -- completed job credited the technician
    'inspection_fee',      -- inspection/return fee credited after a reject
    'platform_commission', -- platform takes its cut (negative)
    'withdrawal',          -- payout / cash-out (negative)
    'adjustment'           -- admin tweak
  )),
  description  text,
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE public.technician_wallet_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Technicians read own wallet" ON public.technician_wallet_entries;
CREATE POLICY "Technicians read own wallet"
  ON public.technician_wallet_entries FOR SELECT
  USING (technician_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Only admins write wallet entries" ON public.technician_wallet_entries;
CREATE POLICY "Only admins write wallet entries"
  ON public.technician_wallet_entries FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 7. Withdrawal requests so the technician can request a payout from the
-- in-app wallet. Real payout/bank rails still need backend support; this
-- table tracks intent only.
CREATE TABLE IF NOT EXISTS public.technician_withdrawals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount       numeric NOT NULL CHECK (amount > 0),
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  method       text,
  destination  text,
  notes        text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
ALTER TABLE public.technician_withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Technicians read own withdrawals" ON public.technician_withdrawals;
CREATE POLICY "Technicians read own withdrawals"
  ON public.technician_withdrawals FOR SELECT
  USING (technician_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Technicians request own withdrawals" ON public.technician_withdrawals;
CREATE POLICY "Technicians request own withdrawals"
  ON public.technician_withdrawals FOR INSERT
  WITH CHECK (technician_id = auth.uid());

DROP POLICY IF EXISTS "Admins approve withdrawals" ON public.technician_withdrawals;
CREATE POLICY "Admins approve withdrawals"
  ON public.technician_withdrawals FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 8. Fixate Market: comments / questions on a listing. The original schema
-- was missing this table entirely, which is why the in-app commenting
-- "broke" — every read/insert hit a non-existent relation.
CREATE TABLE IF NOT EXISTS public.market_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid NOT NULL REFERENCES public.market_listings(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id   uuid REFERENCES public.market_comments(id) ON DELETE CASCADE,
  author_name text,
  content     text NOT NULL CHECK (length(trim(content)) BETWEEN 1 AND 1000),
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS market_comments_listing_idx
  ON public.market_comments (listing_id, created_at);
CREATE INDEX IF NOT EXISTS market_comments_parent_idx
  ON public.market_comments (parent_id);

ALTER TABLE public.market_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read comments on active listings" ON public.market_comments;
CREATE POLICY "Anyone can read comments on active listings"
  ON public.market_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.market_listings ml
       WHERE ml.id = market_comments.listing_id
         AND (ml.status = 'active' OR ml.seller_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Auth users can comment" ON public.market_comments;
CREATE POLICY "Auth users can comment"
  ON public.market_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authors and admins delete comments" ON public.market_comments;
CREATE POLICY "Authors and admins delete comments"
  ON public.market_comments FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- 9. Convenience view for the wallet balance (sum of all signed entries).
CREATE OR REPLACE VIEW public.technician_wallet_balance AS
  SELECT technician_id, COALESCE(SUM(amount), 0)::numeric AS balance
    FROM public.technician_wallet_entries
   GROUP BY technician_id;

GRANT SELECT ON public.technician_wallet_balance TO authenticated;
