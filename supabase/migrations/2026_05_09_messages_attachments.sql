ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachment_type text
    CHECK (attachment_type IN ('image', 'location')),
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_lat numeric,
  ADD COLUMN IF NOT EXISTS attachment_lng numeric;
