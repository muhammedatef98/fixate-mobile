-- ============================================================================
-- Granular notification preferences (§8) — add system announcements +
-- technician-arrival categories to the existing notification_preferences table.
-- ============================================================================
alter table public.notification_preferences
  add column if not exists system_announcements boolean not null default true;

alter table public.notification_preferences
  add column if not exists technician_arrival boolean not null default true;
