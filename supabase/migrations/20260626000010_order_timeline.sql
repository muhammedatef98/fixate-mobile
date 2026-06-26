-- ============================================================================
-- Order timeline (الخط الزمني للطلب) — §13
-- Records every order status change. A trigger on `orders` captures changes
-- made anywhere in the app (admin, technician, customer, edge functions), so
-- we never have to instrument individual call sites. `order_id` cascades on
-- delete so clearing an order removes its timeline.
-- ============================================================================
create table if not exists public.order_timeline (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  status      text not null,
  -- Who performed the change: customer | technician | admin | system.
  actor_type  text not null default 'system' check (actor_type in ('customer','technician','admin','system')),
  actor_id    uuid,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists order_timeline_order_idx
  on public.order_timeline (order_id, created_at);

alter table public.order_timeline enable row level security;

-- The order's owner, its assigned technician, or an admin may read the timeline.
drop policy if exists "read_order_timeline" on public.order_timeline;
create policy "read_order_timeline" on public.order_timeline
  for select to authenticated
  using (
    public.is_admin(auth.uid())
    or exists (
      select 1 from public.orders o
      where o.id = order_timeline.order_id
        and (o.user_id = auth.uid() or o.technician_id = auth.uid())
    )
  );

-- Rows are written by the SECURITY DEFINER trigger below (which bypasses RLS),
-- so no client INSERT policy is required.

-- ── Trigger: log status changes ────────────────────────────────────────────
create or replace function public.log_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role  text;
  v_actor_type text := 'system';
begin
  if (tg_op = 'INSERT') then
    insert into public.order_timeline (order_id, status, actor_type, actor_id)
    values (new.id, new.status, 'system', v_actor);
    return new;
  end if;

  if (new.status is distinct from old.status) then
    if v_actor is not null then
      if public.is_admin(v_actor) then
        v_actor_type := 'admin';
      else
        select role into v_role from public.users where id = v_actor;
        if v_role = 'technician' then
          v_actor_type := 'technician';
        elsif v_role is not null then
          v_actor_type := 'customer';
        end if;
      end if;
    end if;

    insert into public.order_timeline (order_id, status, actor_type, actor_id)
    values (new.id, new.status, v_actor_type, v_actor);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_log_order_status_change on public.orders;
create trigger trg_log_order_status_change
after insert or update of status on public.orders
for each row execute function public.log_order_status_change();

-- ── Backfill: seed a single 'system' row for existing orders so their
-- timelines aren't empty until the next status change. ──────────────────────
insert into public.order_timeline (order_id, status, actor_type, created_at)
select o.id, o.status, 'system', coalesce(o.updated_at, o.created_at, now())
from public.orders o
where not exists (
  select 1 from public.order_timeline t where t.order_id = o.id
);
