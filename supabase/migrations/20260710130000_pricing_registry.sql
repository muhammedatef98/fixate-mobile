-- ============================================================================
-- Pricing registry (§4, §5, §16) — a programmable pricing foundation.
--
-- Two tables, both admin-managed with public (authenticated) read of active
-- rows. Both are OPTIONAL overrides: when empty the app keeps its current
-- hardcoded behavior (accessory/protection constants, repairData baselines +
-- platform_settings estimate config). Populate them (manually now, or via a
-- future Excel/file import that bulk-inserts rows with source='import') and
-- the app switches to the managed values cleanly.
-- ============================================================================

create table if not exists public.pricing_addons (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('accessory','protection')),
  device_type text,
  item_key    text not null,
  name_ar     text not null,
  name_en     text not null,
  price       numeric(10,2) not null check (price >= 0),
  sort        int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists pricing_addons_lookup_idx
  on public.pricing_addons (active, kind, device_type, sort);

create table if not exists public.pricing_rules (
  id          uuid primary key default gen_random_uuid(),
  device_type text,
  brand       text,
  model       text,
  category    text,
  repair_type text,
  price       numeric(10,2) not null check (price >= 0),
  active      boolean not null default true,
  source      text not null default 'manual' check (source in ('manual','import')),
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists pricing_rules_lookup_idx
  on public.pricing_rules (active, repair_type, brand, model);

drop trigger if exists trg_pricing_addons_updated_at on public.pricing_addons;
create trigger trg_pricing_addons_updated_at
before update on public.pricing_addons
for each row execute function public.update_updated_at_column();

drop trigger if exists trg_pricing_rules_updated_at on public.pricing_rules;
create trigger trg_pricing_rules_updated_at
before update on public.pricing_rules
for each row execute function public.update_updated_at_column();

alter table public.pricing_addons enable row level security;
alter table public.pricing_rules  enable row level security;

drop policy if exists "read_active_pricing_addons" on public.pricing_addons;
create policy "read_active_pricing_addons" on public.pricing_addons
  for select to authenticated using (active = true);
drop policy if exists "read_active_pricing_rules" on public.pricing_rules;
create policy "read_active_pricing_rules" on public.pricing_rules
  for select to authenticated using (active = true);

drop policy if exists "admins_all_pricing_addons" on public.pricing_addons;
create policy "admins_all_pricing_addons" on public.pricing_addons
  for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
drop policy if exists "admins_all_pricing_rules" on public.pricing_rules;
create policy "admins_all_pricing_rules" on public.pricing_rules
  for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
