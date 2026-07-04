-- Allow authors (and admins) to EDIT their own community posts and comments.
-- Prior to this the tables had SELECT/INSERT/DELETE policies but NO UPDATE
-- policy, so every UPDATE was silently filtered by RLS (0 rows changed, no
-- error) — the client `updatePost` optimistically showed an edit that never
-- persisted, and comment editing was impossible. is_admin() keeps moderator
-- edits working (RBAC super-admins + legacy admins).

drop policy if exists "Author or admin updates posts" on public.community_posts;
create policy "Author or admin updates posts" on public.community_posts
  for update to authenticated
  using (technician_id = auth.uid() or public.is_admin(auth.uid()))
  with check (technician_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "Author or admin updates comments" on public.community_comments;
create policy "Author or admin updates comments" on public.community_comments
  for update to authenticated
  using (technician_id = auth.uid() or public.is_admin(auth.uid()))
  with check (technician_id = auth.uid() or public.is_admin(auth.uid()));
