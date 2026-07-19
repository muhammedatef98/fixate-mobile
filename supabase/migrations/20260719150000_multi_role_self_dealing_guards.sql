-- Multi-role accounts: one auth account may now hold several roles (customer
-- + technician + courier). The client walls that used to keep roles apart are
-- removed, so the server must prevent SELF-DEALING:
--   * a technician must not offer on their own customer order
--   * a courier must not deliver an order they are the customer or the
--     technician of (they'd be confirming their own handoffs)

create or replace function public.submit_order_offer(p_order_id uuid, p_amount numeric, p_note text default null::text)
returns public.order_offers
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_order public.orders%rowtype;
  v_offer public.order_offers%rowtype;
begin
  if p_amount is null or p_amount <= 0 or p_amount > 100000 then
    raise exception 'invalid_amount';
  end if;

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

  -- Multi-role guard: the requester cannot also be the repairer.
  if v_order.user_id = auth.uid() then
    raise exception 'cannot_offer_on_own_order';
  end if;

  insert into public.order_offers (order_id, technician_id, amount, note)
  values (p_order_id, auth.uid(), round(p_amount, 2), nullif(trim(p_note), ''))
  on conflict (order_id, technician_id) where status = 'pending' do update
    set amount = excluded.amount,
        note = excluded.note,
        updated_at = now()
  returning * into v_offer;

  return v_offer;
end;
$$;

create or replace function public.accept_delivery_task(p_task_id uuid)
returns public.delivery_tasks
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_task public.delivery_tasks%rowtype;
  v_phone text;
begin
  if not exists (
    select 1 from public.couriers c
    where c.user_id = auth.uid()
      and c.verification_status in ('approved', 'verified')
      and c.courier_status = 'active'
  ) then
    raise exception 'not_eligible_courier';
  end if;

  if not exists (
    select 1 from public.couriers c
    where c.user_id = auth.uid() and c.available = true
  ) then
    raise exception 'courier_unavailable';
  end if;

  -- Multi-role guard: the courier cannot move a device on an order they are
  -- a party to (as customer or technician) — the handoff handshake would be
  -- them confirming to themselves.
  if exists (
    select 1
    from public.delivery_tasks dt
    join public.orders o on o.id = dt.order_id
    where dt.id = p_task_id
      and (o.user_id = auth.uid() or o.technician_id = auth.uid())
  ) then
    raise exception 'cannot_deliver_own_order';
  end if;

  select phone into v_phone from public.users where id = auth.uid();

  update public.delivery_tasks
    set status = 'accepted',
        courier_id = auth.uid(),
        courier_contact_phone = v_phone,
        accepted_at = now()
    where id = p_task_id and status = 'available' and courier_id is null
    returning * into v_task;
  if v_task.id is null then
    raise exception 'task_no_longer_available';
  end if;
  return v_task;
end;
$$;
