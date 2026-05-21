-- Market buyer/seller DM threads (defined in an earlier migration that
-- was never applied) + a public-profile view so listing/comment authors
-- are readable without exposing the RLS-protected users table.

create table if not exists public.market_threads (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.market_listings(id) on delete cascade,
  buyer_id    uuid not null references auth.users(id) on delete cascade,
  seller_id   uuid not null references auth.users(id) on delete cascade,
  last_message_at timestamptz default now(),
  unread_for_buyer  boolean not null default false,
  unread_for_seller boolean not null default false,
  created_at  timestamptz default now(),
  unique(listing_id, buyer_id)
);
create index if not exists idx_market_threads_seller on public.market_threads(seller_id, last_message_at desc);
create index if not exists idx_market_threads_buyer  on public.market_threads(buyer_id,  last_message_at desc);

create table if not exists public.market_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.market_threads(id) on delete cascade,
  sender_id  uuid not null references auth.users(id) on delete cascade,
  content    text not null,
  created_at timestamptz default now()
);
create index if not exists idx_market_messages_thread on public.market_messages(thread_id, created_at);

alter table public.market_threads  enable row level security;
alter table public.market_messages enable row level security;

drop policy if exists "Participants read market thread" on public.market_threads;
create policy "Participants read market thread" on public.market_threads for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id or public.is_admin(auth.uid()));

drop policy if exists "Buyer creates market thread" on public.market_threads;
create policy "Buyer creates market thread" on public.market_threads for insert
  with check (auth.uid() = buyer_id);

drop policy if exists "Participants update market thread" on public.market_threads;
create policy "Participants update market thread" on public.market_threads for update
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "Participants read market messages" on public.market_messages;
create policy "Participants read market messages" on public.market_messages for select
  using (exists (
    select 1 from public.market_threads t
     where t.id = market_messages.thread_id
       and (t.buyer_id = auth.uid() or t.seller_id = auth.uid() or public.is_admin(auth.uid()))
  ));

drop policy if exists "Participants insert market messages" on public.market_messages;
create policy "Participants insert market messages" on public.market_messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.market_threads t
       where t.id = market_messages.thread_id
         and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
    )
  );

create or replace function public.market_message_after_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_buyer uuid;
  v_seller uuid;
begin
  select buyer_id, seller_id into v_buyer, v_seller
    from public.market_threads where id = NEW.thread_id;

  update public.market_threads
     set last_message_at  = NEW.created_at,
         unread_for_buyer  = case when NEW.sender_id = v_buyer  then unread_for_buyer  else true end,
         unread_for_seller = case when NEW.sender_id = v_seller then unread_for_seller else true end
   where id = NEW.thread_id;
  return NEW;
end;
$$;

drop trigger if exists trg_market_message_insert on public.market_messages;
create trigger trg_market_message_insert
  after insert on public.market_messages
  for each row execute function public.market_message_after_insert();

do $$
begin
  alter publication supabase_realtime add table public.market_messages;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.market_threads;
exception when duplicate_object then null;
end $$;

-- Public-profile view: only id, name, avatar_url. Runs with the view
-- owner's rights so callers can read any user's display card without
-- the users table's restrictive RLS blocking them.
create or replace view public.public_user_cards as
  select id, name, avatar_url from public.users;

grant select on public.public_user_cards to authenticated, anon;

-- In-app notification when a market DM arrives (depends on create_notification
-- from the notifications_center migration).
create or replace function public.notify_market_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_buyer uuid;
  v_seller uuid;
  v_listing uuid;
  v_recipient uuid;
begin
  select buyer_id, seller_id, listing_id into v_buyer, v_seller, v_listing
    from public.market_threads where id = NEW.thread_id;

  if NEW.sender_id = v_buyer then
    v_recipient := v_seller;
  else
    v_recipient := v_buyer;
  end if;

  if v_recipient is not null and v_recipient <> NEW.sender_id then
    perform public.create_notification(
      v_recipient,
      'رسالة جديدة في السوق',
      'New market message',
      left(NEW.content, 140),
      left(NEW.content, 140),
      'listing', v_listing);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_market_message on public.market_messages;
create trigger trg_notify_market_message
  after insert on public.market_messages
  for each row execute function public.notify_market_message();
