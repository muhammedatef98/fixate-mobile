-- market_comments accumulated duplicate RLS policies over time: the
-- original set from 20260520000030 ("Anyone can read comments on active
-- listings", "Auth users can comment", "Authors and admins delete
-- comments") is now redundant with a newer, equivalent-or-broader set
-- (market_comments_read/insert/delete) added out-of-band. The old read
-- policy also references a status value ('active') that no longer exists
-- since the market_listings lifecycle rename to 'live'. Drop the stale
-- originals; the newer policies already cover the same access.
DROP POLICY IF EXISTS "Anyone can read comments on active listings" ON public.market_comments;
DROP POLICY IF EXISTS "Auth users can comment" ON public.market_comments;
DROP POLICY IF EXISTS "Authors and admins delete comments" ON public.market_comments;
