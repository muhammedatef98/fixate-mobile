-- §8 — a pending marketplace request stays "online" for an admin-configurable
-- window (platform_settings.request_lifetime_minutes, default 30). Past that,
-- if the customer accepted no offer, the request auto-expires and its pending
-- offers close. Accepting an offer moves the order off 'pending', so an
-- in-flight order is never affected.

-- 'expired' is a new terminal order status.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status = any (array[
    'pending','confirmed','accepted','picking_up','diagnosing','quoted',
    'awaiting_payment','waiting_parts','repairing','testing','delivering',
    'completed','cancelled','rejected','expired'
  ]));

create or replace function public.expire_stale_requests()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_minutes integer;
  v_count integer;
begin
  select coalesce((value #>> '{}')::int, 30)
    into v_minutes
    from public.platform_settings
    where key = 'request_lifetime_minutes';
  if v_minutes is null then v_minutes := 30; end if;

  with expired as (
    update public.orders
      set status = 'expired', updated_at = now()
      where status = 'pending'
        and technician_id is null
        and created_at < now() - make_interval(mins => v_minutes)
      returning id
  ),
  closed as (
    update public.order_offers o
      set status = 'expired', updated_at = now()
      from expired e
      where o.order_id = e.id and o.status = 'pending'
      returning o.id
  )
  select count(*)::int into v_count from expired;

  return coalesce(v_count, 0);
end;
$$;

revoke execute on function public.expire_stale_requests() from public, anon, authenticated;

select cron.unschedule('expire-stale-requests')
where exists (select 1 from cron.job where jobname = 'expire-stale-requests');

select cron.schedule(
  'expire-stale-requests',
  '* * * * *',
  $$ select public.expire_stale_requests(); $$
);
