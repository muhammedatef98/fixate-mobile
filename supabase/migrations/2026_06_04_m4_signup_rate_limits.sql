-- M-4: rate-limit table for the signup edge function.
--   Per-IP:    SIGNUP_MAX_PER_IP_PER_WINDOW (default 5)
--              within SIGNUP_WINDOW_MINUTES (default 15)
--   Per-email: SIGNUP_MAX_PER_EMAIL_PER_DAY (default 3) in 24h
--
-- Service-role only; RLS enabled with zero public policies.
--
-- Rollback:
--   DROP INDEX IF EXISTS public.idx_signup_rate_limits_window;
--   DROP TABLE IF EXISTS public.signup_rate_limits;

CREATE TABLE IF NOT EXISTS public.signup_rate_limits (
  key             text PRIMARY KEY,            -- "ip:1.2.3.4" or "email:lower@x.com"
  kind            text NOT NULL CHECK (kind IN ('ip','email')),
  window_start    timestamptz NOT NULL DEFAULT now(),
  attempts        integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  blocked_until   timestamptz
);

ALTER TABLE public.signup_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_signup_rate_limits_window
  ON public.signup_rate_limits(window_start);
