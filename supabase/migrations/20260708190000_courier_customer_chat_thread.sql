-- ═══════════════════════════════════════════════════════════════════════════
-- Courier ↔ customer chat thread (2026-07-08)
--
-- Generalizes courier_chat_messages instead of adding a parallel system:
-- each message belongs to one of two threads on the same delivery task:
--   'technician' — courier ↔ order's assigned technician (existing behavior)
--   'customer'   — courier ↔ order's customer (new)
-- The two threads are fully partitioned by RLS: a technician can never read
-- the customer thread and vice-versa; the courier participates in both.
-- Auto-close semantics unchanged (inserts only while the task is live), and
-- access exists ONLY in the context of the delivery task / its order.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.courier_chat_messages
  add column if not exists thread text not null default 'technician'
    check (thread in ('technician', 'customer'));

create index if not exists idx_courier_chat_task_thread
  on public.courier_chat_messages(task_id, thread, created_at);

-- Policies depend on the participant helper — drop them before replacing it
-- with the thread-aware version.
drop policy if exists "Participants read courier chat" on public.courier_chat_messages;
drop policy if exists "Participants send courier chat" on public.courier_chat_messages;
drop policy if exists "Participants mark courier chat read" on public.courier_chat_messages;
drop function if exists public.is_courier_chat_participant(uuid, uuid);

-- Thread participants: the task's courier always; the other seat depends on
-- the thread ('technician' → orders.technician_id, 'customer' → orders.user_id).
create or replace function public.is_courier_chat_participant(
  p_task_id uuid,
  p_user uuid,
  p_thread text
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.delivery_tasks dt
    join public.orders o on o.id = dt.order_id
    where dt.id = p_task_id
      and (
        dt.courier_id = p_user
        or (p_thread = 'technician' and o.technician_id = p_user)
        or (p_thread = 'customer' and o.user_id = p_user)
      )
  );
$$;

revoke execute on function public.is_courier_chat_participant(uuid, uuid, text) from public, anon;
grant execute on function public.is_courier_chat_participant(uuid, uuid, text) to authenticated;

create policy "Participants read courier chat"
  on public.courier_chat_messages for select
  using (
    public.is_courier_chat_participant(task_id, auth.uid(), thread)
    or public.is_admin(auth.uid())
  );

create policy "Participants send courier chat"
  on public.courier_chat_messages for insert
  with check (
    sender_id = auth.uid()
    and public.is_courier_chat_participant(task_id, auth.uid(), thread)
    and exists (
      select 1 from public.delivery_tasks dt
      where dt.id = task_id
        and dt.status in ('accepted', 'picked_up', 'delivered')
    )
  );

create policy "Participants mark courier chat read"
  on public.courier_chat_messages for update
  using (public.is_courier_chat_participant(task_id, auth.uid(), thread))
  with check (public.is_courier_chat_participant(task_id, auth.uid(), thread));

comment on column public.courier_chat_messages.thread is
  'Which conversation on the task this message belongs to: courier↔technician or courier↔customer. RLS partitions the two threads.';
