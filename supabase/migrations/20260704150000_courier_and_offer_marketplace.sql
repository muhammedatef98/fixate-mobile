-- ═══════════════════════════════════════════════════════════════════════════
-- Courier role + multi-offer marketplace (2026-07-04)
--
-- 1. `users.role` gains 'courier' — a first-class role, NOT a technician
--    subtype. Couriers are the logistics bridge (device pickup/return legs).
-- 2. `couriers` — courier profile + verification gate, mirroring the
--    `technicians` verification state machine (pending/submitted/approved/
--    rejected/changes_requested) so the admin review flow is consistent.
-- 3. `delivery_tasks` — one row per logistics leg of a pickup&delivery order
--    ('pickup' customer→technician, 'return' technician→customer). Lifecycle:
--    available → accepted → picked_up → delivered → completed (or cancelled).
-- 4. `order_offers` — reverse-marketplace quotes. An order stays customer-
--    owned while status='pending' + technician_id IS NULL (the existing
--    "open" pool, so ALL legacy pending orders participate automatically).
--    Technicians submit offers; the customer accepts exactly one. Acceptance
--    is an atomic SECURITY DEFINER RPC that locks the order row, assigns the
--    winner, expires the rest, and (for pickup orders) spawns the pickup
--    delivery task. The existing broadcast_order_unavailable trigger then
--    removes the order from every technician's available list — unchanged.
--
-- All writes to the new tables flow through RPCs (no direct INSERT/UPDATE
-- grants), which is what makes concurrent acceptance safe.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. users.role: allow 'courier' ─────────────────────────────────────────
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.users'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%role%';
  if cname is not null then
    execute format('alter table public.users drop constraint %I', cname);
  end if;
  alter table public.users
    add constraint users_role_check
    check (role in ('customer', 'technician', 'courier'));
end $$;

-- ── 2. couriers ─────────────────────────────────────────────────────────────
create table if not exists public.couriers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  city text,
  vehicle_type text check (vehicle_type in ('car', 'motorcycle', 'van')) default 'car',
  id_number text,
  verification_status text not null default 'submitted'
    check (verification_status in ('pending', 'submitted', 'approved', 'rejected', 'changes_requested')),
  verification_notes text,
  courier_status text not null default 'active'
    check (courier_status in ('active', 'suspended', 'excluded')),
  available boolean not null default true,
  total_deliveries integer not null default 0,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_couriers_user_id on public.couriers(user_id);
create index if not exists idx_couriers_verification on public.couriers(verification_status);

alter table public.couriers enable row level security;

drop policy if exists "Couriers read own profile" on public.couriers;
create policy "Couriers read own profile"
  on public.couriers for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "Couriers insert own profile" on public.couriers;
create policy "Couriers insert own profile"
  on public.couriers for insert
  with check (auth.uid() = user_id);

drop policy if exists "Couriers update own profile" on public.couriers;
create policy "Couriers update own profile"
  on public.couriers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Admins manage couriers" on public.couriers;
create policy "Admins manage couriers"
  on public.couriers for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ── 3. delivery_tasks ───────────────────────────────────────────────────────
create table if not exists public.delivery_tasks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  task_type text not null check (task_type in ('pickup', 'return')),
  status text not null default 'available'
    check (status in ('available', 'accepted', 'picked_up', 'delivered', 'completed', 'cancelled')),
  courier_id uuid references public.users(id) on delete set null,
  pickup_address text,
  pickup_latitude double precision,
  pickup_longitude double precision,
  pickup_contact_name text,
  pickup_contact_phone text,
  dropoff_address text,
  dropoff_latitude double precision,
  dropoff_longitude double precision,
  dropoff_contact_name text,
  dropoff_contact_phone text,
  notes text,
  courier_fee numeric(10,2),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  -- One pickup leg + one return leg max per order (dedupe guard).
  unique (order_id, task_type)
);

create index if not exists idx_delivery_tasks_status on public.delivery_tasks(status);
create index if not exists idx_delivery_tasks_courier on public.delivery_tasks(courier_id);
create index if not exists idx_delivery_tasks_order on public.delivery_tasks(order_id);

alter table public.delivery_tasks enable row level security;

-- Approved, non-suspended couriers see the open pool + their own tasks.
drop policy if exists "Couriers read available and own tasks" on public.delivery_tasks;
create policy "Couriers read available and own tasks"
  on public.delivery_tasks for select
  using (
    (
      (status = 'available' and courier_id is null)
      or courier_id = auth.uid()
    )
    and exists (
      select 1 from public.couriers c
      where c.user_id = auth.uid()
        and c.verification_status in ('approved', 'verified')
        and c.courier_status = 'active'
    )
  );

-- The order's customer and technician can follow their delivery legs.
drop policy if exists "Order parties read delivery tasks" on public.delivery_tasks;
create policy "Order parties read delivery tasks"
  on public.delivery_tasks for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (o.user_id = auth.uid() or o.technician_id = auth.uid())
    )
  );

drop policy if exists "Admins read delivery tasks" on public.delivery_tasks;
create policy "Admins read delivery tasks"
  on public.delivery_tasks for select
  using (public.is_admin(auth.uid()));

drop policy if exists "Admins manage delivery tasks" on public.delivery_tasks;
create policy "Admins manage delivery tasks"
  on public.delivery_tasks for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ── 4. order_offers ─────────────────────────────────────────────────────────
create table if not exists public.order_offers (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  technician_id uuid not null references public.users(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  note text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'expired', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz,
  -- One offer row per technician per order; re-quotes update it in place, so
  -- the audit trail of the *final* position per tech is unambiguous.
  unique (order_id, technician_id)
);

create index if not exists idx_order_offers_order on public.order_offers(order_id);
create index if not exists idx_order_offers_technician on public.order_offers(technician_id);
create index if not exists idx_order_offers_status on public.order_offers(status);

alter table public.order_offers enable row level security;

drop policy if exists "Technicians read own offers" on public.order_offers;
create policy "Technicians read own offers"
  on public.order_offers for select
  using (technician_id = auth.uid());

drop policy if exists "Customers read offers on own orders" on public.order_offers;
create policy "Customers read offers on own orders"
  on public.order_offers for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = auth.uid()
    )
  );

drop policy if exists "Admins read offers" on public.order_offers;
create policy "Admins read offers"
  on public.order_offers for select
  using (public.is_admin(auth.uid()));

-- NO direct insert/update/delete policies: every mutation goes through the
-- SECURITY DEFINER RPCs below, which enforce role/ownership/state invariants.

-- ── 5. RPCs ─────────────────────────────────────────────────────────────────

-- Technician submits (or revises) a quote on an open request.
create or replace function public.submit_order_offer(
  p_order_id uuid,
  p_amount numeric,
  p_note text default null
) returns public.order_offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_offer public.order_offers%rowtype;
begin
  if p_amount is null or p_amount <= 0 or p_amount > 100000 then
    raise exception 'invalid_amount';
  end if;

  -- Caller must be an approved, active technician.
  if not exists (
    select 1 from public.technicians t
    where t.user_id = auth.uid()
      and t.verification_status in ('approved', 'verified')
      and coalesce(t.technician_status, 'active') not in ('suspended', 'excluded')
  ) then
    raise exception 'not_eligible_technician';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.status <> 'pending' or v_order.technician_id is not null then
    raise exception 'order_not_open';
  end if;

  insert into public.order_offers (order_id, technician_id, amount, note)
  values (p_order_id, auth.uid(), round(p_amount, 2), nullif(trim(p_note), ''))
  on conflict (order_id, technician_id) do update
    set amount = excluded.amount,
        note = excluded.note,
        status = 'pending',
        updated_at = now(),
        decided_at = null
    where public.order_offers.status in ('pending', 'withdrawn', 'expired')
  returning * into v_offer;

  if v_offer.id is null then
    -- Conflict row exists but was accepted/rejected — no resurrection.
    raise exception 'offer_already_decided';
  end if;

  return v_offer;
end;
$$;

-- Customer accepts one offer: atomic winner assignment + close the rest.
create or replace function public.accept_order_offer(p_offer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.order_offers%rowtype;
  v_order public.orders%rowtype;
  v_fulfillment text;
begin
  select * into v_offer from public.order_offers where id = p_offer_id;
  if not found then
    raise exception 'offer_not_found';
  end if;

  -- Lock the order first: concurrent accepts serialize here.
  select * into v_order from public.orders where id = v_offer.order_id for update;
  if v_order.user_id is distinct from auth.uid() then
    raise exception 'not_order_owner';
  end if;
  if v_order.status <> 'pending' or v_order.technician_id is not null then
    raise exception 'order_no_longer_open';
  end if;

  -- Re-read the offer under the order lock.
  select * into v_offer from public.order_offers where id = p_offer_id for update;
  if v_offer.status <> 'pending' then
    raise exception 'offer_no_longer_open';
  end if;

  update public.orders
    set technician_id = v_offer.technician_id,
        status = 'accepted',
        estimated_price = v_offer.amount,
        updated_at = now()
    where id = v_order.id;

  update public.order_offers
    set status = 'accepted', decided_at = now(), updated_at = now()
    where id = v_offer.id;

  -- Competing offers close consistently as 'expired' (customer-rejected ones
  -- keep their explicit 'rejected' state for auditability).
  update public.order_offers
    set status = 'expired', decided_at = now(), updated_at = now()
    where order_id = v_order.id
      and id <> v_offer.id
      and status = 'pending';

  -- Pickup & delivery orders get their pickup logistics leg now — the
  -- earliest correct moment: a courier is only needed once a specific
  -- technician is committed.
  v_fulfillment := coalesce(v_order.fulfillment_type, v_order.service_type);
  if v_fulfillment in ('pickup', 'pickup_delivery') then
    insert into public.delivery_tasks (
      order_id, task_type, status,
      pickup_address, pickup_latitude, pickup_longitude,
      pickup_contact_phone,
      dropoff_address, notes
    ) values (
      v_order.id, 'pickup', 'available',
      v_order.address, v_order.latitude, v_order.longitude,
      v_order.customer_phone,
      null,
      'Pickup the device from the customer and deliver it to the assigned technician.'
    )
    on conflict (order_id, task_type) do nothing;
  end if;

  return v_order.id;
end;
$$;

-- Customer declines a specific offer.
create or replace function public.reject_order_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.order_offers%rowtype;
begin
  select o.* into v_offer
  from public.order_offers o
  join public.orders ord on ord.id = o.order_id
  where o.id = p_offer_id and ord.user_id = auth.uid()
  for update of o;
  if not found then
    raise exception 'offer_not_found';
  end if;
  if v_offer.status <> 'pending' then
    raise exception 'offer_no_longer_open';
  end if;
  update public.order_offers
    set status = 'rejected', decided_at = now(), updated_at = now()
    where id = p_offer_id;
end;
$$;

-- Technician withdraws their own pending offer.
create or replace function public.withdraw_order_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.order_offers
    set status = 'withdrawn', decided_at = now(), updated_at = now()
    where id = p_offer_id
      and technician_id = auth.uid()
      and status = 'pending';
  if not found then
    raise exception 'offer_not_open';
  end if;
end;
$$;

-- Courier claims an available task (atomic, race-safe).
create or replace function public.accept_delivery_task(p_task_id uuid)
returns public.delivery_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.delivery_tasks%rowtype;
begin
  if not exists (
    select 1 from public.couriers c
    where c.user_id = auth.uid()
      and c.verification_status in ('approved', 'verified')
      and c.courier_status = 'active'
  ) then
    raise exception 'not_eligible_courier';
  end if;

  update public.delivery_tasks
    set status = 'accepted', courier_id = auth.uid(), accepted_at = now()
    where id = p_task_id and status = 'available' and courier_id is null
    returning * into v_task;
  if v_task.id is null then
    raise exception 'task_no_longer_available';
  end if;
  return v_task;
end;
$$;

-- Courier advances their own task through the fixed lifecycle.
create or replace function public.advance_delivery_task(
  p_task_id uuid,
  p_next_status text
) returns public.delivery_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.delivery_tasks%rowtype;
  v_expected text;
begin
  v_expected := case p_next_status
    when 'picked_up' then 'accepted'
    when 'delivered' then 'picked_up'
    when 'completed' then 'delivered'
    else null
  end;
  if v_expected is null then
    raise exception 'invalid_transition';
  end if;

  update public.delivery_tasks
    set status = p_next_status,
        picked_up_at = case when p_next_status = 'picked_up' then now() else picked_up_at end,
        delivered_at = case when p_next_status = 'delivered' then now() else delivered_at end,
        completed_at = case when p_next_status = 'completed' then now() else completed_at end
    where id = p_task_id
      and courier_id = auth.uid()
      and status = v_expected
    returning * into v_task;
  if v_task.id is null then
    raise exception 'invalid_task_state';
  end if;
  return v_task;
end;
$$;

-- Technician requests the return leg once the repair heads back to the
-- customer (order in 'delivering'). Idempotent via the unique constraint.
create or replace function public.create_return_delivery_task(p_order_id uuid)
returns public.delivery_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_task public.delivery_tasks%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.technician_id is distinct from auth.uid() then
    raise exception 'not_order_technician';
  end if;
  if coalesce(v_order.fulfillment_type, v_order.service_type) not in ('pickup', 'pickup_delivery') then
    raise exception 'order_not_pickup';
  end if;
  if v_order.status not in ('testing', 'delivering') then
    raise exception 'order_not_ready_for_return';
  end if;

  insert into public.delivery_tasks (
    order_id, task_type, status,
    dropoff_address, dropoff_latitude, dropoff_longitude,
    dropoff_contact_phone, notes
  ) values (
    p_order_id, 'return', 'available',
    v_order.address, v_order.latitude, v_order.longitude,
    v_order.customer_phone,
    'Collect the repaired device from the technician and return it to the customer.'
  )
  on conflict (order_id, task_type) do nothing
  returning * into v_task;

  if v_task.id is null then
    select * into v_task from public.delivery_tasks
    where order_id = p_order_id and task_type = 'return';
  end if;
  return v_task;
end;
$$;

-- Grants: authenticated only (mirrors 20260627 anon-revoke policy).
revoke execute on function public.submit_order_offer(uuid, numeric, text) from public, anon;
revoke execute on function public.accept_order_offer(uuid) from public, anon;
revoke execute on function public.reject_order_offer(uuid) from public, anon;
revoke execute on function public.withdraw_order_offer(uuid) from public, anon;
revoke execute on function public.accept_delivery_task(uuid) from public, anon;
revoke execute on function public.advance_delivery_task(uuid, text) from public, anon;
revoke execute on function public.create_return_delivery_task(uuid) from public, anon;
grant execute on function public.submit_order_offer(uuid, numeric, text) to authenticated;
grant execute on function public.accept_order_offer(uuid) to authenticated;
grant execute on function public.reject_order_offer(uuid) to authenticated;
grant execute on function public.withdraw_order_offer(uuid) to authenticated;
grant execute on function public.accept_delivery_task(uuid) to authenticated;
grant execute on function public.advance_delivery_task(uuid, text) to authenticated;
grant execute on function public.create_return_delivery_task(uuid) to authenticated;

-- ── 6. Realtime ─────────────────────────────────────────────────────────────
-- Customers watch offers arrive live; couriers watch the open task pool.
do $$
begin
  begin
    alter publication supabase_realtime add table public.order_offers;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.delivery_tasks;
  exception when duplicate_object then null;
  end;
end $$;

comment on table public.couriers is 'Courier (delivery driver) profiles + verification gate. Distinct first-class role, not a technician subtype.';
comment on table public.delivery_tasks is 'Logistics legs for pickup&delivery repair orders: pickup (customer→technician) and return (technician→customer).';
comment on table public.order_offers is 'Reverse-marketplace technician quotes on open repair requests. Mutations only via SECURITY DEFINER RPCs.';
