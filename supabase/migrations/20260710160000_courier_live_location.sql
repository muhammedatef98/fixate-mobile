-- §12 — the courier broadcasts their live position for an active delivery
-- task; the order's technician (and customer) can track it. One-directional
-- reference (courier_locations -> orders) — no policy cycle (mirrors the
-- technician_locations pattern; see the 2026-07-05 recursion incident).
create table if not exists public.courier_locations (
  task_id    uuid primary key,
  order_id   uuid not null,
  courier_id uuid not null,
  latitude   double precision not null,
  longitude  double precision not null,
  heading    double precision,
  updated_at timestamptz not null default now()
);
create index if not exists courier_locations_order_idx
  on public.courier_locations (order_id);

alter table public.courier_locations enable row level security;

drop policy if exists "Courier upserts own location" on public.courier_locations;
create policy "Courier upserts own location" on public.courier_locations
  for insert to authenticated with check (courier_id = auth.uid());
drop policy if exists "Courier updates own location" on public.courier_locations;
create policy "Courier updates own location" on public.courier_locations
  for update to authenticated
  using (courier_id = auth.uid()) with check (courier_id = auth.uid());
drop policy if exists "Courier reads own location" on public.courier_locations;
create policy "Courier reads own location" on public.courier_locations
  for select to authenticated using (courier_id = auth.uid());

drop policy if exists "Order technician reads courier location" on public.courier_locations;
create policy "Order technician reads courier location" on public.courier_locations
  for select to authenticated using (
    exists (
      select 1 from public.orders o
      where o.id = courier_locations.order_id and o.technician_id = auth.uid()
    )
  );

drop policy if exists "Order customer reads courier location" on public.courier_locations;
create policy "Order customer reads courier location" on public.courier_locations
  for select to authenticated using (
    exists (
      select 1 from public.orders o
      where o.id = courier_locations.order_id and o.user_id = auth.uid()
    )
  );
