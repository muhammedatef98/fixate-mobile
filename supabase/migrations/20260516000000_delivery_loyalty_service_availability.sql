-- Phase: delivery pricing by region, loyalty points, technician service
-- availability. The app degrades gracefully without this migration (local
-- config + placeholder balances), so applying it is non-destructive and can
-- be done at any time.

-- 1. Order-level delivery + loyalty snapshot ---------------------------------
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_region text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_area text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee numeric;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS loyalty_points_earned integer;

-- 2. Admin/technician-managed delivery pricing overrides ---------------------
-- Rows here override constants/deliveryPricing.ts at runtime. A NULL area_id
-- row sets the region-level base fee / enabled flag.
CREATE TABLE IF NOT EXISTS public.delivery_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id text NOT NULL,
  area_id text,
  fee numeric NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (region_id, area_id)
);
ALTER TABLE public.delivery_pricing ENABLE ROW LEVEL SECURITY;

-- Everyone signed in can read pricing; only admins can change it.
CREATE POLICY "Anyone can read delivery pricing" ON public.delivery_pricing
  FOR SELECT USING (true);
CREATE POLICY "Admins manage delivery pricing" ON public.delivery_pricing
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.is_admin = true)
  );

-- 3. Loyalty ledger ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('earn', 'redeem')),
  points integer NOT NULL CHECK (points >= 0),
  reason text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_txn_user
  ON public.loyalty_transactions(user_id, created_at DESC);
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own loyalty" ON public.loyalty_transactions
  FOR SELECT USING (auth.uid() = user_id);
-- Earn/redeem are inserted by the user's own session for now; tighten to a
-- server-side function once the backend owns the earn rule.
CREATE POLICY "Users insert own loyalty" ON public.loyalty_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Per-technician service availability -------------------------------------
CREATE TABLE IF NOT EXISTS public.service_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (technician_id, service_id)
);
ALTER TABLE public.service_availability ENABLE ROW LEVEL SECURITY;

-- Technicians manage their own rows; everyone signed in can read (so the
-- customer flow can later filter unavailable services).
CREATE POLICY "Read service availability" ON public.service_availability
  FOR SELECT USING (true);
CREATE POLICY "Technician manages own availability" ON public.service_availability
  FOR ALL USING (auth.uid() = technician_id) WITH CHECK (auth.uid() = technician_id);
