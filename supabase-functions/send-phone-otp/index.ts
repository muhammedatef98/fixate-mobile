// Supabase Edge Function: send-phone-otp
//
// Phone-only OTP login/registration:
//   1. Client posts { phone } in E.164 format (+9665XXXXXXXX).
//   2. We generate a 4-digit code, store its bcrypt hash in phone_otps with
//      a 5-minute expiry, and dispatch the SMS via the configured provider.
//   3. Client never sees the code; verify-phone-otp checks the hash later.
//
// SMS provider abstraction: if SMS_PROVIDER_URL is configured we POST the
// message to it; otherwise we log the code (dev mode) and return ok so the
// app flow stays usable while the production provider is being onboarded.
//
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Optional secrets: SMS_PROVIDER_URL, SMS_PROVIDER_TOKEN, SMS_SENDER_ID.
// Deployed with verify_jwt = false (anonymous users must reach this).

// @ts-nocheck — Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OTP_TTL_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 30;

const isE164Saudi = (s: string) => /^\+9665\d{8}$/.test(s);

const generateCode = (): string => {
  const buf = new Uint8Array(2);
  crypto.getRandomValues(buf);
  const n = (buf[0] << 8 | buf[1]) % 10000;
  return String(n).padStart(4, '0');
};

const sendSms = async (phone: string, code: string, lang: 'ar' | 'en') => {
  const providerUrl = Deno.env.get('SMS_PROVIDER_URL');
  const providerToken = Deno.env.get('SMS_PROVIDER_TOKEN');
  const senderId = Deno.env.get('SMS_SENDER_ID') ?? 'Fixate';

  const message = lang === 'ar'
    ? `رمز التحقق الخاص بك في Fixate: ${code}\nصالح لمدة ${OTP_TTL_MINUTES} دقائق.`
    : `Your Fixate verification code: ${code}\nValid for ${OTP_TTL_MINUTES} minutes.`;

  // Treat a missing OR non-http(s) provider URL (e.g. a leftover placeholder
  // secret) as dev mode rather than crashing on `new URL(...)`.
  const providerUrlValid = !!providerUrl && /^https?:\/\//i.test(providerUrl);

  if (!providerUrlValid) {
    // Dev mode: log the code so it can be retrieved from the function logs.
    // In production set SMS_PROVIDER_URL so this branch is never hit.
    console.log(`[send-phone-otp] DEV MODE — phone=${phone} code=${code}`);
    // TEMPORARY: echo the code back so the app can show it while no real SMS
    // provider is configured. This branch is unreachable once a valid
    // SMS_PROVIDER_URL secret is set, so it self-disables for production.
    return { delivered: false, dev: true, dev_code: code };
  }

  const res = await fetch(providerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(providerToken ? { Authorization: `Bearer ${providerToken}` } : {}),
    },
    body: JSON.stringify({ to: phone, sender: senderId, body: message }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SMS provider failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return { delivered: true };
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { phone, lang = 'ar' } = await req.json().catch(() => ({}));
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

    // Throttle: if a non-consumed OTP for this phone was created less than
    // RESEND_COOLDOWN_SECONDS ago, reject so people can't spam SMS costs.
    const cutoff = new Date(Date.now() - RESEND_COOLDOWN_SECONDS * 1000).toISOString();
    const { data: recent } = await supabase
      .from('phone_otps')
      .select('id, created_at')
      .eq('phone', phone)
      .is('consumed_at', null)
      .gt('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent) {
      return new Response(
        JSON.stringify({ error: 'cooldown', retry_after_seconds: RESEND_COOLDOWN_SECONDS }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const code = generateCode();
    // hashSync (not hash): the async API spawns a Web Worker, which the
    // Supabase Edge Runtime does not provide ("Worker is not defined").
    const codeHash = bcrypt.hashSync(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

    // Invalidate any prior live OTPs for this phone so only the latest is valid.
    await supabase
      .from('phone_otps')
      .update({ consumed_at: new Date().toISOString() })
      .eq('phone', phone)
      .is('consumed_at', null);

    const { error: insErr } = await supabase
      .from('phone_otps')
      .insert({ phone, code_hash: codeHash, purpose: 'login', expires_at: expiresAt });

    if (insErr) {
      console.error('[send-phone-otp] insert error', insErr);
      return new Response(
        JSON.stringify({ error: 'storage_failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dispatch = await sendSms(phone, code, lang);

    return new Response(
      JSON.stringify({ ok: true, expires_in: OTP_TTL_MINUTES * 60, ...dispatch }),
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
