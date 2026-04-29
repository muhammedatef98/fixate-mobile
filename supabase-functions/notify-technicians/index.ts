// Supabase Edge Function: notify-technicians
// Sends push notifications via Firebase Cloud Messaging (HTTP v1 API) to all
// available technicians when a new order is created.
// Required secrets:
//   - FCM_PROJECT_ID
//   - FCM_SERVICE_ACCOUNT_JSON (the entire service-account JSON string)
// Deploy: supabase functions deploy notify-technicians

// @ts-ignore Deno
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore Deno
import { create, getNumericDate } from 'https://deno.land/x/djwt@v2.9.1/mod.ts';
// @ts-ignore Deno
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface NotifyBody {
  orderId: string;
  orderData: {
    brand?: string;
    model?: string;
    issue?: string;
    [k: string]: any;
  };
}

async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = getNumericDate(0);
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: getNumericDate(3600),
  };
  const pem = serviceAccount.private_key as string;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const jwt = await create({ alg: 'RS256', typ: 'JWT' }, payload, key);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error('Failed to fetch FCM access token');
  return json.access_token;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return buffer;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // @ts-ignore Deno
    const projectId = Deno.env.get('FCM_PROJECT_ID');
    // @ts-ignore Deno
    const serviceAccountJson = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
    // @ts-ignore Deno
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    // @ts-ignore Deno
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!projectId || !serviceAccountJson) {
      return new Response(JSON.stringify({ error: 'FCM not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { orderId, orderData }: NotifyBody = await req.json();
    if (!orderId) {
      return new Response(JSON.stringify({ error: 'orderId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: technicians, error } = await adminClient.auth.admin.listUsers();
    if (error) throw error;

    const tokens: string[] = technicians.users
      .filter((u: any) => u.user_metadata?.role === 'technician' && u.user_metadata?.fcm_token)
      .map((u: any) => u.user_metadata.fcm_token);

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ message: 'No technicians to notify' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    const accessToken = await getAccessToken(serviceAccount);

    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    const results = await Promise.allSettled(
      tokens.map((token) =>
        fetch(fcmUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: {
              token,
              notification: {
                title: 'طلب جديد متاح',
                body: `${orderData?.brand ?? ''} ${orderData?.model ?? ''} - ${orderData?.issue ?? ''}`.trim(),
              },
              data: {
                orderId,
                type: 'new_order',
              },
              android: { priority: 'HIGH' },
              apns: { payload: { aps: { sound: 'default' } } },
            },
          }),
        })
      )
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    return new Response(
      JSON.stringify({ success: true, sent: succeeded, total: tokens.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
