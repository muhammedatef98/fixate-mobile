-- §7 — stronger courier verification: store the uploaded document images and
-- the identity-challenge selfie alongside the existing license/registration
-- numbers. Images live in the shared private 'user-id-documents' bucket under
-- the courier's own user-id folder (same owner-upload / admin-read RLS as the
-- customer KYC flow).
alter table public.couriers
  add column if not exists license_image_url text,
  add column if not exists registration_image_url text,
  add column if not exists id_image_url text,
  add column if not exists selfie_url text,
  add column if not exists challenge_text text;
