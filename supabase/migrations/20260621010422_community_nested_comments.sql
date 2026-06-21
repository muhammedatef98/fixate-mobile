-- ============================================================================
-- Community: Reddit-style threaded comments + comment likes
-- Recovered verbatim from the remote migration history
-- (supabase_migrations.schema_migrations.statements) after the local file
-- was lost in a rebase. Already applied on remote; idempotent.
-- ============================================================================
alter table public.community_comments
  add column if not exists parent_id uuid references public.community_comments(id) on delete cascade;

create index if not exists idx_community_comments_parent_id
  on public.community_comments(parent_id);

alter table public.community_comments
  add column if not exists likes_count int not null default 0;

create table if not exists public.community_comment_likes (
  id             uuid primary key default gen_random_uuid(),
  comment_id     uuid not null references public.community_comments(id) on delete cascade,
  technician_id  uuid not null references auth.users(id) on delete cascade,
  created_at     timestamptz not null default now(),
  unique (comment_id, technician_id)
);

create index if not exists community_comment_likes_comment_idx
  on public.community_comment_likes(comment_id);

create or replace function public.community_bump_comment_likes()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.community_comments set likes_count = likes_count + 1 where id = new.comment_id;
  elsif tg_op = 'DELETE' then
    update public.community_comments set likes_count = greatest(0, likes_count - 1) where id = old.comment_id;
  end if;
  return null;
end; $$;

drop trigger if exists trg_community_comment_likes on public.community_comment_likes;
create trigger trg_community_comment_likes
after insert or delete on public.community_comment_likes
for each row execute function public.community_bump_comment_likes();

alter table public.community_comment_likes enable row level security;

drop policy if exists "Technicians read comment likes" on public.community_comment_likes;
create policy "Technicians read comment likes" on public.community_comment_likes
  for select to authenticated
  using (public.is_technician(auth.uid()) or public.is_admin(auth.uid()));

drop policy if exists "Technicians like comments" on public.community_comment_likes;
create policy "Technicians like comments" on public.community_comment_likes
  for insert to authenticated
  with check (technician_id = auth.uid() and public.is_technician(auth.uid()));

drop policy if exists "Technicians unlike own comments" on public.community_comment_likes;
create policy "Technicians unlike own comments" on public.community_comment_likes
  for delete to authenticated
  using (technician_id = auth.uid());
