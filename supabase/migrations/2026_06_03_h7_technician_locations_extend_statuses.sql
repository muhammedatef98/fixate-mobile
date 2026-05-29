-- H-7: the customer SELECT policy froze the live-tracking map whenever
-- the order transitioned to quoted / awaiting_payment / waiting_parts /
-- testing because those statuses were not in the allow-list. Customers
-- saw a stale pin. Tightening here ONLY extends the visible status set;
-- it does NOT broaden which technician locations are exposed (still
-- gated by EXISTS over the customer's own order).
--
-- Rollback:
--   ARRAY back to ['accepted','picking_up','diagnosing','repairing','delivering'].

DROP POLICY IF EXISTS "Customer reads tech location of own order" ON public.technician_locations;

CREATE POLICY "Customer reads tech location of own order"
ON public.technician_locations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
     WHERE o.id = technician_locations.order_id
       AND o.user_id = auth.uid()
       AND o.status = ANY (ARRAY[
         'accepted',
         'picking_up',
         'diagnosing',
         'quoted',
         'awaiting_payment',
         'waiting_parts',
         'repairing',
         'testing',
         'delivering'
       ])
  )
);
