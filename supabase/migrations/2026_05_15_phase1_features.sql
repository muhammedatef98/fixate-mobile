-- Phase 1 features: phone OTP, discount codes, spare-part quality, Fixate Market
--
-- This migration is additive and idempotent. It introduces:
--   * phone_otps          — short-lived 4-digit OTP store keyed on E.164 phone
--   * discount_codes      — admin-managed promo codes
--   * discount_redemptions — audit trail of applied codes per order
--   * orders.spare_part_quality + orders.discount_code (FK by code text)
--   * market_listings     — Fixate Market scaffold (for sale by users/techs)
--
-- RLS is enabled on every new table. Customer-facing tables expose only the
-- minimum needed for the mobile app; admin operations rely on the existing
-- public.is_admin(auth.uid()) helper introduced in 2026_05_09_grant_is_admin_execute.sql.

-- ---------------------------------------------------------------------------
-- 1. Phone OTP store
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.phone_otps (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone        text NOT NULL,
  code_hash    text NOT NULL,        -- never store the raw 4-digit code
  purpose      text NOT NULL DEFAULT 'login'
                 CHECK (purpose IN ('login', 'register', 'verify')),
  attempts     int  NOT NULL DEFAULT 0,
  consumed_at  timestamptz,
  expires_at   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phone_otps_phone_idx ON public.phone_otps (phone);
CREATE INDEX IF NOT EXISTS phone_otps_expires_idx ON public.phone_otps (expires_at);

ALTER TABLE public.phone_otps ENABLE ROW LEVEL SECURITY;

-- Mobile clients never read/write phone_otps directly — only the edge
-- functions (which use the service role and bypass RLS) touch this table.
-- Lock everything down by default.
DROP POLICY IF EXISTS "phone_otps_no_select" ON public.phone_otps;
CREATE POLICY "phone_otps_no_select" ON public.phone_otps
  FOR SELECT USING (false);

DROP POLICY IF EXISTS "phone_otps_no_write" ON public.phone_otps;
CREATE POLICY "phone_otps_no_write" ON public.phone_otps
  FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 2. Discount codes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,
  description_ar  text,
  description_en  text,
  discount_type   text NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value  numeric NOT NULL CHECK (discount_value >= 0),
  max_discount    numeric,            -- cap (SAR) when discount_type='percent'
  min_order_total numeric DEFAULT 0,  -- minimum order subtotal to qualify
  usage_limit     int,                -- null = unlimited
  used_count      int NOT NULL DEFAULT 0,
  per_user_limit  int DEFAULT 1,      -- how many times one user may redeem
  starts_at       timestamptz,
  expires_at      timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discount_codes_code_idx ON public.discount_codes (code);
CREATE INDEX IF NOT EXISTS discount_codes_active_idx ON public.discount_codes (is_active);

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can SELECT *active* codes by code (for validation),
-- but they cannot enumerate or modify. Admin gets full CRUD.
DROP POLICY IF EXISTS "discount_codes_read_active" ON public.discount_codes;
CREATE POLICY "discount_codes_read_active" ON public.discount_codes
  FOR SELECT
  USING (
    is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (expires_at IS NULL OR expires_at > now())
  );

DROP POLICY IF EXISTS "discount_codes_admin_all" ON public.discount_codes;
CREATE POLICY "discount_codes_admin_all" ON public.discount_codes
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Audit trail: which user redeemed which code on which order, with the
-- frozen discount amount. Used to enforce per_user_limit and produce reports.
CREATE TABLE IF NOT EXISTS public.discount_redemptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id      uuid NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id     uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  amount_saved numeric NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discount_redemptions_user_idx
  ON public.discount_redemptions (user_id);
CREATE INDEX IF NOT EXISTS discount_redemptions_code_idx
  ON public.discount_redemptions (code_id);

ALTER TABLE public.discount_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "discount_redemptions_self_read" ON public.discount_redemptions;
CREATE POLICY "discount_redemptions_self_read" ON public.discount_redemptions
  FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "discount_redemptions_self_insert" ON public.discount_redemptions;
CREATE POLICY "discount_redemptions_self_insert" ON public.discount_redemptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. Spare-part quality + applied discount on orders
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS spare_part_quality text
    CHECK (spare_part_quality IN ('original', 'high_quality', 'economy')),
  ADD COLUMN IF NOT EXISTS discount_code text,
  ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 4. Fixate Market — scaffold for user/technician marketplace listings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_listings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  category      text NOT NULL DEFAULT 'other'
                  CHECK (category IN ('used_device', 'accessory', 'spare_part', 'other')),
  price         numeric NOT NULL CHECK (price >= 0),
  currency      text NOT NULL DEFAULT 'SAR',
  city          text,
  contact_phone text,
  images        text[] DEFAULT '{}',
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'active', 'sold', 'rejected', 'archived')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS market_listings_seller_idx
  ON public.market_listings (seller_id);
CREATE INDEX IF NOT EXISTS market_listings_status_idx
  ON public.market_listings (status);
CREATE INDEX IF NOT EXISTS market_listings_category_idx
  ON public.market_listings (category);

ALTER TABLE public.market_listings ENABLE ROW LEVEL SECURITY;

-- Anyone (even unauthenticated) can browse active listings.
DROP POLICY IF EXISTS "market_listings_browse_active" ON public.market_listings;
CREATE POLICY "market_listings_browse_active" ON public.market_listings
  FOR SELECT USING (status = 'active');

-- Sellers see their own regardless of status.
DROP POLICY IF EXISTS "market_listings_seller_read_own" ON public.market_listings;
CREATE POLICY "market_listings_seller_read_own" ON public.market_listings
  FOR SELECT USING (seller_id = auth.uid());

DROP POLICY IF EXISTS "market_listings_admin_read" ON public.market_listings;
CREATE POLICY "market_listings_admin_read" ON public.market_listings
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Sellers create their own listings; new listings start in 'pending' until
-- admin approves. Self-CHECK prevents posting on someone else's behalf.
DROP POLICY IF EXISTS "market_listings_seller_insert" ON public.market_listings;
CREATE POLICY "market_listings_seller_insert" ON public.market_listings
  FOR INSERT WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "market_listings_seller_update_own" ON public.market_listings;
CREATE POLICY "market_listings_seller_update_own" ON public.market_listings
  FOR UPDATE USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "market_listings_admin_all" ON public.market_listings;
CREATE POLICY "market_listings_admin_all" ON public.market_listings
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- updated_at trigger so admin lists stay sortable by recency.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_market_listings ON public.market_listings;
CREATE TRIGGER touch_market_listings BEFORE UPDATE ON public.market_listings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_discount_codes ON public.discount_codes;
CREATE TRIGGER touch_discount_codes BEFORE UPDATE ON public.discount_codes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
