// Supabase Edge Function: send-phone-otp
//
// Authentica-managed OTP flow:
//   1. Client posts { phone } in E.164 format (+9665XXXXXXXX).
//   2. We rate-limit (max 1 send per 30s per phone, tracked in otp_rate_limits).
//   3. We POST to Authentica /send-otp; Authentica generates the code and sends
//      the SMS. We never see or store the code — verify-phone-otp asks
//      Authentica to validate it later.
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

const OTP_TTL_SECONDS = 300;
const RESEND_COOLDOWN_SECONDS = 30;
// Rolling-window cap: at most DAILY_SEND_CAP paid SMS per phone per 24h.
// `send_attempts` counts sends inside the current window and resets once
// the last send is older than the window (SMS-pumping cost control).
const DAILY_SEND_CAP = 8;
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

const AUTHENTICA_API_KEY = Deno.env.get('AUTHENTICA_API_KEY') ?? '';
const AUTHENTICA_BASE_URL_RAW = Deno.env.get('AUTHENTICA_BASE_URL') ?? 'https://api.authentica.sa/api/v2';
const AUTHENTICA_BASE_URL = (() => {
  const trimmed = AUTHENTICA_BASE_URL_RAW.replace(/\/+$/, '');
  return /\/api\/v\d+$/.test(trimmed) ? trimmed : `${trimmed}/api/v2`;
})();
const AUTHENTICA_METHOD = Deno.env.get('AUTHENTICA_METHOD') ?? 'sms';
const AUTHENTICA_TEMPLATE_ID = Deno.env.get('AUTHENTICA_TEMPLATE_ID') ?? '';

const isE164Saudi = (s: string) => /^\+9665\d{8}$/.test(s);

// Authentica-side send. They generate the code and dispatch the SMS.
const callAuthenticaSend = async (phone: string) => {
  if (!AUTHENTICA_API_KEY) {
    console.log(`[send-phone-otp] DEV MODE — AUTHENTICA_API_KEY not set, phone=${phone}`);
    return { ok: true, dev: true };
  }

  const res = await fetch(`${AUTHENTICA_BASE_URL}/send-otp`, {
    method: 'POST',
    headers: {
      'X-Authorization': AUTHENTICA_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      phone,
      method: AUTHENTICA_METHOD,
      ...(AUTHENTICA_TEMPLATE_ID ? { template_id: Number(AUTHENTICA_TEMPLATE_ID) || AUTHENTICA_TEMPLATE_ID } : {}),
    }),
  });

  const payload = await res.json().catch(() => null);

  // Treat any 2xx as success unless Authentica explicitly signals failure.
  const explicitlyFailed =
    payload &&
    (
      payload.status === false ||
      payload.success === false ||
      payload.error ||
      payload.errors
    );

  if (!res.ok || explicitlyFailed) {
    const preview = JSON.stringify(payload)?.slice(0, 300) ?? '';
    console.error(`[send-phone-otp] Authentica send-otp failed (${res.status}): ${preview}`);
    return { ok: false };
  }

  return { ok: true };
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { phone } = await req.json().catch(() => ({}));
    if (!phone || !isE164Saudi(phone)) {
      return new Response(
        JSON.stringify({ error: 'invalid_phone' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Rate limit: max 1 send per RESEND_COOLDOWN_SECONDS per phone.
    const nowIso = new Date().toISOString();
    const { data: rateRow } = await supabase
      .from('otp_rate_limits')
      .select('phone, last_sent_at, send_attempts')
      .eq('phone', phone)
      .maybeSingle();

    let attemptsInWindow = 0;
    if (rateRow?.last_sent_at) {
      const last = new Date(rateRow.last_sent_at).getTime();
      const elapsedMs = Date.now() - last;
      if (elapsedMs / 1000 < RESEND_COOLDOWN_SECONDS) {
        return new Response(
          JSON.stringify({
            error: 'cooldown',
            retry_after_seconds: Math.ceil(RESEND_COOLDOWN_SECONDS - elapsedMs / 1000),
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // Still inside the 24h window → keep counting; otherwise start fresh.
      if (elapsedMs < DAILY_WINDOW_MS) {
        attemptsInWindow = rateRow.send_attempts ?? 0;
      }
      if (attemptsInWindow >= DAILY_SEND_CAP) {
        console.warn(`[send-phone-otp] daily cap hit for ${phone}`);
        return new Response(
          JSON.stringify({ error: 'daily_limit' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Ask Authentica to generate + send the OTP.
    const send = await callAuthenticaSend(phone);
    if (!send.ok) {
      return new Response(
        JSON.stringify({ error: 'send_failed' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Bump rate-limit row (upsert keyed on phone).
    await supabase
      .from('otp_rate_limits')
      .upsert(
        {
          phone,
          last_sent_at: nowIso,
          send_attempts: attemptsInWindow + 1,
          updated_at: nowIso,
        },
        { onConflict: 'phone' }
      );

    return new Response(
      JSON.stringify({ ok: true, expires_in: OTP_TTL_SECONDS, ...(send.dev ? { dev: true } : {}) }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[send-phone-otp] unhandled', e);
    return new Response(
      JSON.stringify({ error: e?.message ?? 'unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
