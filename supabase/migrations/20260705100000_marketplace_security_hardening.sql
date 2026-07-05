-- ═══════════════════════════════════════════════════════════════════════════
-- Marketplace security hardening (2026-07-05) — applied to remote.
--
-- 1. Close the direct-claim bypass on orders. Two legacy policies let ANY
--    authenticated user update an open order (status='pending' AND
--    technician_id IS NULL):
--      - "Technicians can accept available orders" had NO WITH CHECK at all,
--        so any signed-in user could arbitrarily rewrite any open request
--        (claim it, change the price, cancel it).
--      - "Technicians update only assigned orders" allowed self-assignment
--        of open orders, bypassing the customer's offer choice.
--    In the marketplace model assignment happens ONLY via the
--    accept_order_offer SECURITY DEFINER RPC (runs as owner, bypasses RLS),
--    so the open-order UPDATE branch is dropped everywhere.
--
-- 2. Guard privileged courier columns. The owner-update RLS policy alone let
--    a malicious courier client set verification_status='approved',
--    courier_status, total_deliveries or verified_at directly. A trigger now
--    pins those columns for non-admin sessions (owners may only move
--    verification_status back to 'submitted' when resubmitting).
--
-- 3. Let the assigned courier read the orders behind their tasks — needed
--    for delivery notifications (resolving the order parties) and future
--    order context on the task screen. Available (unclaimed) tasks expose
--    only the task row itself, never the order.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Orders: remove the open-order direct-claim branches ────────────────
drop policy if exists "Technicians can accept available orders" on public.orders;

drop policy if exists "Technicians update only assigned orders" on public.orders;
create policy "Technicians update only assigned orders"
  on public.orders for update
  using (auth.uid() = user_id or auth.uid() = technician_id)
  with check (auth.uid() = user_id or auth.uid() = technician_id);

-- ── 2. Couriers: pin privileged columns for non-admin sessions ────────────
create or replace function public.guard_courier_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- Service-role / owner contexts (no JWT) and admins are unrestricted.
  if v_uid is null or public.is_admin(v_uid) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A fresh application always starts unreviewed regardless of what the
    -- client sent.
    new.verification_status := 'submitted';
    new.courier_status := 'active';
    new.total_deliveries := 0;
    new.verified_at := null;
    return new;
  end if;

  -- Owner UPDATE: the only permitted verification transition is back to
  -- 'submitted' (resubmission after changes_requested/rejected).
  if new.verification_status is distinct from old.verification_status
     and new.verification_status <> 'submitted' then
    raise exception 'not_allowed_verification_change';
  end if;
  new.courier_status := old.courier_status;
  new.total_deliveries := old.total_deliveries;
  new.verified_at := old.verified_at;
  return new;
end;
$$;

drop trigger if exists trg_guard_courier_privileged on public.couriers;
create trigger trg_guard_courier_privileged
before insert or update on public.couriers
for each row
execute function public.guard_courier_privileged_columns();

comment on function public.guard_courier_privileged_columns() is
  'Prevents courier accounts from self-approving or editing privileged columns '
  '(verification_status/courier_status/total_deliveries/verified_at); admins and '
  'service-role contexts are unrestricted.';

-- ── 3. Orders: assigned couriers can read their tasks'' orders ─────────────
drop policy if exists "Couriers read orders for their delivery tasks" on public.orders;
create policy "Couriers read orders for their delivery tasks"
  on public.orders for select
  using (
    exists (
      select 1 from public.delivery_tasks dt
      where dt.order_id = orders.id
        and dt.courier_id = auth.uid()
    )
  );

-- Trigger functions never need direct EXECUTE by clients; keep the surface
-- minimal (also silences the Supabase security advisor).
revoke execute on function public.guard_courier_privileged_columns() from public, anon, authenticated;
