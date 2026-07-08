-- ═══════════════════════════════════════════════════════════════════════════
-- Offer resubmission after customer rejection (2026-07-08)
--
-- Previously order_offers had a hard UNIQUE (order_id, technician_id) and
-- submit_order_offer refused to touch decided rows ('offer_already_decided'),
-- so a customer rejection permanently locked the technician out of the
-- request. Product behavior wanted: rejection is feedback, not a ban — the
-- technician may submit a NEW offer while the order is still open.
--
-- Design (history-preserving):
--   • The hard unique pair becomes a PARTIAL unique index on
--     (order_id, technician_id) WHERE status = 'pending' — at most one LIVE
--     offer per technician per order, while rejected / withdrawn / expired /
--     accepted rows remain immutable audit history.
--   • submit_order_offer revises a live pending offer in place (unchanged
--     behavior) or inserts a fresh row otherwise. Race safety comes from the
--     order row lock + the partial unique index; concurrent double-submits
--     collapse into the ON CONFLICT update.
--   • Acceptance guarantees unchanged: accept_order_offer still locks the
--     order, expires all other *pending* offers, and no offer can be created
--     once orders.status leaves 'pending' (the RPC's order-open check).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. one-live-offer partial index replaces the hard unique pair ──────────
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.order_offers'::regclass
    and contype = 'u';
  if cname is not null then
    execute format('alter table public.order_offers drop constraint %I', cname);
  end if;
end $$;

create unique index if not exists uq_order_offers_one_pending
  on public.order_offers (order_id, technician_id)
  where status = 'pending';

-- ── 2. submit_order_offer v2 ────────────────────────────────────────────────
create or replace function public.submit_order_offer(
  p_order_id uuid,
  p_amount numeric,
  p_note text default null
) returns public.order_offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_offer public.order_offers%rowtype;
begin
  if p_amount is null or p_amount <= 0 or p_amount > 100000 then
    raise exception 'invalid_amount';
  end if;

  -- Caller must be an approved, active technician.
  if not exists (
    select 1 from public.technicians t
    where t.user_id = auth.uid()
      and t.verification_status in ('approved', 'verified')
      and coalesce(t.technician_status, 'active') not in ('suspended', 'excluded')
  ) then
    raise exception 'not_eligible_technician';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.status <> 'pending' or v_order.technician_id is not null then
    raise exception 'order_not_open';
  end if;

  -- Revise the live pending offer in place, or open a fresh one. Decided
  -- rows (rejected / withdrawn / expired / accepted) are never mutated —
  -- they stay as audit history; a rejection simply means the next submit
  -- creates a new row.
  insert into public.order_offers (order_id, technician_id, amount, note)
  values (p_order_id, auth.uid(), round(p_amount, 2), nullif(trim(p_note), ''))
  on conflict (order_id, technician_id) where status = 'pending' do update
    set amount = excluded.amount,
        note = excluded.note,
        updated_at = now()
  returning * into v_offer;

  return v_offer;
end;
$$;
