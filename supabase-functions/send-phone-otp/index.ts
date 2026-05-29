// Supabase Edge Function: send-phone-otp
//
// Wraps Authentica `POST /send-otp` (https://docs.authentica.sa). The mobile
// client keeps its existing call shape — `{ phone, lang }` in, `{ success,
// expires_in }` out — so no client refactor is needed when swapping the
// provider.
//
// Rate limiting (per-phone) enforced via public.otp_rate_limits:
//   - resend cooldown:   OTP_RESEND_COOLDOWN_SECONDS  (default 60)
//   - sends per window:  OTP_MAX_ATTEMPTS in 15 minutes (default 5)
//
// Secrets required:
//   AUTHENTICA_API_KEY              ← never logged, never returned to client
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Secrets optional:
//   AUTHENTICA_BASE_URL             default https://api.authentica.sa/api/v2
//   OTP_DEFAULT_CHANNEL             sms | whatsapp | email   (default sms)
//   OTP_RESEND_COOLDOWN_SECONDS     default 60
//   OTP_MAX_ATTEMPTS                default 5
//
// Deployed with verify_jwt = false (anonymous users must reach this).

// @ts-nocheck — Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json' };

const AUTHENTICA_API_KEY            = Deno.env.get('AUTHENTICA_API_KEY') ?? '';
const AUTHENTICA_BASE_URL_RAW       = Deno.env.get('AUTHENTICA_BASE_URL') ?? 'https://api.authentica.sa/api/v2';
const DEFAULT_CHANNEL               = (Deno.env.get('OTP_DEFAULT_CHANNEL') ?? 'sms') as 'sms'|'whatsapp'|'email';
const RESEND_COOLDOWN_SECONDS       = Math.max(1, Number(Deno.env.get('OTP_RESEND_COOLDOWN_SECONDS') ?? '60'));
const MAX_ATTEMPTS                  = Math.max(1, Number(Deno.env.get('OTP_MAX_ATTEMPTS') ?? '5'));
const WINDOW_MS                     = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS            = 15000;

// Normalize whatever the env var ended up with into a clean base ending in /api/vN
const AUTHENTICA_BASE_URL = (() => {
  const trimmed = AUTHENTICA_BASE_URL_RAW.replace(/\/+$/, '');
  return /\/api\/v\d+$/.test(trimmed) ? trimmed : `${trimmed}/api/v2`;
})();

// Accept the most common Saudi phone shapes and return strict E.164 +9665XXXXXXXX.
// Returns null when the number can't be coerced into a 9-digit subscriber number
// starting with 5.
function normalizeSaudiPhoneE164(raw: string): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d]/g, '');
  if (digits.length === 12 && digits.startsWith('966')) return `+${digits}`;
  if (digits.length === 10 && digits.startsWith('05')) return `+966${digits.slice(1)}`;
  if (digits.length === 9  && digits.startsWith('5'))  return `+966${digits}`;
  // already-E.164 input passes through normalization
  if (/^\+9665\d{8}$/.test(String(raw))) return String(raw);
  return null;
}

// Last 4 digits only — used for log lines so we never spill the full number.
function phoneTail(phone: string): string { return phone.slice(-4); }

// Map Authentica HTTP/business errors to our small set of friendly error keys.
function mapAuthenticaError(status: number): string {
  if (status === 401) return 'storage_failed';     // bad API key — operator issue
  if (status === 429) return 'cooldown';            // Authentica-side throttle
  if (status >= 500) return 'storage_failed';
  return 'storage_failed';
}

interface RateLimitDecision {
  ok: boolean;
  retryAfterSeconds?: number;
  errorKey?: 'cooldown' | 'too_many_attempts';
}

async function evaluateAndApplySendThrottle(
  admin: ReturnType<typeof createClient>,
  phone: string
): Promise<RateLimitDecision> {
  const now = new Date();
  const { data: row } = await admin
    .from('otp_rate_limits')
    .select('phone, last_sent_at, send_window_start, send_attempts')
    .eq('phone', phone)
    .maybeSingle();

  if (!row) {
    // first send for this phone — record it.
    await admin.from('otp_rate_limits').insert({
      phone,
      last_sent_at: now.toISOString(),
      send_window_start: now.toISOString(),
      send_attempts: 1,
    });
    return { ok: true };
  }

  // Cooldown check
  if (row.last_sent_at) {
    const sinceMs = now.getTime() - new Date(row.last_sent_at).getTime();
    if (sinceMs < RESEND_COOLDOWN_SECONDS * 1000) {
      return {
        ok: false,
        errorKey: 'cooldown',
        retryAfterSeconds: Math.ceil((RESEND_COOLDOWN_SECONDS * 1000 - sinceMs) / 1000),
      };
    }
  }

  // 15-minute window check
  const winAgeMs = now.getTime() - new Date(row.send_window_start).getTime();
  if (winAgeMs >= WINDOW_MS) {
    // window expired — start a fresh window.
    await admin
      .from('otp_rate_limits')
      .update({
        send_window_start: now.toISOString(),
        send_attempts: 1,
        last_sent_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('phone', phone);
    return { ok: true };
  }

  if (row.send_attempts >= MAX_ATTEMPTS) {
    return {
      ok: false,
      errorKey: 'too_many_attempts',
      retryAfterSeconds: Math.ceil((WINDOW_MS - winAgeMs) / 1000),
    };
  }

  await admin
    .from('otp_rate_limits')
    .update({
      send_attempts: row.send_attempts + 1,
      last_sent_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('phone', phone);
  return { ok: true };
}

async function callAuthenticaSendOtp(phone: string): Promise<{ ok: boolean; status: number; payload: Record<string, unknown> | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${AUTHENTICA_BASE_URL}/send-otp`, {
      method: 'POST',
      headers: {
        'X-Authorization': AUTHENTICA_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        method: DEFAULT_CHANNEL,
        phone,
      }),
      signal: controller.signal,
    });
    const payload = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, payload };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    if (!AUTHENTICA_API_KEY) {
      console.warn('[send-phone-otp] AUTHENTICA_API_KEY missing');
      return new Response(JSON.stringify({ error: 'storage_failed' }), { status: 500, headers: JSON_HEADERS });
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const rawPhone = String((body as any).phone ?? '');
    const phone = normalizeSaudiPhoneE164(rawPhone);

    if (!phone) {
      return new Response(JSON.stringify({ error: 'invalid_phone' }), { status: 400, headers: JSON_HEADERS });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const decision = await evaluateAndApplySendThrottle(admin, phone);
    if (!decision.ok) {
      return new Response(
        JSON.stringify({ error: decision.errorKey, retry_after_seconds: decision.retryAfterSeconds }),
        { status: 429, headers: JSON_HEADERS }
      );
    }

    const upstream = await callAuthenticaSendOtp(phone);

    if (!upstream.ok) {
      console.warn(`[send-phone-otp] authentica upstream ${upstream.status} phone=***${phoneTail(phone)}`);
      return new Response(
        JSON.stringify({ error: mapAuthenticaError(upstream.status) }),
        { status: upstream.status === 429 ? 429 : 502, headers: JSON_HEADERS }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        expires_in: 600, // Authentica default — 10 minutes
        message: typeof upstream.payload?.message === 'string' ? upstream.payload.message : 'OTP sent',
        // intentionally NOT echoing any provider session/request id back to the client
      }),
      { status: 200, headers: JSON_HEADERS }
    );
  } catch (e) {
    const aborted = (e as any)?.name === 'AbortError';
    console.warn(`[send-phone-otp] unhandled: ${aborted ? 'timeout' : (e as Error).message?.slice(0, 200)}`);
    return new Response(JSON.stringify({ error: 'storage_failed' }), { status: 502, headers: JSON_HEADERS });
  }
});
