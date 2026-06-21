-- ============================================================================
-- Market reports — buyers/visitors flagging a marketplace listing.
-- ============================================================================
-- A reporter submits a reason (one of a fixed set) plus optional free-text
-- details. Admins review the queue and either mark it reviewed, dismiss it,
-- or delete the offending listing (the cascade then removes the report too).
-- ============================================================================

create table if not exists public.market_reports (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.market_listings(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason      text not null,
  details     text,
  status      text not null default 'pending'   -- pending | reviewed | dismissed
              check (status in ('pending','reviewed','dismissed')),
  created_at  timestamptz not null default now()
);

create index if not exists market_reports_listing_idx on public.market_reports(listing_id);
create index if not exists market_reports_status_idx  on public.market_reports(status);

alter table public.market_reports enable row level security;

-- Reporter can insert their own reports.
drop policy if exists "insert_own_report" on public.market_reports;
create policy "insert_own_report" on public.market_reports
  for insert to authenticated with check (reporter_id = auth.uid());

-- Admins: full read + update (to change status).
drop policy if exists "admin_read_reports" on public.market_reports;
create policy "admin_read_reports" on public.market_reports
  for select to authenticated using (public.is_admin(auth.uid()));

drop policy if exists "admin_update_reports" on public.market_reports;
create policy "admin_update_reports" on public.market_reports
  for update to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
