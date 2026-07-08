-- ═══════════════════════════════════════════════════════════════════════════
-- Courier reads technician live location (2026-07-08)
--
-- The courier task detail now shows the technician's live position (same
-- LiveTrackingMap pattern the customer already gets) when heading to /
-- from the technician. technician_locations was previously readable only by
-- the order's customer; this adds a read path for the courier assigned to a
-- LIVE delivery task on that order. One-directional cross-table reference
-- (technician_locations → delivery_tasks) — no policy cycle (see the
-- 2026-07-05 orders↔delivery_tasks recursion incident).
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists "Courier reads tech location of assigned task" on public.technician_locations;
create policy "Courier reads tech location of assigned task"
  on public.technician_locations for select
  using (
    exists (
      select 1 from public.delivery_tasks dt
      where dt.order_id = technician_locations.order_id
        and dt.courier_id = auth.uid()
        and dt.status in ('accepted', 'picked_up', 'delivered')
    )
  );
