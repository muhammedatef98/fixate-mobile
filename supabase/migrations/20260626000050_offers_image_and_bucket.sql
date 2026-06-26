-- ============================================================================
-- Offers upgrade (§2): image_url column + a public "offers" storage bucket.
-- ============================================================================
alter table public.offers
  add column if not exists image_url text;

-- Public bucket so offer banners resolve via getPublicUrl().
insert into storage.buckets (id, name, public)
values ('offers', 'offers', true)
on conflict (id) do nothing;

-- Anyone can read offer images (public banners).
drop policy if exists "offers_bucket_public_read" on storage.objects;
create policy "offers_bucket_public_read" on storage.objects
  for select using (bucket_id = 'offers');

-- Only admins can upload / change / remove offer images.
drop policy if exists "offers_bucket_admin_insert" on storage.objects;
create policy "offers_bucket_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'offers' and public.is_admin(auth.uid()));

drop policy if exists "offers_bucket_admin_update" on storage.objects;
create policy "offers_bucket_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'offers' and public.is_admin(auth.uid()))
  with check (bucket_id = 'offers' and public.is_admin(auth.uid()));

drop policy if exists "offers_bucket_admin_delete" on storage.objects;
create policy "offers_bucket_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'offers' and public.is_admin(auth.uid()));
