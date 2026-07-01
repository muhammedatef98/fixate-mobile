-- Full-codebase-vs-live-DB audit found more of the same duplicate-RLS-policy
-- pattern already cleaned up on market_comments: several tables accumulated
-- two or three policies with byte-identical `qual`/`with_check` on the same
-- command, left over from earlier migrations that re-created access rules
-- under new names without dropping the old ones. Verified via:
--
--   select tablename, cmd, qual, with_check, count(*)
--   from pg_policies where schemaname='public'
--   group by tablename, cmd, qual, with_check having count(*) > 1;
--
-- Dropping the redundant copies changes no actual access (the surviving
-- policy is condition-for-condition identical).

-- reviews: three UPDATE policies with the same auth.uid() = user_id check.
DROP POLICY IF EXISTS "Users can soft delete their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can update own reviews" ON public.reviews;
-- kept: reviews_customer_update_own

-- technicians: two INSERT policies with the same auth.uid() = user_id check.
DROP POLICY IF EXISTS "Users can create own technician profile" ON public.technicians;
-- kept: "Technicians can insert their own profile"

-- users: two INSERT policies with the same auth.uid() = id check.
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
-- kept: "Users can insert their own profile"
