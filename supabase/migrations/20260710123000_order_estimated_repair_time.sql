-- Technician-set estimated repair time on an accepted order, shown to the
-- customer. Stored as a canonical bucket key rendered bilingually client-side.
-- Distinct from any courier/pickup timing — this is the repair-duration promise.
alter table public.orders
  add column if not exists estimated_repair text;

comment on column public.orders.estimated_repair is
  'Technician-set repair-time bucket key (same_day/1_day/2_3_days/3_5_days/1_week/2_weeks). Customer-facing. Not courier/pickup timing.';
