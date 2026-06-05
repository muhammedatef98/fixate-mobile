-- Migration: delivery_zones
-- Creates a table for city → neighborhood delivery pricing.
-- The admin configures cities and their sub-neighborhoods, each with its
-- own delivery_fee and an active/inactive toggle.
-- Customer-side lookups join on city + neighborhood name (AR or EN).

create table if not exists public.delivery_zones (
  id                   uuid primary key default gen_random_uuid(),
  city_name_ar         text not null,
  city_name_en         text not null,
  neighborhood_name_ar text not null,
  neighborhood_name_en text not null,
  delivery_fee         numeric(10,2) not null default 0,
  is_active            boolean not null default true,
  sort_order           int not null default 0,
  created_at           timestamptz default now()
);

-- Indexes for the customer-side lookup (city + neighborhood match)
create index if not exists idx_dz_city_ar   on public.delivery_zones (city_name_ar);
create index if not exists idx_dz_city_en   on public.delivery_zones (city_name_en);
create index if not exists idx_dz_active    on public.delivery_zones (is_active);

-- RLS: everyone can read active zones; only admins can write.
alter table public.delivery_zones enable row level security;

create policy "delivery_zones_read_all"
  on public.delivery_zones for select
  using (true);

create policy "delivery_zones_admin_write"
  on public.delivery_zones for all
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and is_admin = true
    )
  );
