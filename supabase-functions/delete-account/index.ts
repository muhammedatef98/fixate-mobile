// Supabase Edge Function: delete-account
//
// Permanently deletes the calling user. Required by Apple App Store Guideline 5.1.1(v)
// and Google Play "Account deletion" policy for any app that supports user accounts.
//
// Flow:
//   1. Verify the JWT in the Authorization header — get the caller's user_id.
//   2. Soft-delete owned rows (orders, payments, reviews, addresses, technician
//      profile, etc.) so foreign keys don't block the auth row removal.
//   3. Hard-delete the auth.users row via service-role admin API.
//
// Required secrets:
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY
//
// Deploy with: supabase functions deploy delete-account

// @ts-nocheck — Deno runtime, not Node
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceRoleKey) {
      return json({ error: 'Server not configured' }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization' }, 401);

    // Verify caller using their JWT
    const userClient = createClient(url, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'Invalid session' }, 401);

    const admin = createClient(url, serviceRoleKey);
    const userId = user.id;

    // Best-effort cleanup of owned rows. Failures here don't block the auth
    // delete — RLS + ON DELETE CASCADE on the schema handle the rest.
    const tables = [
      'reviews', 'messages', 'payments', 'user_addresses',
      'notification_preferences', 'technician_locations', 'technicians', 'orders', 'users',
    ];
    for (const table of tables) {
      await admin.from(table).delete().eq('user_id', userId).then(() => {}, () => {});
      if (table === 'users' || table === 'technicians') {
        await admin.from(table).delete().eq('id', userId).then(() => {}, () => {});
      }
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) return json({ error: delErr.message }, 500);

    return json({ ok: true });
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
