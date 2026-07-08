-- ═══════════════════════════════════════════════════════════════════════════
-- Payment architecture v2 (2026-07-08)
--
-- The accepted marketplace offer becomes the customer-facing price basis.
-- The old post-inspection quote flow ('quoted' → customer approval) is
-- retired from the active journey.
--
-- 1. orders: accepted_offer_amount / payment_mode / upfront_amount_due /
--    amount_paid — separate fields per money concept (no more overloading
--    estimated_price with the accepted offer).
-- 2. Admin-configurable payment modes in platform_settings:
--       full_upfront | deposit_then_rest | partial_then_final
--    accept_order_offer snapshots the active mode onto the order, so a later
--    admin change never rewrites live orders.
-- 3. record_order_payment RPC — the only way money gets marked as collected
--    (customer, assigned technician, or admin). Writes a payments row and
--    bumps orders.amount_paid/payment_status atomically.
-- 4. courier_chat_messages — courier ↔ technician operational chat, scoped
--    to one delivery task. Auto-closes at the DB level when the task
--    completes/cancels (INSERT check on task status).
-- 5. order_timeline gains courier steps via a trigger on delivery_tasks.
-- 6. Data migration for live rows: in-flight 'quoted' orders move to
--    'awaiting_payment' (payment confirmation is the new approval moment);
--    agreed-price backfill for assigned orders.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. orders money columns ─────────────────────────────────────────────────
alter table public.orders
  add column if not exists accepted_offer_amount numeric(10,2),
  add column if not exists payment_mode text
    check (payment_mode in ('full_upfront', 'deposit_then_rest', 'partial_then_final')),
  add column if not exists upfront_amount_due numeric(10,2),
  add column if not exists amount_paid numeric(10,2) not null default 0,
  add column if not exists amount_paid_at timestamptz;

-- payment_status gains 'partially_paid' (modes B/C between the two payments).
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.orders'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%payment_status%';
  if cname is not null then
    execute format('alter table public.orders drop constraint %I', cname);
  end if;
  alter table public.orders
    add constraint orders_payment_status_check
    check (payment_status in ('unpaid', 'pending', 'paid', 'pending_payment', 'refunded', 'partially_paid'));
end $$;

comment on column public.orders.accepted_offer_amount is
  'The accepted marketplace offer — the customer-facing service price basis. estimated_price stays the initial estimate.';
comment on column public.orders.payment_mode is
  'Payment-policy snapshot taken at offer acceptance (full_upfront | deposit_then_rest | partial_then_final).';
comment on column public.orders.upfront_amount_due is
  'Amount due immediately after accepting the offer, per the snapshotted payment mode.';
comment on column public.orders.amount_paid is
  'Total actually collected so far (all record_order_payment calls). Remaining balance = customer total − amount_paid (derived, never stored).';

-- ── 2. payment-mode settings defaults ───────────────────────────────────────
insert into public.platform_settings (key, value)
values
  ('payment_mode_active', to_jsonb('full_upfront'::text)),
  ('payment_deposit_type', to_jsonb('fixed'::text)),
  ('payment_deposit_value', to_jsonb(50)),
  ('payment_partial_percent', to_jsonb(50))
on conflict (key) do nothing;

-- ── helper: customer-facing total for an order ──────────────────────────────
-- accepted offer (or legacy final_price/estimated_price) + delivery + add-ons
-- − discount. Internal spare_parts_cost is deliberately NOT part of this.
create or replace function public.order_customer_total(o public.orders)
returns numeric
language sql
stable
as $$
  select greatest(0, round(
    coalesce(o.accepted_offer_amount, o.final_price, o.estimated_price, 0)
    + coalesce(o.delivery_fee, 0)
    + coalesce((select sum((a->>'price')::numeric)
                from jsonb_array_elements(coalesce(o.accessories, '[]'::jsonb)) a), 0)
    + coalesce((select sum((a->>'price')::numeric)
                from jsonb_array_elements(coalesce(o.protection_addons, '[]'::jsonb)) a), 0)
    - coalesce(o.discount_amount, 0)
  , 2));
$$;

-- helper: due-now amount for a total under the active platform payment mode.
create or replace function public.payment_upfront_due(p_total numeric)
returns table (mode text, due numeric)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_mode text;
  v_dep_type text;
  v_dep_value numeric;
  v_partial_pct numeric;
begin
  select coalesce(value #>> '{}', 'full_upfront') into v_mode
    from public.platform_settings where key = 'payment_mode_active';
  v_mode := coalesce(v_mode, 'full_upfront');
  if v_mode not in ('full_upfront', 'deposit_then_rest', 'partial_then_final') then
    v_mode := 'full_upfront';
  end if;

  if v_mode = 'full_upfront' then
    return query select v_mode, round(p_total, 2);
  elsif v_mode = 'deposit_then_rest' then
    select coalesce(value #>> '{}', 'fixed') into v_dep_type
      from public.platform_settings where key = 'payment_deposit_type';
    select coalesce((value #>> '{}')::numeric, 50) into v_dep_value
      from public.platform_settings where key = 'payment_deposit_value';
    if coalesce(v_dep_type, 'fixed') = 'percent' then
      return query select v_mode, least(round(p_total * coalesce(v_dep_value, 50) / 100.0, 2), round(p_total, 2));
    else
      return query select v_mode, least(round(coalesce(v_dep_value, 50), 2), round(p_total, 2));
    end if;
  else -- partial_then_final
    select coalesce((value #>> '{}')::numeric, 50) into v_partial_pct
      from public.platform_settings where key = 'payment_partial_percent';
    return query select v_mode, least(round(p_total * coalesce(v_partial_pct, 50) / 100.0, 2), round(p_total, 2));
  end if;
end;
$$;

-- ── 3. accept_order_offer v2 ────────────────────────────────────────────────
-- Changes vs v1:
--   • estimated_price is NO LONGER overwritten (it stays the initial estimate)
--   • accepted_offer_amount = winning offer
--   • payment mode + upfront due snapshotted from platform_settings
--   • order goes to 'awaiting_payment' (customer pays immediately after accepting)
--   • pickup delivery task gets contact names for both stops
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
  v_total numeric;
  v_mode text;
  v_due numeric;
  v_customer_name text;
  v_tech_name text;
  v_tech_phone text;
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

  select * into v_offer from public.order_offers where id = p_offer_id for update;
  if v_offer.status <> 'pending' then
    raise exception 'offer_no_longer_open';
  end if;

  -- Snapshot the payment policy against the accepted amount.
  v_order.accepted_offer_amount := v_offer.amount;
  v_total := public.order_customer_total(v_order);
  select p.mode, p.due into v_mode, v_due from public.payment_upfront_due(v_total) p;

  update public.orders
    set technician_id = v_offer.technician_id,
        status = 'awaiting_payment',
        accepted_offer_amount = v_offer.amount,
        payment_mode = v_mode,
        upfront_amount_due = v_due,
        updated_at = now()
    where id = v_order.id;

  update public.order_offers
    set status = 'accepted', decided_at = now(), updated_at = now()
    where id = v_offer.id;

  update public.order_offers
    set status = 'expired', decided_at = now(), updated_at = now()
    where order_id = v_order.id
      and id <> v_offer.id
      and status = 'pending';

  -- Pickup & delivery orders get their pickup logistics leg now.
  v_fulfillment := coalesce(v_order.fulfillment_type, v_order.service_type);
  if v_fulfillment in ('pickup', 'pickup_delivery') then
    select name into v_customer_name from public.users where id = v_order.user_id;
    select u.name, u.phone into v_tech_name, v_tech_phone
      from public.users u
      where u.id = v_offer.technician_id;

    insert into public.delivery_tasks (
      order_id, task_type, status,
      pickup_address, pickup_latitude, pickup_longitude,
      pickup_contact_name, pickup_contact_phone,
      dropoff_contact_name, dropoff_contact_phone,
      notes
    ) values (
      v_order.id, 'pickup', 'available',
      v_order.address, v_order.latitude, v_order.longitude,
      v_customer_name, v_order.customer_phone,
      v_tech_name, v_tech_phone,
      'Pickup the device from the customer and deliver it to the assigned technician.'
    )
    on conflict (order_id, task_type) do nothing;
  end if;

  return v_order.id;
end;
$$;

-- create_return_delivery_task: also carry contact names for both stops.
create or replace function public.create_return_delivery_task(p_order_id uuid)
returns public.delivery_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_task public.delivery_tasks%rowtype;
  v_customer_name text;
  v_tech_name text;
  v_tech_phone text;
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

  select name into v_customer_name from public.users where id = v_order.user_id;
  select u.name, u.phone into v_tech_name, v_tech_phone
    from public.users u
    where u.id = v_order.technician_id;

  insert into public.delivery_tasks (
    order_id, task_type, status,
    pickup_contact_name, pickup_contact_phone,
    dropoff_address, dropoff_latitude, dropoff_longitude,
    dropoff_contact_name, dropoff_contact_phone, notes
  ) values (
    p_order_id, 'return', 'available',
    v_tech_name, v_tech_phone,
    v_order.address, v_order.latitude, v_order.longitude,
    v_customer_name, v_order.customer_phone,
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

-- ── 4. record_order_payment ─────────────────────────────────────────────────
-- The single write path for "money was collected". Caller must be the order's
-- customer, its assigned technician, or an admin. Inserts a payments row and
-- bumps orders.amount_paid / payment_status atomically.
create or replace function public.record_order_payment(
  p_order_id uuid,
  p_amount numeric,
  p_method text default 'cash',
  p_note text default null
) returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_total numeric;
  v_new_paid numeric;
begin
  if p_amount is null or p_amount <= 0 or p_amount > 100000 then
    raise exception 'invalid_amount';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;
  if auth.uid() is distinct from v_order.user_id
     and auth.uid() is distinct from v_order.technician_id
     and not public.is_admin(auth.uid()) then
    raise exception 'not_order_party';
  end if;

  v_total := public.order_customer_total(v_order);
  v_new_paid := round(coalesce(v_order.amount_paid, 0) + p_amount, 2);
  if v_new_paid > v_total + 0.01 then
    raise exception 'amount_exceeds_total';
  end if;

  insert into public.payments (order_id, user_id, provider, amount, currency, status, metadata)
  values (
    p_order_id, v_order.user_id, coalesce(nullif(trim(p_method), ''), 'cash'),
    round(p_amount, 2), 'SAR', 'succeeded',
    jsonb_build_object('recorded_by', auth.uid(), 'note', p_note)
  );

  update public.orders
    set amount_paid = v_new_paid,
        amount_paid_at = now(),
        payment_status = case when v_new_paid + 0.01 >= v_total then 'paid' else 'partially_paid' end,
        updated_at = now()
    where id = p_order_id
    returning * into v_order;

  return v_order;
end;
$$;

revoke execute on function public.record_order_payment(uuid, numeric, text, text) from public, anon;
grant execute on function public.record_order_payment(uuid, numeric, text, text) to authenticated;

-- ── 5. courier ↔ technician chat ────────────────────────────────────────────
create table if not exists public.courier_chat_messages (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.delivery_tasks(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_courier_chat_task on public.courier_chat_messages(task_id, created_at);

alter table public.courier_chat_messages enable row level security;

-- Participants = the task's courier + the order's assigned technician.
-- (SECURITY DEFINER helper to avoid cross-table RLS recursion — see
-- 20260705150000_fix_orders_rls_recursion.)
create or replace function public.is_courier_chat_participant(p_task_id uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.delivery_tasks dt
    join public.orders o on o.id = dt.order_id
    where dt.id = p_task_id
      and (dt.courier_id = p_user or o.technician_id = p_user)
  );
$$;

revoke execute on function public.is_courier_chat_participant(uuid, uuid) from public, anon;
grant execute on function public.is_courier_chat_participant(uuid, uuid) to authenticated;

drop policy if exists "Participants read courier chat" on public.courier_chat_messages;
create policy "Participants read courier chat"
  on public.courier_chat_messages for select
  using (
    public.is_courier_chat_participant(task_id, auth.uid())
    or public.is_admin(auth.uid())
  );

-- Auto-close: inserts only while the task is live (accepted/picked_up/
-- delivered). Once completed or cancelled the chat is read-only.
drop policy if exists "Participants send courier chat" on public.courier_chat_messages;
create policy "Participants send courier chat"
  on public.courier_chat_messages for insert
  with check (
    sender_id = auth.uid()
    and public.is_courier_chat_participant(task_id, auth.uid())
    and exists (
      select 1 from public.delivery_tasks dt
      where dt.id = task_id
        and dt.status in ('accepted', 'picked_up', 'delivered')
    )
  );

drop policy if exists "Participants mark courier chat read" on public.courier_chat_messages;
create policy "Participants mark courier chat read"
  on public.courier_chat_messages for update
  using (public.is_courier_chat_participant(task_id, auth.uid()))
  with check (public.is_courier_chat_participant(task_id, auth.uid()));

do $$
begin
  begin
    alter publication supabase_realtime add table public.courier_chat_messages;
  exception when duplicate_object then null;
  end;
end $$;

comment on table public.courier_chat_messages is
  'Operational chat between the courier of a delivery task and the order''s technician. Customer is never a participant. Auto-closes (insert-blocked) once the task completes/cancels.';

-- ── 6. courier steps in the order timeline ──────────────────────────────────
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.order_timeline'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%actor_type%';
  if cname is not null then
    execute format('alter table public.order_timeline drop constraint %I', cname);
  end if;
  alter table public.order_timeline
    add constraint order_timeline_actor_type_check
    check (actor_type in ('customer', 'technician', 'admin', 'system', 'courier'));
end $$;

create or replace function public.log_delivery_task_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status
     and new.status in ('accepted', 'picked_up', 'delivered') then
    insert into public.order_timeline (order_id, status, actor_type, actor_id)
    values (
      new.order_id,
      'courier_' || new.task_type || '_' || new.status,
      'courier',
      new.courier_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_delivery_task_change on public.delivery_tasks;
create trigger trg_log_delivery_task_change
after update of status on public.delivery_tasks
for each row execute function public.log_delivery_task_change();

-- ── 7. data migration for live rows ─────────────────────────────────────────
-- In-flight 'quoted' orders: the customer never approved the quote under the
-- old flow. Under the new flow the payment-confirmation screen IS the
-- approval moment, so they move to 'awaiting_payment' with the quote as the
-- agreed basis (they can still cancel there).
update public.orders o
set accepted_offer_amount = coalesce(o.accepted_offer_amount, o.final_price),
    payment_mode = coalesce(o.payment_mode, 'full_upfront'),
    upfront_amount_due = coalesce(o.upfront_amount_due, public.order_customer_total(o)),
    status = 'awaiting_payment',
    updated_at = now()
where o.status = 'quoted';

-- Existing 'awaiting_payment' orders: backfill the new money fields.
update public.orders o
set accepted_offer_amount = coalesce(o.accepted_offer_amount, o.final_price, o.estimated_price),
    payment_mode = coalesce(o.payment_mode, 'full_upfront'),
    upfront_amount_due = coalesce(o.upfront_amount_due, public.order_customer_total(o))
where o.status = 'awaiting_payment' and o.accepted_offer_amount is null;

-- Assigned in-progress / completed orders: agreed price = legacy quote or
-- (marketplace) estimate copied at acceptance time.
update public.orders o
set accepted_offer_amount = coalesce(o.final_price, o.estimated_price)
where o.technician_id is not null
  and o.accepted_offer_amount is null
  and o.status in ('accepted','picking_up','diagnosing','waiting_parts','repairing','testing','delivering','completed');

-- Completed orders already marked paid: reflect the collected amount so
-- reports show the true paid total.
update public.orders o
set amount_paid = public.order_customer_total(o),
    amount_paid_at = coalesce(o.amount_paid_at, o.updated_at, now())
where o.status = 'completed'
  and o.payment_status = 'paid'
  and coalesce(o.amount_paid, 0) = 0;
