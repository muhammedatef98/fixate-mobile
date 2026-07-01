-- market_comments was never added to the supabase_realtime publication, so
-- new comments/replies only ever showed up after a manual reload. Add it,
-- guarding against re-runs (ALTER PUBLICATION ... ADD TABLE errors if the
-- table is already a member).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'market_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.market_comments;
  END IF;
END $$;
