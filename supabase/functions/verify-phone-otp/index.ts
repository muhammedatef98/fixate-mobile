// Supabase Edge Function: verify-phone-otp
//
// 1. Client posts { phone, code }.
// 2. We look up the live (non-consumed, non-expired) OTP row, bcrypt-compare
//    the 4-digit code, and mark consumed on success.
// 3. We then look up or create a Supabase Auth user keyed on this phone, and
//    return a magic-link token_hash the client can pass to
//    supabase.auth.verifyOtp({ type: 'magiclink' }) to establish a session.
//    This mirrors the pattern used by the existing email send-otp/verify-otp
//    pair so the mobile client can stay symmetric.
//
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Deployed with verify_jwt = false (anonymous users must reach this).

// @ts-nocheck — Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_ATTEMPTS = 5;
const isE164Saudi = (s: string) => /^\+9665\d{8}$/.test(s);

// Synthetic email used to root the Supabase Auth user. Phone-only sign-in on
// Supabase Auth requires a paid SMS provider; we side-step that by minting a
// stable email derived from the phone, creating the user via the admin API,
// and issuing a magic-link token the client converts into a session.
const phoneToSyntheticEmail = (phone: string) =>
  `${phone.replace(/[^0-9]/g, '')}@phone.fixate.local`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { phone, code } = await req.json().catch(() => ({}));
    if (!phone || !isE164Saudi(phone) || !code || !/^\d{4}$/.test(code)) {
      return new Response(
        JSON.stringify({ error: 'invalid_input' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: otp } = await supabase
      .from('phone_otps')
      .select('id, code_hash, attempts, expires_at')
      .eq('phone', phone)
      .is('consumed_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otp) {
      return new Response(
        JSON.stringify({ error: 'otp_not_found_or_expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (otp.attempts >= MAX_ATTEMPTS) {
      // Brick the OTP — user must request a new one.
      await supabase
        .from('phone_otps')
        .update({ consumed_at: new Date().toISOString() })
        .eq('id', otp.id);
      return new Response(
        JSON.stringify({ error: 'too_many_attempts' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const matches = await bcrypt.compare(code, otp.code_hash);
    if (!matches) {
      await supabase
        .from('phone_otps')
        .update({ attempts: otp.attempts + 1 })
        .eq('id', otp.id);
      return new Response(
        JSON.stringify({ error: 'wrong_code', attempts_remaining: MAX_ATTEMPTS - otp.attempts - 1 }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase
      .from('phone_otps')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', otp.id);

    const email = phoneToSyntheticEmail(phone);

    // Find-or-create the auth user keyed on this email.
    let userId: string | undefined;
    const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = list?.users?.find((u: any) => u.email === email);
    if (found) {
      userId = found.id;
    } else {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        phone,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: { phone, signup_method: 'phone_otp' },
      });
      if (createErr || !created?.user) {
        console.error('[verify-phone-otp] create user failed', createErr);
        return new Response(
          JSON.stringify({ error: 'user_create_failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = created.user.id;
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
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, token_hash: link.properties.hashed_token, user_id: userId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[verify-phone-otp] unhandled', e);
    return new Response(
      JSON.stringify({ error: e?.message ?? 'unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
