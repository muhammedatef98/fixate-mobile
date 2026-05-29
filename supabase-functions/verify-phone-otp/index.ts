// Supabase Edge Function: verify-phone-otp
//
// 1. Validates the OTP with Authentica via `POST /verify-otp`.
// 2. On `status: true`, finds or creates the synthetic phone-anchored auth.users
//    row ({phone}@phone.fixate.local) and mints a magic-link token_hash the
//    client converts into a Supabase session. This preserves the existing
//    session model — no custom JWT is introduced.
//
// Rate limit (per-phone): OTP_MAX_ATTEMPTS verify attempts per 15-minute window,
// shared with send-phone-otp via public.otp_rate_limits.
//
// Secrets required:
//   AUTHENTICA_API_KEY               ← never logged, never returned to client
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Secrets optional:
//   AUTHENTICA_BASE_URL              default https://api.authentica.sa/api/v2
//   OTP_MAX_ATTEMPTS                 default 5
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

const AUTHENTICA_API_KEY      = Deno.env.get('AUTHENTICA_API_KEY') ?? '';
const AUTHENTICA_BASE_URL_RAW = Deno.env.get('AUTHENTICA_BASE_URL') ?? 'https://api.authentica.sa/api/v2';
const MAX_ATTEMPTS            = Math.max(1, Number(Deno.env.get('OTP_MAX_ATTEMPTS') ?? '5'));
const WINDOW_MS               = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS      = 15000;

const AUTHENTICA_BASE_URL = (() => {
  const trimmed = AUTHENTICA_BASE_URL_RAW.replace(/\/+$/, '');
  return /\/api\/v\d+$/.test(trimmed) ? trimmed : `${trimmed}/api/v2`;
})();

function normalizeSaudiPhoneE164(raw: string): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d]/g, '');
  if (digits.length === 12 && digits.startsWith('966')) return `+${digits}`;
  if (digits.length === 10 && digits.startsWith('05')) return `+966${digits.slice(1)}`;
  if (digits.length === 9  && digits.startsWith('5'))  return `+966${digits}`;
  if (/^\+9665\d{8}$/.test(String(raw))) return String(raw);
  return null;
}

function phoneTail(phone: string): string { return phone.slice(-4); }

function phoneToSyntheticEmail(phone: string): string {
  return `${phone.replace(/[^0-9]/g, '')}@phone.fixate.local`;
}

async function evaluateAndApplyVerifyThrottle(
  admin: ReturnType<typeof createClient>,
  phone: string
): Promise<{ ok: boolean; retryAfterSeconds?: number }> {
  const now = new Date();
  const { data: row } = await admin
    .from('otp_rate_limits')
    .select('phone, verify_window_start, verify_attempts')
    .eq('phone', phone)
    .maybeSingle();

  if (!row) {
    await admin.from('otp_rate_limits').insert({
      phone,
      verify_window_start: now.toISOString(),
      verify_attempts: 1,
    });
    return { ok: true };
  }

  const winAgeMs = now.getTime() - new Date(row.verify_window_start).getTime();
  if (winAgeMs >= WINDOW_MS) {
    await admin
      .from('otp_rate_limits')
      .update({
        verify_window_start: now.toISOString(),
        verify_attempts: 1,
        updated_at: now.toISOString(),
      })
      .eq('phone', phone);
    return { ok: true };
  }

  if (row.verify_attempts >= MAX_ATTEMPTS) {
    return { ok: false, retryAfterSeconds: Math.ceil((WINDOW_MS - winAgeMs) / 1000) };
  }

  await admin
    .from('otp_rate_limits')
    .update({
      verify_attempts: row.verify_attempts + 1,
      updated_at: now.toISOString(),
    })
    .eq('phone', phone);
  return { ok: true };
}

async function callAuthenticaVerifyOtp(phone: string, otp: string): Promise<{ ok: boolean; status: number; payload: Record<string, unknown> | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${AUTHENTICA_BASE_URL}/verify-otp`, {
      method: 'POST',
      headers: {
        'X-Authorization': AUTHENTICA_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ phone, otp }),
      signal: controller.signal,
    });
    const payload = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, payload };
  } finally {
    clearTimeout(timer);
  }
}

async function findOrCreateAuthUser(
  admin: ReturnType<typeof createClient>,
  phone: string,
  email: string
): Promise<string | null> {
  // List the first page — enough for our scale to find existing rows.
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = list?.users?.find((u: any) => u.email === email);
  if (found) return found.id;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    phone,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: { phone, signup_method: 'phone_otp_authentica' },
  });
  if (createErr || !created?.user) {
    console.warn(`[verify-phone-otp] create user failed: ${createErr?.message?.slice(0, 200) ?? 'unknown'}`);
    return null;
  }
  return created.user.id;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    if (!AUTHENTICA_API_KEY) {
      console.warn('[verify-phone-otp] AUTHENTICA_API_KEY missing');
      return new Response(JSON.stringify({ error: 'token_failed' }), { status: 500, headers: JSON_HEADERS });
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const rawPhone = String((body as any).phone ?? '');
    // Accept legacy `code` field and the spec's `otp` field interchangeably.
    const code = String((body as any).code ?? (body as any).otp ?? '').trim();
    const phone = normalizeSaudiPhoneE164(rawPhone);

    if (!phone || !/^\d{4,8}$/.test(code)) {
      return new Response(JSON.stringify({ error: 'invalid_input' }), { status: 400, headers: JSON_HEADERS });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const rl = await evaluateAndApplyVerifyThrottle(admin, phone);
    if (!rl.ok) {
      return new Response(
        JSON.stringify({ error: 'too_many_attempts', retry_after_seconds: rl.retryAfterSeconds }),
        { status: 429, headers: JSON_HEADERS }
      );
    }

    const upstream = await callAuthenticaVerifyOtp(phone, code);

    // Authentica returns 200 + `{status: true}` on success; on wrong code it
    // typically returns 401 + `{errors:[...]}`. We surface either as a
    // single friendly `wrong_code` to the client.
    const verified = !!(upstream.ok && upstream.payload && (upstream.payload as any).status === true);
    if (!verified) {
      if (upstream.status >= 500) {
        console.warn(`[verify-phone-otp] authentica upstream ${upstream.status} phone=***${phoneTail(phone)}`);
        return new Response(JSON.stringify({ error: 'token_failed' }), { status: 502, headers: JSON_HEADERS });
      }
      return new Response(JSON.stringify({ error: 'wrong_code' }), { status: 400, headers: JSON_HEADERS });
    }

    const email = phoneToSyntheticEmail(phone);
    const userId = await findOrCreateAuthUser(admin, phone, email);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'user_create_failed' }), { status: 500, headers: JSON_HEADERS });
    }

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    if (linkErr || !link?.properties?.hashed_token) {
      console.warn(`[verify-phone-otp] magic-link mint failed: ${linkErr?.message?.slice(0, 200) ?? 'unknown'}`);
      return new Response(JSON.stringify({ error: 'token_failed' }), { status: 500, headers: JSON_HEADERS });
    }

    // Reset the verify-attempt window on success so the next legitimate sign-in
    // for the same phone doesn't inherit the previous failed attempts.
    await admin
      .from('otp_rate_limits')
      .update({
        verify_attempts: 0,
        verify_window_start: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('phone', phone);

    return new Response(
      JSON.stringify({ ok: true, token_hash: link.properties.hashed_token, user_id: userId }),
      { status: 200, headers: JSON_HEADERS }
    );
  } catch (e) {
    const aborted = (e as any)?.name === 'AbortError';
    console.warn(`[verify-phone-otp] unhandled: ${aborted ? 'timeout' : (e as Error).message?.slice(0, 200)}`);
    return new Response(JSON.stringify({ error: 'token_failed' }), { status: 502, headers: JSON_HEADERS });
  }
});
