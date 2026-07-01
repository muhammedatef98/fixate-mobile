-- market_comments.author_name was defined in 20260520000030 but is absent
-- from the live table (schema drift — that migration's CREATE TABLE IF NOT
-- EXISTS no-opped against a pre-existing table). Its absence silently broke
-- nested replies: the client's addComment() fallback for the resulting
-- "unknown column" error used to drop parent_id along with author_name, so
-- every reply was persisted as a top-level comment instead of nested under
-- its parent.
ALTER TABLE public.market_comments
  ADD COLUMN IF NOT EXISTS author_name text;
