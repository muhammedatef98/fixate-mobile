-- ============================================================================
-- Offers & Discounts (عروض وخصومات)
-- Recovered verbatim from the remote migration history
-- (supabase_migrations.schema_migrations.statements) after the local file
-- was lost in a rebase. Already applied on remote; idempotent.
-- ============================================================================
create table if not exists public.offers (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  discount_pct integer check (discount_pct between 0 and 100),
  valid_from   timestamptz not null default now(),
  valid_until  timestamptz,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists offers_active_idx on public.offers (is_active, valid_until);

drop trigger if exists trg_offers_updated_at on public.offers;
create trigger trg_offers_updated_at
before update on public.offers
for each row execute function public.update_updated_at_column();

alter table public.offers enable row level security;

drop policy if exists "clients_read_active_offers" on public.offers;
create policy "clients_read_active_offers" on public.offers
  for select to authenticated
  using (
    is_active = true
    and (valid_from is null or valid_from <= now())
    and (valid_until is null or valid_until >= now())
  );

drop policy if exists "admins_read_all_offers" on public.offers;
create policy "admins_read_all_offers" on public.offers
  for select to authenticated using (public.is_admin(auth.uid()));

drop policy if exists "admins_insert_offers" on public.offers;
create policy "admins_insert_offers" on public.offers
  for insert to authenticated with check (public.is_admin(auth.uid()));

drop policy if exists "admins_update_offers" on public.offers;
create policy "admins_update_offers" on public.offers
  for update to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admins_delete_offers" on public.offers;
create policy "admins_delete_offers" on public.offers
  for delete to authenticated using (public.is_admin(auth.uid()));
