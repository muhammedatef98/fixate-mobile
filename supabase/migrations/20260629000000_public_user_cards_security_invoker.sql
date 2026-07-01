-- Resolve the "Security Definer View" advisor on public.public_user_cards.
--
-- The view intentionally exposed a safe, cross-user projection of users
-- (id, name, avatar_url, is_verified) by running as its owner, bypassing the
-- restrictive RLS on public.users. We cannot simply flip it to
-- security_invoker because anon/authenticated hold full-column SELECT on
-- public.users (gated only by RLS); a permissive read policy there would leak
-- email/phone. Instead we back the projection with a dedicated table that only
-- contains the safe columns and is publicly readable, then repoint the view at
-- it as a security_invoker view.

-- 1. Dedicated public-safe projection table.
create table if not exists public.user_public_cards (
  id uuid primary key references public.users(id) on delete cascade,
  name text,
  avatar_url text,
  is_verified boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_public_cards enable row level security;

drop policy if exists "Public can read user cards" on public.user_public_cards;
create policy "Public can read user cards"
  on public.user_public_cards
  for select
  to anon, authenticated
  using (true);

-- Only the sync trigger (definer) and service_role write to this table.
grant select on public.user_public_cards to anon, authenticated;

-- 2. Keep it in sync with users. Soft-deleted users are removed from the
--    public projection (matches the old view's `deleted_at is null` filter).
create or replace function public.sync_user_public_card()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    delete from public.user_public_cards where id = old.id;
    return old;
  end if;

  if (new.deleted_at is not null) then
    delete from public.user_public_cards where id = new.id;
    return new;
  end if;

  insert into public.user_public_cards (id, name, avatar_url, is_verified, updated_at)
  values (new.id, new.name, new.avatar_url, coalesce(new.is_verified, false), now())
  on conflict (id) do update
    set name = excluded.name,
        avatar_url = excluded.avatar_url,
        is_verified = excluded.is_verified,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sync_user_public_card on public.users;
create trigger trg_sync_user_public_card
after insert or update or delete on public.users
for each row execute function public.sync_user_public_card();

-- 3. Backfill from current non-deleted users.
insert into public.user_public_cards (id, name, avatar_url, is_verified)
select id, name, avatar_url, coalesce(is_verified, false)
from public.users
where deleted_at is null
on conflict (id) do update
  set name = excluded.name,
      avatar_url = excluded.avatar_url,
      is_verified = excluded.is_verified,
      updated_at = now();

-- 4. Repoint the public-facing view at the safe table as security_invoker.
create or replace view public.public_user_cards
  with (security_invoker = on) as
  select id, name, avatar_url, is_verified
  from public.user_public_cards;

grant select on public.public_user_cards to anon, authenticated;
