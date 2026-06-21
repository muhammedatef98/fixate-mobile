-- Technician Community — forum-style space for technicians only.
-- Recovered verbatim from the remote migration history
-- (supabase_migrations.schema_migrations.statements) after the local file
-- was lost in a rebase. Already applied on remote; idempotent.

-- Helper: is the current user a registered technician?
create or replace function public.is_technician(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.technicians t where t.user_id = uid);
$$;
grant execute on function public.is_technician(uuid) to authenticated, anon, service_role;

-- ── Tables ────────────────────────────────────────────────────────────────
create table if not exists public.community_posts (
  id             uuid primary key default gen_random_uuid(),
  technician_id  uuid not null references auth.users(id) on delete cascade,
  content        text not null check (length(btrim(content)) > 0),
  image_url      text,
  likes_count    int not null default 0,
  comments_count int not null default 0,
  report_count   int not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists community_posts_created_idx on public.community_posts (created_at desc);

create table if not exists public.community_comments (
  id             uuid primary key default gen_random_uuid(),
  post_id        uuid not null references public.community_posts(id) on delete cascade,
  technician_id  uuid not null references auth.users(id) on delete cascade,
  content        text not null check (length(btrim(content)) > 0),
  created_at     timestamptz not null default now()
);
create index if not exists community_comments_post_idx on public.community_comments (post_id, created_at);

create table if not exists public.community_likes (
  id             uuid primary key default gen_random_uuid(),
  post_id        uuid not null references public.community_posts(id) on delete cascade,
  technician_id  uuid not null references auth.users(id) on delete cascade,
  created_at     timestamptz not null default now(),
  unique (post_id, technician_id)
);

create table if not exists public.community_reports (
  id             uuid primary key default gen_random_uuid(),
  post_id        uuid not null references public.community_posts(id) on delete cascade,
  technician_id  uuid not null references auth.users(id) on delete cascade,
  reason         text,
  created_at     timestamptz not null default now(),
  unique (post_id, technician_id)
);
create index if not exists community_reports_post_idx on public.community_reports (post_id);

-- ── Count-maintenance triggers ───────────────────────────────────────────
create or replace function public.community_bump_likes()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.community_posts set likes_count = likes_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.community_posts set likes_count = greatest(0, likes_count - 1) where id = old.post_id;
  end if;
  return null;
end; $$;

drop trigger if exists trg_community_likes on public.community_likes;
create trigger trg_community_likes
after insert or delete on public.community_likes
for each row execute function public.community_bump_likes();

create or replace function public.community_bump_comments()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.community_posts set comments_count = comments_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.community_posts set comments_count = greatest(0, comments_count - 1) where id = old.post_id;
  end if;
  return null;
end; $$;

drop trigger if exists trg_community_comments on public.community_comments;
create trigger trg_community_comments
after insert or delete on public.community_comments
for each row execute function public.community_bump_comments();

create or replace function public.community_bump_reports()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.community_posts set report_count = report_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.community_posts set report_count = greatest(0, report_count - 1) where id = old.post_id;
  end if;
  return null;
end; $$;

drop trigger if exists trg_community_reports on public.community_reports;
create trigger trg_community_reports
after insert or delete on public.community_reports
for each row execute function public.community_bump_reports();

-- ── RLS ─────────────────────────────────────────────────────────────────
alter table public.community_posts    enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_likes    enable row level security;
alter table public.community_reports  enable row level security;

-- Posts
drop policy if exists "Technicians read posts" on public.community_posts;
create policy "Technicians read posts" on public.community_posts
  for select to authenticated
  using (public.is_technician(auth.uid()) or public.is_admin(auth.uid()));

drop policy if exists "Technicians create posts" on public.community_posts;
create policy "Technicians create posts" on public.community_posts
  for insert to authenticated
  with check (technician_id = auth.uid() and public.is_technician(auth.uid()));

drop policy if exists "Author or admin deletes posts" on public.community_posts;
create policy "Author or admin deletes posts" on public.community_posts
  for delete to authenticated
  using (technician_id = auth.uid() or public.is_admin(auth.uid()));

-- Comments
drop policy if exists "Technicians read comments" on public.community_comments;
create policy "Technicians read comments" on public.community_comments
  for select to authenticated
  using (public.is_technician(auth.uid()) or public.is_admin(auth.uid()));

drop policy if exists "Technicians create comments" on public.community_comments;
create policy "Technicians create comments" on public.community_comments
  for insert to authenticated
  with check (technician_id = auth.uid() and public.is_technician(auth.uid()));

drop policy if exists "Author or admin deletes comments" on public.community_comments;
create policy "Author or admin deletes comments" on public.community_comments
  for delete to authenticated
  using (technician_id = auth.uid() or public.is_admin(auth.uid()));

-- Likes
drop policy if exists "Technicians read likes" on public.community_likes;
create policy "Technicians read likes" on public.community_likes
  for select to authenticated
  using (public.is_technician(auth.uid()) or public.is_admin(auth.uid()));

drop policy if exists "Technicians like" on public.community_likes;
create policy "Technicians like" on public.community_likes
  for insert to authenticated
  with check (technician_id = auth.uid() and public.is_technician(auth.uid()));

drop policy if exists "Technicians unlike own" on public.community_likes;
create policy "Technicians unlike own" on public.community_likes
  for delete to authenticated
  using (technician_id = auth.uid());

-- Reports
drop policy if exists "Reporter or admin reads reports" on public.community_reports;
create policy "Reporter or admin reads reports" on public.community_reports
  for select to authenticated
  using (technician_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "Technicians report" on public.community_reports;
create policy "Technicians report" on public.community_reports
  for insert to authenticated
  with check (technician_id = auth.uid() and public.is_technician(auth.uid()));

drop policy if exists "Admin clears reports" on public.community_reports;
create policy "Admin clears reports" on public.community_reports
  for delete to authenticated
  using (public.is_admin(auth.uid()));

-- ── Storage bucket for post images ─────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('community', 'community', true)
on conflict (id) do nothing;

drop policy if exists "Public reads community images" on storage.objects;
create policy "Public reads community images" on storage.objects
  for select using (bucket_id = 'community');

drop policy if exists "Technicians upload community images" on storage.objects;
create policy "Technicians upload community images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'community'
    and public.is_technician(auth.uid())
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Owners delete community images" on storage.objects;
create policy "Owners delete community images" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'community'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin(auth.uid()))
  );
