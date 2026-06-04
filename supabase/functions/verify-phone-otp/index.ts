// Supabase Edge Function: verify-phone-otp
//
// Authentica-managed OTP verification:
//   1. Client posts { phone, code }.
//   2. We rate-limit (max 5 verify attempts per 15 min per phone).
//   3. We POST to Authentica /verify-otp. They own the code and validate it.
//   4. On success, find-or-create the Supabase Auth user keyed on this phone,
//      mint a magic-link token_hash, reset the verify counter, and return so
//      the client can call supabase.auth.verifyOtp({ type: 'magiclink' }) to
//      establish a session.
//
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AUTHENTICA_API_KEY.
// Optional secrets: AUTHENTICA_BASE_URL (default https://api.authentica.sa/api/v2).
// Deployed with verify_jwt = false (anonymous users must reach this).

// @ts-nocheck — Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const VERIFY_MAX_ATTEMPTS = 5;
const VERIFY_WINDOW_MINUTES = 15;

const AUTHENTICA_API_KEY = Deno.env.get('AUTHENTICA_API_KEY') ?? '';
const AUTHENTICA_BASE_URL_RAW = Deno.env.get('AUTHENTICA_BASE_URL') ?? 'https://api.authentica.sa/api/v2';
const AUTHENTICA_BASE_URL = (() => {
  const trimmed = AUTHENTICA_BASE_URL_RAW.replace(/\/+$/, '');
  return /\/api\/v\d+$/.test(trimmed) ? trimmed : `${trimmed}/api/v2`;
})();

const isE164Saudi = (s: string) => /^\+9665\d{8}$/.test(s);

// Synthetic email used to root the Supabase Auth user. Phone-only sign-in on
// Supabase Auth requires a paid SMS provider; we side-step that by minting a
// stable email derived from the phone, creating the user via the admin API,
// and issuing a magic-link token the client converts into a session.
const phoneToSyntheticEmail = (phone: string) =>
  `${phone.replace(/[^0-9]/g, '')}@phone.fixate.local`;

async function findOrCreateAuthUser(
  admin: ReturnType<typeof createClient>,
  phone: string,
  email: string
): Promise<string | null> {
  // Supabase Auth stores phone without the leading '+', so normalize both
  // sides of the comparison to plain digits before matching.
  const phoneDigits = phone.replace(/[^0-9]/g, '');

  // Paginate through ALL users to find by email or phone
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data: list } = await admin.auth.admin.listUsers({ page, perPage });
    const users = list?.users ?? [];

    const found = users.find(
      (u: any) =>
        u.email === email ||
        u.phone === phone ||
        u.phone === phoneDigits ||
        (u.phone && u.phone.replace(/[^0-9]/g, '') === phoneDigits)
    );

    if (found) {
      // If found but missing synthetic email, patch it
      if (found.email !== email) {
        await admin.auth.admin.updateUser(found.id, {
          email,
          email_confirm: true,
        }).catch(() => null);
      }
      return found.id;
    }

    // If returned fewer than perPage, we've reached the end
    if (users.length < perPage) break;
    page++;
  }

  // Not found anywhere — create new user
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

// Authentica-side verify. They own the code and tell us if it's valid.
const callAuthenticaVerify = async (phone: string, code: string) => {
  if (!AUTHENTICA_API_KEY) {
    // In dev mode with no API key we accept any 4-8 digit code so the rest
    // of the flow can be exercised locally.
    console.log(`[verify-phone-otp] DEV MODE — accepting code without Authentica`);
    return { matched: true, dev: true };
  }

  const res = await fetch(`${AUTHENTICA_BASE_URL}/verify-otp`, {
    method: 'POST',
    headers: {
      'X-Authorization': AUTHENTICA_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ phone, otp: code }),
  });

  const payload = await res.json().catch(() => null);

  if (res.status >= 500) {
    console.error(`[verify-phone-otp] Authentica 5xx (${res.status})`, payload);
    return { matched: false, upstream_5xx: true };
  }

  const explicitlyFailed =
    payload &&
    (
      payload.status === false ||
      payload.success === false ||
      payload.verified === false
    );

  // Authentica answers 2xx for both "valid" and "invalid" codes; rely on body.
  const matched = res.ok && payload && !explicitlyFailed;

  return { matched };
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { phone, code } = await req.json().catch(() => ({}));
    const cleanCode = String(code ?? '').replace(/\s/g, '').trim();
    if (!phone || !isE164Saudi(phone) || !/^\d{4,8}$/.test(cleanCode)) {
      return new Response(
        JSON.stringify({ error: 'invalid_input' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Rate limit: max VERIFY_MAX_ATTEMPTS in a rolling VERIFY_WINDOW_MINUTES.
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const { data: rateRow } = await supabase
      .from('otp_rate_limits')
      .select('phone, verify_window_start, verify_attempts')
      .eq('phone', phone)
      .maybeSingle();

    const windowMs = VERIFY_WINDOW_MINUTES * 60 * 1000;
    let attemptsInWindow = 0;
    let windowStart = nowIso;
    if (rateRow?.verify_window_start) {
      const ws = new Date(rateRow.verify_window_start).getTime();
      if (nowMs - ws < windowMs) {
        attemptsInWindow = rateRow.verify_attempts ?? 0;
        windowStart = rateRow.verify_window_start;
      }
    }

    if (attemptsInWindow >= VERIFY_MAX_ATTEMPTS) {
      return new Response(
        JSON.stringify({ error: 'too_many_attempts' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ask Authentica to verify the code.
    const verify = await callAuthenticaVerify(phone, cleanCode);

    if (verify.upstream_5xx) {
      return new Response(
        JSON.stringify({ error: 'token_failed' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!verify.matched) {
      // Bump verify counter on bad attempt.
      await supabase
        .from('otp_rate_limits')
        .upsert(
          {
            phone,
            verify_window_start: windowStart,
            verify_attempts: attemptsInWindow + 1,
            updated_at: nowIso,
          },
          { onConflict: 'phone' }
        );
      return new Response(
        JSON.stringify({
          error: 'wrong_code',
          attempts_remaining: Math.max(0, VERIFY_MAX_ATTEMPTS - attemptsInWindow - 1),
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const email = phoneToSyntheticEmail(phone);

    // Find-or-create the auth user keyed on this email or phone.
    let userId: string | null = null;
    try {
      userId = await findOrCreateAuthUser(supabase, phone, email);
    } catch (e: any) {
      console.error('[verify-phone-otp] findOrCreateAuthUser threw', e);
      return new Response(
        JSON.stringify({ error: 'user_create_failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'user_create_failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mint a magic-link token the client can convert into a session.
    const { data: link, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    if (linkErr || !link?.properties?.hashed_token) {
      console.error('[verify-phone-otp] link error', linkErr);
      return new Response(
        JSON.stringify({ error: 'token_failed' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Reset the verify counter on success.
    await supabase
      .from('otp_rate_limits')
      .upsert(
        {
          phone,
          verify_window_start: nowIso,
          verify_attempts: 0,
          updated_at: nowIso,
        },
        { onConflict: 'phone' }
      );

    return new Response(
      JSON.stringify({ ok: true, token_hash: link.properties.hashed_token, user_id: userId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('[verify-phone-otp] unhandled', e);
    return new Response(
      JSON.stringify({ error: e?.message ?? 'unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
