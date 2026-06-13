-- ============================================================================
-- Module 3B — Support chat lifecycle: waiting / assigned / closed states,
-- agent assignment, "who replied", and a professional auto-reply until a real
-- agent answers.
-- ----------------------------------------------------------------------------
-- Builds on the existing support_threads / support_messages tables and the
-- existing close RPCs. Nothing currently working is removed:
--   * Manual close (support_close_thread) and idle auto-close
--     (support_close_idle_threads) are preserved (close extended to support
--     staff, not just full admins).
--   * Re-open-on-new-message behaviour is preserved.
--
-- Additive + idempotent.
-- ============================================================================

-- ── 1. Richer thread state + assignment + auto-reply tracking ──────────────
alter table public.support_threads
  drop constraint if exists support_threads_status_check;
alter table public.support_threads
  add constraint support_threads_status_check
  check (status in ('open','waiting','assigned','closed'));

alter table public.support_threads
  add column if not exists assigned_admin_id uuid references auth.users(id) on delete set null,
  add column if not exists assigned_at       timestamptz,
  add column if not exists last_admin_id     uuid references auth.users(id) on delete set null,
  add column if not exists auto_reply_sent   boolean not null default false,
  add column if not exists internal_note     text;

create index if not exists idx_support_threads_assigned on public.support_threads(assigned_admin_id);

-- ── 2. System messages (auto-reply) need a nullable sender + flag ──────────
alter table public.support_messages
  add column if not exists is_system boolean not null default false;
alter table public.support_messages
  alter column sender_id drop not null;

-- ── 3. Auto-reply settings (admin-editable, bilingual) ─────────────────────
insert into public.platform_settings (key, value, description) values
  ('support_autoreply_enabled', 'true', 'Send an automatic acknowledgement to customers until a real agent replies.'),
  ('support_autoreply_ar',
    '"شكراً لتواصلك مع دعم فيكسات 👋\nتم استلام رسالتك وسيرد عليك أحد موظفي الدعم في أقرب وقت خلال ساعات العمل. نقدّر صبرك."',
    'Arabic support auto-reply message.'),
  ('support_autoreply_en',
    '"Thanks for contacting Fixate support 👋\nWe''ve received your message and a support agent will reply as soon as possible during working hours. We appreciate your patience."',
    'English support auto-reply message.')
on conflict (key) do nothing;

-- ── 4. Rewrite the AFTER INSERT trigger with full lifecycle logic ──────────
create or replace function public.support_message_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
  v_msg     text;
  v_ar      text;
  v_en      text;
  v_thread  public.support_threads%rowtype;
begin
  select * into v_thread from public.support_threads where id = new.thread_id;

  if new.is_system then
    -- Auto-reply / system message: notify the user, don't change assignment.
    update public.support_threads
       set last_message_at = new.created_at,
           unread_for_user = true,
           updated_at = new.created_at
     where id = new.thread_id;
    return new;
  end if;

  if new.is_admin then
    -- Real agent reply: claim the thread if unassigned, mark assigned.
    update public.support_threads
       set last_message_at = new.created_at,
           unread_for_user = true,
           status = 'assigned',
           assigned_admin_id = coalesce(assigned_admin_id, new.sender_id),
           assigned_at = coalesce(assigned_at, new.created_at),
           last_admin_id = new.sender_id,
           closed_at = null,
           closed_reason = null,
           updated_at = new.created_at
     where id = new.thread_id;
    return new;
  end if;

  -- Customer message: mark waiting (unless already assigned), reopen if closed.
  update public.support_threads
     set last_message_at = new.created_at,
         unread_for_admin = true,
         status = case when assigned_admin_id is not null then 'assigned' else 'waiting' end,
         closed_at = null,
         closed_reason = null,
         updated_at = new.created_at
   where id = new.thread_id;

  -- Auto-reply: only once per waiting episode, and only while no human agent
  -- has taken the conversation.
  select coalesce((value #>> '{}')::boolean, true) into v_enabled
    from public.platform_settings where key = 'support_autoreply_enabled';

  if coalesce(v_enabled, true)
     and coalesce(v_thread.auto_reply_sent, false) = false
     and v_thread.assigned_admin_id is null then
    -- Send a bilingual acknowledgement (no per-user language column exists,
    -- and a combined message is useful for both Arabic and English users).
    select (value #>> '{}') into v_ar from public.platform_settings where key = 'support_autoreply_ar';
    select (value #>> '{}') into v_en from public.platform_settings where key = 'support_autoreply_en';
    v_msg := concat_ws(E'\n\n———\n', nullif(trim(coalesce(v_ar, '')), ''), nullif(trim(coalesce(v_en, '')), ''));

    if v_msg is not null and length(trim(v_msg)) > 0 then
      insert into public.support_messages (thread_id, sender_id, is_admin, is_system, content)
      values (new.thread_id, null, true, true, v_msg);
      update public.support_threads set auto_reply_sent = true where id = new.thread_id;
    end if;
  end if;

  return new;
end $$;
revoke execute on function public.support_message_after_insert() from public, anon, authenticated;

-- Trigger already exists (trg_support_message_insert); the CREATE OR REPLACE
-- above swaps the function body in place.

-- ── 5. Assign / claim a thread ─────────────────────────────────────────────
create or replace function public.support_assign_thread(
  p_thread_id uuid,
  p_admin_id uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := coalesce(p_admin_id, auth.uid());
begin
  if not (public.is_admin(auth.uid()) or public.has_admin_permission(auth.uid(), 'support_management')) then
    raise exception 'Not allowed';
  end if;
  update public.support_threads
     set assigned_admin_id = v_admin,
         assigned_at = coalesce(assigned_at, now()),
         status = case when status = 'closed' then 'assigned' else 'assigned' end,
         updated_at = now()
   where id = p_thread_id;
end $$;
grant execute on function public.support_assign_thread(uuid, uuid) to authenticated;

-- ── 6. Extend close RPC to support staff (keep existing behaviour) ──────────
create or replace function public.support_close_thread(p_thread_id uuid, p_reason text default 'manual')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    public.is_admin(auth.uid())
    or public.has_admin_permission(auth.uid(), 'support_management')
    or exists (select 1 from public.support_threads t where t.id = p_thread_id and t.user_id = auth.uid())
  ) then
    raise exception 'Not allowed';
  end if;
  update public.support_threads
     set status = 'closed', closed_at = now(), closed_reason = coalesce(p_reason, 'manual'),
         -- Reset so a re-opened conversation gets a fresh acknowledgement.
         auto_reply_sent = false,
         updated_at = now()
   where id = p_thread_id and status <> 'closed';
end $$;
grant execute on function public.support_close_thread(uuid, text) to authenticated;

-- Idle auto-close: redefine to also reset the auto-reply flag on close so a
-- returning customer is acknowledged again. (Same close criteria as before:
-- last message from the customer, older than idle_minutes.)
create or replace function public.support_close_idle_threads(idle_minutes integer default 5)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  with last_msgs as (
    select distinct on (m.thread_id) m.thread_id, m.is_admin, m.is_system, m.created_at
      from public.support_messages m
      order by m.thread_id, m.created_at desc
  )
  update public.support_threads t
     set status = 'closed', closed_at = now(), closed_reason = 'auto_idle', auto_reply_sent = false
    from last_msgs lm
   where t.id = lm.thread_id
     and t.status <> 'closed'
     and lm.is_admin = false
     and lm.created_at < now() - (idle_minutes || ' minutes')::interval;
  get diagnostics affected = row_count;
  return affected;
end $$;
grant execute on function public.support_close_idle_threads(integer) to authenticated;

-- ── 7. RLS: give support staff (not just full admins) access ───────────────
-- These are ADDITIVE policies (RLS policies OR together), so existing
-- owner/admin access is untouched.
drop policy if exists "Support staff read threads" on public.support_threads;
create policy "Support staff read threads" on public.support_threads
  for select using (public.has_admin_permission(auth.uid(), 'support_management'));

drop policy if exists "Support staff update threads" on public.support_threads;
create policy "Support staff update threads" on public.support_threads
  for update using (public.has_admin_permission(auth.uid(), 'support_management'))
  with check (public.has_admin_permission(auth.uid(), 'support_management'));

drop policy if exists "Support staff read messages" on public.support_messages;
create policy "Support staff read messages" on public.support_messages
  for select using (public.has_admin_permission(auth.uid(), 'support_management'));

drop policy if exists "Support staff insert messages" on public.support_messages;
create policy "Support staff insert messages" on public.support_messages
  for insert with check (
    sender_id = auth.uid()
    and public.has_admin_permission(auth.uid(), 'support_management')
  );

-- ── 8. Backfill state for existing threads ─────────────────────────────────
-- Legacy 'open'/NULL threads become 'waiting' (waiting on an agent) unless a
-- previous admin message exists, in which case mark them 'assigned'.
update public.support_threads t
   set assigned_admin_id = sub.last_admin,
       last_admin_id = sub.last_admin,
       assigned_at = coalesce(t.assigned_at, now()),
       status = 'assigned'
  from (
    select distinct on (m.thread_id) m.thread_id, m.sender_id as last_admin
      from public.support_messages m
     where m.is_admin = true and m.is_system = false and m.sender_id is not null
     order by m.thread_id, m.created_at desc
  ) sub
 where t.id = sub.thread_id
   and t.status in ('open')
   and t.assigned_admin_id is null;

update public.support_threads
   set status = 'waiting'
 where status = 'open' or status is null;
