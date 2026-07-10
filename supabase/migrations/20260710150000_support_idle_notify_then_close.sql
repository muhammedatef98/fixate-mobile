-- §9 — notify-then-close for idle support chats (customer/technician/courier;
-- support_threads is per-user regardless of role). At warn_minutes of
-- inactivity (last real message from the user) we post a system warning the
-- user sees, then close grace_minutes later if they still haven't replied. Any
-- new user message clears the warning and (via the v2 insert trigger) reopens
-- the thread cleanly.

alter table public.support_threads
  add column if not exists warned_at timestamptz;

create or replace function public.support_reset_warned_on_user_msg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin = false and coalesce(new.is_system, false) = false then
    update public.support_threads
       set warned_at = null
     where id = new.thread_id and warned_at is not null;
  end if;
  return new;
end $$;
revoke execute on function public.support_reset_warned_on_user_msg() from public, anon, authenticated;

drop trigger if exists trg_support_reset_warned on public.support_messages;
create trigger trg_support_reset_warned
  after insert on public.support_messages
  for each row execute function public.support_reset_warned_on_user_msg();

create or replace function public.support_idle_sweep(
  warn_minutes integer default 5,
  grace_minutes integer default 1
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closed integer;
begin
  with last_real as (
    select distinct on (m.thread_id) m.thread_id, m.is_admin, m.created_at
      from public.support_messages m
      where coalesce(m.is_system, false) = false
      order by m.thread_id, m.created_at desc
  ),
  to_warn as (
    select t.id
      from public.support_threads t
      join last_real lr on lr.thread_id = t.id
      where t.status <> 'closed'
        and t.warned_at is null
        and lr.is_admin = false
        and lr.created_at < now() - make_interval(mins => warn_minutes)
  ),
  warned as (
    insert into public.support_messages (thread_id, sender_id, is_admin, is_system, content)
    select id, null, true, true,
      E'⏳ سيتم إغلاق هذه المحادثة تلقائياً بسبب عدم النشاط. أرسل رسالة للمتابعة.\n\n———\n\nThis chat will close automatically due to inactivity. Send a message to keep it open.'
    from to_warn
    returning thread_id
  )
  update public.support_threads t
     set warned_at = now()
    from to_warn w
   where t.id = w.id;

  update public.support_threads t
     set status = 'closed', closed_at = now(), closed_reason = 'auto_idle',
         auto_reply_sent = false
   where t.status <> 'closed'
     and t.warned_at is not null
     and t.warned_at < now() - make_interval(mins => grace_minutes);
  get diagnostics v_closed = row_count;
  return v_closed;
end $$;

revoke execute on function public.support_idle_sweep(integer, integer) from public, anon;
grant execute on function public.support_idle_sweep(integer, integer) to authenticated;

select cron.unschedule('support-idle-sweep')
where exists (select 1 from cron.job where jobname = 'support-idle-sweep');

select cron.schedule(
  'support-idle-sweep',
  '* * * * *',
  $$ select public.support_idle_sweep(5, 1); $$
);
