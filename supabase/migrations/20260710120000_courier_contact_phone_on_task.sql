-- Give the customer/technician a way to call the assigned courier from the
-- courier chat. users RLS blocks reading another user's row, so we stamp the
-- courier's phone onto the task inside the SECURITY DEFINER accept RPC (both
-- parties already have RLS read access to the task).
alter table public.delivery_tasks
  add column if not exists courier_contact_phone text;

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

-- Backfill phone for tasks already accepted before this change.
update public.delivery_tasks t
  set courier_contact_phone = u.phone
  from public.users u
  where t.courier_id = u.id
    and t.courier_contact_phone is null;
