-- Technician workflow fields: internal notes (not customer-visible) and
-- before/after repair photos.
alter table public.orders
  add column if not exists technician_notes text,
  add column if not exists before_photos text[] not null default '{}',
  add column if not exists after_photos text[] not null default '{}';
