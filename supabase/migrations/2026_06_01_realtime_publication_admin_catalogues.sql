-- ============================================================================
-- Realtime publication membership — admin-managed catalogues
-- ----------------------------------------------------------------------------
-- The three admin-managed catalogue tables introduced in the recent
-- migrations rely on Supabase Realtime `postgres_changes` subscriptions
-- so that admin edits propagate to running customer apps within seconds
-- (instead of waiting for the 5-minute in-memory cache TTL):
--
--   • service_area_regions
--   • service_area_cities      (Saudi cities; lat/lng/parent_city_id)
--   • request_device_types     (chatbot/request device chooser)
--   • request_faqs             (chatbot FAQ catalogue)
--
-- For events to fire, each table must be a member of the
-- `supabase_realtime` publication. The earlier migrations that created
-- these tables did NOT add them to the publication — without this fix,
-- the `subscribe*Changes` helpers in services/ register channels that
-- never deliver any payload, and customer apps fall back silently to
-- the 5-minute TTL.
--
-- Each ADD is wrapped in a DO block so the migration is idempotent —
-- safe to re-apply, and safe on databases where one or more tables
-- were added out-of-band via the dashboard.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname='supabase_realtime'
       AND schemaname='public' AND tablename='service_area_regions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_area_regions;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname='supabase_realtime'
       AND schemaname='public' AND tablename='service_area_cities'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_area_cities;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname='supabase_realtime'
       AND schemaname='public' AND tablename='request_device_types'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.request_device_types;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname='supabase_realtime'
       AND schemaname='public' AND tablename='request_faqs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.request_faqs;
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- REPLICA IDENTITY stays at the default (primary key). Our listeners only
-- react to "something changed → re-fetch", so they don't need the old row
-- payload that REPLICA IDENTITY FULL would provide. PK identity is enough
-- for UPDATE / INSERT / DELETE events to fire.
-- ---------------------------------------------------------------------------
