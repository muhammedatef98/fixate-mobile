// Supabase Edge Function: signup
//
// Auto-confirms new accounts so the app doesn't depend on Supabase SMTP.
// Without this, supabase.auth.signUp() returns "Error sending confirmation
// email" until SMTP is configured at the project level.
//
// Flow:
//   1. Client posts { email, password, name, role, phone? }.
//   2. We use the service-role admin API to create the user with
//      email_confirm: true so they can sign in immediately.
//   3. The handle_new_user trigger inserts the matching public.users row.
//   4. Client receives { ok, userId } and immediately calls signInWithPassword.
//
// M-4: rate-limited via public.signup_rate_limits to prevent automated
// account creation. Two windows enforced per call:
//   - per-IP:    SIGNUP_MAX_PER_IP_PER_WINDOW (default 5)
//                within SIGNUP_WINDOW_MINUTES (default 15 minutes)
//   - per-email: SIGNUP_MAX_PER_EMAIL_PER_DAY (default 3) in 24h
// Defaults match an honest mobile signup pattern (one user creates 1-2
// accounts per setup) while making bot fan-out expensive.
//
// CAPTCHA: not added in this pass. The current stack does not bundle a
// CAPTCHA frontend (no hCaptcha / Turnstile widget). Wiring one requires
// adding a token field to the signup screen and verifying it here.
// Documented as a follow-up; the IP+email rate limits buy time.
//
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Optional secrets:
//   SIGNUP_MAX_PER_IP_PER_WINDOW   default 5
//   SIGNUP_MAX_PER_EMAIL_PER_DAY   default 3
//   SIGNUP_WINDOW_MINUTES          default 15
// Deployed with verify_jwt = false (no auth required to create an account).

// @ts-nocheck — Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const JSON_HEADERS = { ...corsHeaders, 'Content-Type': 'application/json' };

const MAX_IP        = Math.max(1, Number(Deno.env.get('SIGNUP_MAX_PER_IP_PER_WINDOW') ?? '5'));
const MAX_EMAIL_24H = Math.max(1, Number(Deno.env.get('SIGNUP_MAX_PER_EMAIL_PER_DAY') ?? '3'));
const WINDOW_MIN    = Math.max(1, Number(Deno.env.get('SIGNUP_WINDOW_MINUTES') ?? '15'));
const WINDOW_MS     = WINDOW_MIN * 60 * 1000;
const DAY_MS        = 24 * 60 * 60 * 1000;

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// Pull the client IP from common proxy headers; first non-empty wins.
// Supabase fronts edge functions behind a proxy that sets x-forwarded-for.
function extractIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('cf-connecting-ip')
      || req.headers.get('x-real-ip')
      || 'unknown';
}

async function checkAndApplyRateLimit(
  admin: ReturnType<typeof createClient>,
  kind: 'ip' | 'email',
  rawKey: string,
  windowMs: number,
  maxAttempts: number,
): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }> {
  if (!rawKey || rawKey === 'unknown') return { ok: true }; // fail-open on missing key
  const key = `${kind}:${rawKey.toLowerCase()}`;
  const now = new Date();

  const { data: row } = await admin
    .from('signup_rate_limits')
    .select('key, window_start, attempts')
    .eq('key', key)
    .maybeSingle();

  if (!row) {
    await admin.from('signup_rate_limits').insert({
      key,
      kind,
      window_start: now.toISOString(),
      attempts: 1,
      last_attempt_at: now.toISOString(),
    });
    return { ok: true };
  }

  const winAgeMs = now.getTime() - new Date(row.window_start).getTime();
  if (winAgeMs >= windowMs) {
    await admin
      .from('signup_rate_limits')
      .update({
        window_start: now.toISOString(),
        attempts: 1,
        last_attempt_at: now.toISOString(),
      })
      .eq('key', key);
    return { ok: true };
  }

  if (row.attempts >= maxAttempts) {
    return { ok: false, retryAfterSeconds: Math.ceil((windowMs - winAgeMs) / 1000) };
  }

  await admin
    .from('signup_rate_limits')
    .update({ attempts: row.attempts + 1, last_attempt_at: now.toISOString() })
    .eq('key', key);
  return { ok: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceRoleKey) return json({ error: 'Server not configured' }, 500);

    const body = await req.json().catch(() => ({}));
    const { email, password, name, role, phone } = body || {};

    if (!email || !isEmail(email)) return json({ error: 'Invalid email' }, 400);
    if (!password || typeof password !== 'string' || password.length < 6) {
      return json({ error: 'Password must be at least 6 characters' }, 400);
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return json({ error: 'Name is required' }, 400);
    }
    const safeRole = role === 'technician' ? 'technician' : 'customer';

    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── M-4 RATE LIMITS ────────────────────────────────────────────────
    const ip = extractIp(req);
    const ipDecision = await checkAndApplyRateLimit(admin, 'ip', ip, WINDOW_MS, MAX_IP);
    if (!ipDecision.ok) {
      return json(
        { error: 'Too many signup attempts. Try again later.', retry_after_seconds: ipDecision.retryAfterSeconds },
        429,
      );
    }
    const emailDecision = await checkAndApplyRateLimit(admin, 'email', email, DAY_MS, MAX_EMAIL_24H);
    if (!emailDecision.ok) {
      return json(
        { error: 'Too many signup attempts for this email. Try again later.', retry_after_seconds: emailDecision.retryAfterSeconds },
        429,
      );
    }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: name.trim(),
        role: safeRole,
        user_type: safeRole,
        phone: phone ?? null,
      },
    });

    if (error) {
      const status = /already|exists|duplicate/i.test(error.message) ? 409 : 400;
      return json({ error: error.message }, status);
    }

    const userId = data.user?.id;

    // Backfill public.users defensively in case the handle_new_user trigger
    // is missing on this project — upsert is a no-op if the trigger already ran.
    if (userId) {
      await admin
        .from('users')
        .upsert(
          { id: userId, email, name: name.trim(), role: safeRole, phone: phone ?? null },
          { onConflict: 'id' }
        )
        .then(() => {}, (e) => console.warn('users upsert failed', e?.message?.slice(0, 200)));
    }

    return json({ ok: true, userId });
  } catch (err) {
    console.warn(`[signup] unhandled: ${(err as Error).message?.slice(0, 200)}`);
    return json({ error: 'Server error' }, 500);
  }
});
