-- Delivery handoff handshake ------------------------------------------------
-- Every custody transfer now needs the counterparty's confirmation:
--   pickup leg:  courier "picked_up"  → CUSTOMER confirms they handed it over
--                courier "delivered"  → TECHNICIAN confirms receipt (closes task)
--   return leg:  courier "picked_up"  → TECHNICIAN confirms hand-over
--                courier "delivered"  → CUSTOMER confirms receipt (closes task
--                                       AND auto-completes the order)
-- The courier can no longer self-complete a task; completion always comes
-- from the receiver's confirmation.

alter table public.delivery_tasks
  add column if not exists pickup_confirmed_at timestamptz,
  add column if not exists delivery_confirmed_at timestamptz;

create or replace function public.confirm_delivery_handoff(p_task_id uuid, p_stage text)
returns public.delivery_tasks
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_task public.delivery_tasks%rowtype;
  v_order public.orders%rowtype;
  v_expected uuid;
  v_actor text;
begin
  select * into v_task from public.delivery_tasks where id = p_task_id;
  if not found then
    raise exception 'task_not_found';
  end if;
  select * into v_order from public.orders where id = v_task.order_id;
  if not found then
    raise exception 'order_not_found';
  end if;

  if p_stage = 'pickup' then
    -- The party who handed the device to the courier confirms the hand-over.
    v_expected := case v_task.task_type when 'pickup' then v_order.user_id else v_order.technician_id end;
    v_actor := case v_task.task_type when 'pickup' then 'customer' else 'technician' end;
    if auth.uid() is distinct from v_expected then
      raise exception 'not_handoff_party';
    end if;
    if v_task.status not in ('picked_up', 'delivered', 'completed') then
      raise exception 'invalid_task_state';
    end if;
    if v_task.pickup_confirmed_at is not null then
      return v_task; -- double-tap safe
    end if;
    update public.delivery_tasks
      set pickup_confirmed_at = now()
      where id = p_task_id
      returning * into v_task;

  elsif p_stage = 'delivery' then
    -- The receiving party confirms receipt — this closes the task.
    v_expected := case v_task.task_type when 'pickup' then v_order.technician_id else v_order.user_id end;
    v_actor := case v_task.task_type when 'pickup' then 'technician' else 'customer' end;
    if auth.uid() is distinct from v_expected then
      raise exception 'not_handoff_party';
    end if;
    if v_task.delivery_confirmed_at is not null then
      return v_task; -- double-tap safe
    end if;
    if v_task.status <> 'delivered' then
      raise exception 'invalid_task_state';
    end if;
    update public.delivery_tasks
      set delivery_confirmed_at = now(),
          status = 'completed',
          completed_at = now()
      where id = p_task_id
      returning * into v_task;

    -- Customer received the repaired device back ⇒ the order is done.
    if v_task.task_type = 'return' and v_order.status not in ('completed', 'cancelled') then
      update public.orders set status = 'completed' where id = v_order.id;
    end if;

  else
    raise exception 'invalid_stage';
  end if;

  insert into public.order_timeline (order_id, status, actor_type, actor_id)
  values (
    v_task.order_id,
    'handoff_' || v_task.task_type || '_' || p_stage || '_confirmed',
    v_actor,
    auth.uid()
  );

  return v_task;
end;
$$;

revoke all on function public.confirm_delivery_handoff(uuid, text) from public, anon;
grant execute on function public.confirm_delivery_handoff(uuid, text) to authenticated;

-- Couriers may only advance accepted→picked_up→delivered. 'completed' is no
-- longer a courier transition — the handshake cannot be bypassed.
create or replace function public.advance_delivery_task(p_task_id uuid, p_next_status text)
returns public.delivery_tasks
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_task public.delivery_tasks%rowtype;
  v_expected text;
begin
  v_expected := case p_next_status
    when 'picked_up' then 'accepted'
    when 'delivered' then 'picked_up'
    else null
  end;
  if v_expected is null then
    raise exception 'invalid_transition';
  end if;

  update public.delivery_tasks
    set status = p_next_status,
        picked_up_at = case when p_next_status = 'picked_up' then now() else picked_up_at end,
        delivered_at = case when p_next_status = 'delivered' then now() else delivered_at end
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
