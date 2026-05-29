-- H-2: public_user_cards is a SECURITY DEFINER view that exposes
--      (id, name, avatar_url) — fields the app already treats as public
--      (marketplace seller cards, comment authors, etc.).
--
-- Switching to security_invoker=true is NOT chosen because the underlying
-- users SELECT policy only allows self-read or admin, which would break
-- every "seller card" / "commenter card" surface in the market.
--
-- Risk reduction applied here:
--   1. Filter out soft-deleted accounts (deleted_at IS NULL).
--   2. Lock down to the three columns that are public by design.
--   3. Restrict to authenticated only (anon loses access).

COMMENT ON VIEW public.public_user_cards IS
  'Intentional SECURITY DEFINER view: id+name+avatar_url are public-by-design '
  'fields used by marketplace seller/commenter cards. Body filters out '
  'soft-deleted users. Do NOT add columns without re-evaluating who can SELECT.';

CREATE OR REPLACE VIEW public.public_user_cards AS
  SELECT id, name, avatar_url
    FROM public.users
   WHERE deleted_at IS NULL;

REVOKE SELECT ON public.public_user_cards FROM anon;
GRANT  SELECT ON public.public_user_cards TO authenticated;
