-- ═══════════════════════════════════════════════════════════════════════════
-- Tighten courier → technician-location visibility window (2026-07-08)
--
-- Privacy pass on 20260708160000: the courier only ever needs the
-- technician's live position while the technician is their CURRENT target
-- stop, which is exactly:
--   • pickup leg  after collecting from the customer ('picked_up', and
--     'delivered' while confirming the hand-over on site)
--   • return leg  while heading to the technician to collect ('accepted')
-- The previous window also covered pickup/'accepted' (courier still at the
-- customer) and return/'picked_up'+'delivered' (courier heading back to the
-- customer) — states where the UI never shows the technician map. This
-- replaces the policy with the leg-aware minimum.
--
-- Note: technician_locations holds ONE row per technician (upsert on
-- technician_id) carrying the order_id they last broadcast for, so a courier
-- can never see positions broadcast for someone else's order.
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists "Courier reads tech location of assigned task" on public.technician_locations;
create policy "Courier reads tech location of assigned task"
  on public.technician_locations for select
  using (
    exists (
      select 1 from public.delivery_tasks dt
      where dt.order_id = technician_locations.order_id
        and dt.courier_id = auth.uid()
        and (
          (dt.task_type = 'pickup' and dt.status in ('picked_up', 'delivered'))
          or (dt.task_type = 'return' and dt.status = 'accepted')
        )
    )
  );
