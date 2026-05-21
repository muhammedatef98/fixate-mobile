-- Payment methods are now admin-managed (payment_methods table), so a
-- hardcoded CHECK on orders.payment_method no longer makes sense.
alter table public.orders drop constraint if exists orders_payment_method_check;
