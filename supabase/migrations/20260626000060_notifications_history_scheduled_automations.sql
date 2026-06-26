-- ============================================================================
-- §1 Notifications: history clear, scheduled (pg_cron), automations.
-- ============================================================================

-- ── §1A: allow admins to clear broadcast history ────────────────────────────
drop policy if exists "admins_delete_broadcasts" on public.broadcasts;
create policy "admins_delete_broadcasts" on public.broadcasts
  for delete to authenticated using (public.is_admin(auth.uid()));

-- ── §1B: scheduled notifications ────────────────────────────────────────────
create table if not exists public.scheduled_notifications (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  body         text not null,
  audience     text not null default 'all' check (audience in ('all','customers','technicians')),
  category     text not null default 'announcement',
  data         jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz not null,
  recurrence   text not null default 'none' check (recurrence in ('none','daily','weekly')),
  is_sent      boolean not null default false,
  sent_at      timestamptz,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists scheduled_notifications_due_idx
  on public.scheduled_notifications (is_sent, scheduled_at);

alter table public.scheduled_notifications enable row level security;

drop policy if exists "admins_all_scheduled" on public.scheduled_notifications;
create policy "admins_all_scheduled" on public.scheduled_notifications
  for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ── §1C: automation rules ───────────────────────────────────────────────────
create table if not exists public.notification_automations (
  id            uuid primary key default gen_random_uuid(),
  trigger_event text not null unique,
  title         text not null,
  body          text not null,
  data          jsonb not null default '{}'::jsonb,
  is_active     boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.notification_automations enable row level security;

drop policy if exists "admins_all_automations" on public.notification_automations;
create policy "admins_all_automations" on public.notification_automations
  for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Seed the welcome-discount rule (inactive until an admin turns it on).
insert into public.notification_automations (trigger_event, title, body, is_active)
select 'welcome_discount',
       'مرحباً بك في Fixate! 🎉',
       'خصم ترحيبي بانتظارك على أول طلب صيانة. Welcome! A first-repair discount is waiting for you.',
       false
where not exists (
  select 1 from public.notification_automations where trigger_event = 'welcome_discount'
);

-- Trigger: when a new customer is created, send the welcome notification if the
-- automation is active (in-app; new users have no push token yet).
create or replace function public.on_new_user_automation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
begin
  if (new.role = 'customer' or new.role is null) then
    select * into a from public.notification_automations
      where trigger_event = 'welcome_discount' and is_active = true;
    if found then
      insert into public.notifications (user_id, title_ar, title_en, body_ar, body_en, type)
      values (new.id, a.title, a.title, a.body, a.body, 'promo');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_on_new_user_automation on public.users;
create trigger trg_on_new_user_automation
after insert on public.users
for each row execute function public.on_new_user_automation();

-- ── §1B processor: pg_net + pg_cron ─────────────────────────────────────────
create extension if not exists pg_net;

-- Resolve due rows, insert in-app notifications for the opted-in audience, fire
-- a best-effort push via push-dispatch (tokens path, anon-key auth), then mark
-- sent or advance the recurrence.
create or replace function public.process_due_scheduled_notifications()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r record;
  v_pref_col text;
  v_tokens text[];
  -- Public anon key (safe to embed) — only used to satisfy the gateway JWT
  -- check; push-dispatch's tokens path performs no admin gating.
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwdWNpc2p4ZWN1cGN5b3N1bWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NjY1NTEsImV4cCI6MjA4MTE0MjU1MX0.dPN6rdv6R5DF_8GdeP5DmNvoj0tecFAcfqVFgN68QkE';
  v_url text := 'https://gpucisjxecupcyosumgy.supabase.co/functions/v1/push-dispatch';
begin
  for r in
    select * from public.scheduled_notifications
    where is_sent = false and scheduled_at <= now()
    order by scheduled_at asc
    limit 50
  loop
    v_pref_col := case r.category
      when 'promo' then 'promotions'
      when 'announcement' then 'system_announcements'
      when 'order' then 'order_updates'
      when 'arrival' then 'technician_arrival'
      else null end;

    -- In-app notifications for the opted-in audience.
    insert into public.notifications (user_id, title_ar, title_en, body_ar, body_en, type, related_id)
    select u.id, r.title, r.title, r.body, r.body,
           case when r.category = 'promo' then 'promo' else 'general' end, null
    from public.users u
    left join public.notification_preferences np on np.user_id = u.id
    where (
      r.audience = 'all'
      or (r.audience = 'customers' and (u.role = 'customer' or u.role is null))
      or (r.audience = 'technicians' and u.role = 'technician')
    )
    and (
      v_pref_col is null
      or coalesce(
           case v_pref_col
             when 'promotions' then np.promotions
             when 'system_announcements' then np.system_announcements
             when 'order_updates' then np.order_updates
             when 'technician_arrival' then np.technician_arrival
           end, true)
    );

    -- Tokens for the same audience that still have push enabled.
    select array_agg(u.push_token) into v_tokens
    from public.users u
    left join public.notification_preferences np on np.user_id = u.id
    where u.push_token is not null
      and (
        r.audience = 'all'
        or (r.audience = 'customers' and (u.role = 'customer' or u.role is null))
        or (r.audience = 'technicians' and u.role = 'technician')
      )
      and coalesce(np.push_enabled, true)
      and (
        v_pref_col is null
        or coalesce(
             case v_pref_col
               when 'promotions' then np.promotions
               when 'system_announcements' then np.system_announcements
               when 'order_updates' then np.order_updates
               when 'technician_arrival' then np.technician_arrival
             end, true)
      );

    if v_tokens is not null and array_length(v_tokens, 1) > 0 then
      perform net.http_post(
        url := v_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_anon,
          'apikey', v_anon
        ),
        body := jsonb_build_object(
          'tokens', to_jsonb(v_tokens),
          'title', r.title,
          'body', r.body,
          'data', coalesce(r.data, '{}'::jsonb)
        )
      );
    end if;

    if r.recurrence = 'daily' then
      update public.scheduled_notifications set scheduled_at = scheduled_at + interval '1 day' where id = r.id;
    elsif r.recurrence = 'weekly' then
      update public.scheduled_notifications set scheduled_at = scheduled_at + interval '7 days' where id = r.id;
    else
      update public.scheduled_notifications set is_sent = true, sent_at = now() where id = r.id;
    end if;
  end loop;
end;
$$;

-- Run every minute. unschedule first so re-running this migration is safe.
select cron.unschedule('process-scheduled-notifications')
where exists (select 1 from cron.job where jobname = 'process-scheduled-notifications');

select cron.schedule(
  'process-scheduled-notifications',
  '* * * * *',
  $$ select public.process_due_scheduled_notifications(); $$
);
