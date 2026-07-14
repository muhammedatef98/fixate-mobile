-- Courier moderation parity with technicians.
--
-- 1. moderation_logs already records user/technician actions; couriers had no
--    place to land, so admin suspend/exclude decisions on a courier were
--    untraceable. Widen the target_type check.
-- 2. couriers.admin_notes + status_updated_at mirror the technician columns the
--    admin screen reads and writes.

alter table public.moderation_logs
  drop constraint if exists moderation_logs_target_type_check;

alter table public.moderation_logs
  add constraint moderation_logs_target_type_check
  check (target_type in ('user', 'technician', 'courier'));

alter table public.couriers
  add column if not exists admin_notes text,
  add column if not exists status_updated_at timestamptz;

comment on column public.couriers.admin_notes is
  'Internal admin-only notes; never shown to the courier.';

-- 3. admin_notes is a privileged column: the owner UPDATE policy would happily
--    let a courier write their own file. Pin it in the existing guard trigger
--    alongside the other privileged columns.
create or replace function public.guard_courier_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or public.is_admin(v_uid) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.verification_status := 'submitted';
    new.courier_status := 'active';
    new.total_deliveries := 0;
    new.verified_at := null;
    new.admin_notes := null;
    return new;
  end if;

  if new.verification_status is distinct from old.verification_status
     and new.verification_status <> 'submitted' then
    raise exception 'not_allowed_verification_change';
  end if;
  new.courier_status := old.courier_status;
  new.total_deliveries := old.total_deliveries;
  new.verified_at := old.verified_at;
  new.admin_notes := old.admin_notes;
  return new;
end;
$$;

revoke execute on function public.guard_courier_privileged_columns() from public, anon, authenticated;

comment on column public.couriers.courier_status is
  'Lifecycle: active | suspended | excluded. Only active couriers are offered '
  'delivery tasks (see the claim RPCs).';
