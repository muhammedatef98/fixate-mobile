-- ============================================================================
-- Commission settings (إعدادات العمولة) — §11
-- Single-row table that stores the technician/platform revenue split used by
-- the admin accounting dashboard. `technician_pct` is the technician's share;
-- the platform share is derived as (100 - technician_pct).
-- ============================================================================
create table if not exists public.commission_settings (
  id             uuid primary key default gen_random_uuid(),
  -- Technician share of order revenue, 0–100. Platform share = 100 - this.
  technician_pct numeric(5,2) not null default 80 check (technician_pct between 0 and 100),
  updated_by     uuid references auth.users(id) on delete set null,
  updated_at     timestamptz not null default now(),
  -- Enforce exactly one row: a unique constant column that must be TRUE, so
  -- every upsert targets the same row via on_conflict (singleton).
  singleton      boolean not null default true,
  constraint commission_settings_singleton_unique unique (singleton),
  constraint commission_settings_singleton_true check (singleton)
);

-- Seed the single default row (80% technician / 20% platform) if empty.
insert into public.commission_settings (technician_pct, singleton)
select 80, true
where not exists (select 1 from public.commission_settings);

drop trigger if exists trg_commission_settings_updated_at on public.commission_settings;
create trigger trg_commission_settings_updated_at
before update on public.commission_settings
for each row execute function public.update_updated_at_column();

alter table public.commission_settings enable row level security;

-- Any authenticated user may read the split (technicians can show their share).
drop policy if exists "read_commission_settings" on public.commission_settings;
create policy "read_commission_settings" on public.commission_settings
  for select to authenticated using (true);

-- Only admins may change it.
drop policy if exists "admins_insert_commission_settings" on public.commission_settings;
create policy "admins_insert_commission_settings" on public.commission_settings
  for insert to authenticated with check (public.is_admin(auth.uid()));

drop policy if exists "admins_update_commission_settings" on public.commission_settings;
create policy "admins_update_commission_settings" on public.commission_settings
  for update to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
