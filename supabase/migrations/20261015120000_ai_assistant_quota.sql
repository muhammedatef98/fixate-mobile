-- AI repair assistant: per-user daily message quota.
--
-- Every AI reply costs real quota on the model provider, so the
-- `ai-assistant` Edge Function charges one unit per request against this
-- table before calling the model, and refunds it if the model call fails.
--
-- Only the Edge Function (service role) reads or writes this table: RLS is
-- on with no policies, and the two functions below are not executable by
-- anon/authenticated, so a client can't reset or inflate its own counter.

create table if not exists public.ai_assistant_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Quota day in Saudi time, so the limit resets at local midnight.
  day date not null default ((now() at time zone 'Asia/Riyadh')::date),
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);

alter table public.ai_assistant_usage enable row level security;
revoke all on table public.ai_assistant_usage from anon, authenticated;

-- Atomically takes one unit of today's quota. Returns the new count, or NULL
-- when the user has already reached p_daily_limit (nothing is changed then).
create or replace function public.consume_ai_assistant_quota(
  p_user_id uuid,
  p_daily_limit integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.ai_assistant_usage as u (user_id, day, count)
  values (p_user_id, (now() at time zone 'Asia/Riyadh')::date, 1)
  on conflict (user_id, day) do update
    set count = u.count + 1
    where u.count < p_daily_limit
  returning u.count into v_count;
  return v_count;
end;
$$;

-- Gives back one unit when the model call failed, so errors don't eat quota.
create or replace function public.refund_ai_assistant_quota(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ai_assistant_usage
     set count = greatest(count - 1, 0)
   where user_id = p_user_id
     and day = (now() at time zone 'Asia/Riyadh')::date;
$$;

revoke execute on function public.consume_ai_assistant_quota(uuid, integer) from public, anon, authenticated;
revoke execute on function public.refund_ai_assistant_quota(uuid) from public, anon, authenticated;
grant execute on function public.consume_ai_assistant_quota(uuid, integer) to service_role;
grant execute on function public.refund_ai_assistant_quota(uuid) to service_role;
