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
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Deployed with verify_jwt = false (no auth required to create an account).

// @ts-nocheck — Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

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
    const safeRole =
      role === 'technician' ? 'technician' : role === 'courier' ? 'courier' : 'customer';

    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

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
        .then(() => {}, (e) => console.error('users upsert failed', e));
    }

    return json({ ok: true, userId });
  } catch (err) {
    return json({ error: (err as Error).message ?? 'Unknown error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
