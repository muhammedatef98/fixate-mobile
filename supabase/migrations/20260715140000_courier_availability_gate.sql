-- Make the courier's own availability toggle real: an offline courier
-- (couriers.available = false) can no longer claim delivery tasks. Until now
-- `available` was a dead column nothing read; the accept RPC only checked
-- approval + active status. This mirrors the technician availability model.
--
-- The privileged-column guard trigger intentionally does NOT pin `available`,
-- so the courier can still flip it via the normal owner UPDATE policy.

create or replace function public.accept_delivery_task(p_task_id uuid)
returns public.delivery_tasks
language plpgsql
security definer
set search_path = ''
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

  -- An offline courier must go online before taking work.
  if not exists (
    select 1 from public.couriers c
    where c.user_id = auth.uid() and c.available = true
  ) then
    raise exception 'courier_unavailable';
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

revoke execute on function public.accept_delivery_task(uuid) from public, anon;
grant execute on function public.accept_delivery_task(uuid) to authenticated;
