-- ═══════════════════════════════════════════════════════════════════════════
-- Hotfix (2026-07-05): infinite recursion in RLS on public.orders.
--
-- Root cause: 20260705100000 added an orders SELECT policy whose USING
-- subquery reads delivery_tasks. delivery_tasks already has the policy
-- "Order parties read delivery tasks" whose USING subquery reads orders.
-- Policy subqueries run under the invoker's RLS, so evaluating orders RLS
-- re-entered delivery_tasks RLS which re-entered orders RLS →
--   ERROR 42P17: infinite recursion detected in policy for relation "orders"
-- on EVERY orders access. Because users has the policy
-- "users_select_technician_for_order" (subquery on orders) and
-- public_user_cards is security_invoker, the failure cascaded to all users /
-- user-card reads as well (profiles, technician names, admin lists).
--
-- Fix: move the courier→order membership check into a SECURITY DEFINER
-- helper. The helper reads delivery_tasks as the function owner (RLS
-- bypassed inside the function only), so the cycle is broken while access
-- semantics stay identical: a courier can read an order iff they are the
-- assigned courier on one of its delivery tasks. No policy is widened.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.courier_assigned_to_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.delivery_tasks dt
    where dt.order_id = p_order_id
      and dt.courier_id = auth.uid()
  );
$$;

comment on function public.courier_assigned_to_order(uuid) is
  'RLS helper: true iff the current user is the assigned courier on a delivery '
  'task of the given order. SECURITY DEFINER so orders policies can consult '
  'delivery_tasks without re-entering orders RLS (recursion guard).';

revoke execute on function public.courier_assigned_to_order(uuid) from public, anon;
grant execute on function public.courier_assigned_to_order(uuid) to authenticated;

drop policy if exists "Couriers read orders for their delivery tasks" on public.orders;
create policy "Couriers read orders for their delivery tasks"
  on public.orders for select
  using (public.courier_assigned_to_order(id));
