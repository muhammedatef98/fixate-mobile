-- Harden the provider-secret config tables (payment_gateways, otp_providers).
--
-- These tables were only ever touched by two admin screens (now deleted) and
-- are read by NOTHING else — the real Stripe/SMS secrets live in edge-function
-- env vars (create-payment reads Deno.env STRIPE_SECRET_KEY, not this table).
-- Yet both tables granted authenticated admins full ALL access, i.e. an admin
-- client token could `select secret_key / api_secret`. And anon/authenticated
-- held table-level grants (moot under RLS, but unwanted on a secrets table).
--
-- Since no client — admin or otherwise — needs these tables, remove every
-- client path to them. Only the service_role (server / edge functions, which
-- bypass RLS) retains access. This eliminates the client attack surface while
-- keeping the schema intact and reversible.

-- 1. Drop the admin ALL policies that permitted client SELECT of secrets.
drop policy if exists "Admins manage payment gateways" on public.payment_gateways;
drop policy if exists "Admins manage otp providers" on public.otp_providers;

-- 2. Strip every client grant. RLS stays enabled → deny-by-default with no
--    applicable grant means no client role can read or write these rows.
revoke all on public.payment_gateways from anon, authenticated, public;
revoke all on public.otp_providers   from anon, authenticated, public;

-- 3. RLS remains enabled (belt-and-suspenders alongside the revoked grants).
alter table public.payment_gateways enable row level security;
alter table public.otp_providers   enable row level security;
