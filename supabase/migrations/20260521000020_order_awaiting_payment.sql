-- Add the payment-ready state to the order lifecycle. After a customer
-- accepts the technician's quote the order sits in 'awaiting_payment'
-- until payment (or cash-on-delivery) is confirmed.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status = any (array[
    'pending','confirmed','accepted','picking_up','diagnosing','quoted',
    'awaiting_payment','waiting_parts','repairing','testing','delivering',
    'completed','cancelled'
  ]));
