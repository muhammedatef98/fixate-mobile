-- B-4 PayPal: register PayPal as a usable payment method. The row may
-- already exist (placeholder is_coming_soon=true). Re-enable it.
--
-- Rollback:
--   UPDATE public.payment_methods SET is_coming_soon = true WHERE code = 'paypal';

INSERT INTO public.payment_methods
  (code, name_ar, name_en, icon, enabled, is_coming_soon,
   show_in_request_step, show_in_payment_page, sort_order)
VALUES
  ('paypal', 'PayPal', 'PayPal', 'shield-check',
   true,        -- enabled
   false,       -- is_coming_soon: real settlement now wired
   false,       -- request-step preview: keep COD-only there for now
   true,        -- shown on the real payment page
   5)
ON CONFLICT (code) DO UPDATE
   SET enabled              = true,
       is_coming_soon       = false,
       show_in_payment_page = true,
       name_en              = EXCLUDED.name_en,
       name_ar              = EXCLUDED.name_ar,
       icon                 = EXCLUDED.icon;
