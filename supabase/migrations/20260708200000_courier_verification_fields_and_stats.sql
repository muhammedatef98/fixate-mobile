-- ═══════════════════════════════════════════════════════════════════════════
-- Courier verification fields + trustworthy delivery counter (2026-07-08)
--
-- 1. couriers gains driver_license_number and vehicle_registration_number —
--    collected in onboarding, reviewed by admins alongside city/vehicle/ID.
-- 2. couriers.total_deliveries was never incremented anywhere (always 0 —
--    a misleading stat on the courier profile). A trigger on delivery_tasks
--    now keeps it correct, and existing rows are backfilled from the actual
--    completed tasks.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.couriers
  add column if not exists driver_license_number text,
  add column if not exists vehicle_registration_number text;

comment on column public.couriers.driver_license_number is
  'Driver license number, collected at onboarding for admin verification.';
comment on column public.couriers.vehicle_registration_number is
  'Vehicle registration (istimara) / form number for the car or motorcycle.';

-- ── total_deliveries: keep it true ──────────────────────────────────────────
create or replace function public.bump_courier_total_deliveries()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed'
     and new.courier_id is not null then
    update public.couriers
      set total_deliveries = total_deliveries + 1,
          updated_at = now()
      where user_id = new.courier_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bump_courier_total_deliveries on public.delivery_tasks;
create trigger trg_bump_courier_total_deliveries
after update of status on public.delivery_tasks
for each row execute function public.bump_courier_total_deliveries();

-- Backfill from the source of truth.
update public.couriers c
set total_deliveries = coalesce(sub.cnt, 0)
from (
  select courier_id, count(*)::int as cnt
  from public.delivery_tasks
  where status = 'completed' and courier_id is not null
  group by courier_id
) sub
where sub.courier_id = c.user_id
  and c.total_deliveries is distinct from sub.cnt;
