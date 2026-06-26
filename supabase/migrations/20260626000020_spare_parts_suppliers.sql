-- ============================================================================
-- Spare-parts suppliers (موردو قطع الغيار) — §12
-- Admins manage a directory of suppliers; technicians open it from an order to
-- WhatsApp a supplier for a part.
-- ============================================================================
create table if not exists public.spare_parts_suppliers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  whatsapp_number text not null,
  specialty       text,
  notes           text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists spare_parts_suppliers_active_idx
  on public.spare_parts_suppliers (is_active, name);

drop trigger if exists trg_spare_parts_suppliers_updated_at on public.spare_parts_suppliers;
create trigger trg_spare_parts_suppliers_updated_at
before update on public.spare_parts_suppliers
for each row execute function public.update_updated_at_column();

alter table public.spare_parts_suppliers enable row level security;

-- Any authenticated user (technicians) may read active suppliers.
drop policy if exists "read_active_suppliers" on public.spare_parts_suppliers;
create policy "read_active_suppliers" on public.spare_parts_suppliers
  for select to authenticated using (is_active = true);

-- Admins can see everything (including inactive) and manage the directory.
drop policy if exists "admins_read_all_suppliers" on public.spare_parts_suppliers;
create policy "admins_read_all_suppliers" on public.spare_parts_suppliers
  for select to authenticated using (public.is_admin(auth.uid()));

drop policy if exists "admins_insert_suppliers" on public.spare_parts_suppliers;
create policy "admins_insert_suppliers" on public.spare_parts_suppliers
  for insert to authenticated with check (public.is_admin(auth.uid()));

drop policy if exists "admins_update_suppliers" on public.spare_parts_suppliers;
create policy "admins_update_suppliers" on public.spare_parts_suppliers
  for update to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admins_delete_suppliers" on public.spare_parts_suppliers;
create policy "admins_delete_suppliers" on public.spare_parts_suppliers
  for delete to authenticated using (public.is_admin(auth.uid()));
