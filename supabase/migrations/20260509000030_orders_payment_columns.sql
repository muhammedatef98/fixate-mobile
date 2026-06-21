ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method text
    CHECK (payment_method IN ('cash', 'transfer', 'card')),
  ADD COLUMN IF NOT EXISTS payment_status text
    CHECK (payment_status IN ('unpaid', 'pending', 'paid')) DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_reference text;
