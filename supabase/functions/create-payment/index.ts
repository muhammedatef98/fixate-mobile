// @ts-nocheck — Deno runtime
// Supabase Edge Function: create-payment
// Creates a Stripe PaymentIntent and inserts a row in public.payments.
// Requires secrets: STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY
// Deploy: supabase functions deploy create-payment --no-verify-jwt=false

// @ts-ignore - Deno runtime
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore - Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-ignore - Deno runtime
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreatePaymentBody {
  orderId: string;
  amount: number;
  currency?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // @ts-ignore Deno
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    // @ts-ignore Deno
    const publishableKey = Deno.env.get('STRIPE_PUBLISHABLE_KEY') ?? '';
    // @ts-ignore Deno
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    // @ts-ignore Deno
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // User-scoped client to verify the caller
    const userClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: CreatePaymentBody = await req.json();
    if (!body.orderId || !body.amount || body.amount <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service-role client to verify ownership and write payments
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('id, user_id, status')
      .eq('id', body.orderId)
      .single();
    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (order.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
    const currency = (body.currency || 'SAR').toLowerCase();

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(body.amount * 100),
      currency,
      metadata: { order_id: body.orderId, user_id: user.id },
      automatic_payment_methods: { enabled: true },
    });

    const { data: payment, error: insertError } = await adminClient
      .from('payments')
      .insert({
        order_id: body.orderId,
        user_id: user.id,
        provider: 'stripe',
        provider_payment_id: intent.id,
        amount: body.amount,
        currency: body.currency || 'SAR',
        status: 'pending',
      })
      .select()
      .single();
    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({
        payment,
        clientSecret: intent.client_secret,
        publishableKey,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
