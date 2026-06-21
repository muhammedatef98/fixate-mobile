-- Realtime broadcast when an order leaves the pending+unassigned pool, so
-- every technician's available-orders list updates instantly.
-- Recovered verbatim from the remote migration history
-- (supabase_migrations.schema_migrations.statements) after the local file
-- was lost in a rebase. Already applied on remote; idempotent.

-- 1) Realtime Authorization
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname = 'Authenticated can receive order broadcasts'
  ) then
    create policy "Authenticated can receive order broadcasts"
      on realtime.messages
      for select
      to authenticated
      using (true);
  end if;
end $$;

-- 2) Trigger function
create or replace function public.broadcast_order_unavailable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (old.status = 'pending' and old.technician_id is null)
     and (new.status is distinct from 'pending' or new.technician_id is not null)
  then
    perform realtime.send(
      jsonb_build_object('id', new.id, 'status', new.status),
      'order_unavailable',
      'available-orders',
      true
    );
  end if;
  return new;
end;
$$;

-- 3) Attach the trigger
drop trigger if exists trg_broadcast_order_unavailable on public.orders;
create trigger trg_broadcast_order_unavailable
after update on public.orders
for each row
execute function public.broadcast_order_unavailable();

-- 4) Comment
comment on function public.broadcast_order_unavailable() is
  'Broadcasts {id,status} to the private "available-orders" Realtime topic '
  'when an order leaves the pending+unassigned pool, so every technician''s '
  'available-orders list updates instantly.';
