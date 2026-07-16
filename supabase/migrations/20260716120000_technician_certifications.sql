-- Structured certificates for the technician "Skills & Experience" screen.
-- Each entry: { id, title, issuer, year, image_path } — image_path points
-- into the private technician-docs bucket. Applied to the hosted project on
-- 2026-07-16 via MCP apply_migration.
alter table public.technicians
  add column if not exists certifications jsonb not null default '[]'::jsonb;
