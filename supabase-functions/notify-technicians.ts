// This is a Supabase Edge Function that sends push notifications to all technicians
// when a new order is created

// To deploy this function:
// 1. Install Supabase CLI: npm install -g supabase
// 2. Login: supabase login
// 3. Link project: supabase link --project-ref gpucisjxecupcyosumgy
// 4. Deploy: supabase functions deploy notify-technicians

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const FIREBASE_SERVER_KEY = 'YOUR_FIREBASE_SERVER_KEY_HERE' // Get from Firebase Console

serve(async (req) => {
  try {
    const { orderId, orderData } = await req.json()

    // Get all technician FCM tokens from user metadata
    const { data: technicians, error } = await supabaseAdmin.auth.admin.listUsers()
    
    if (error) throw error

    const technicianTokens = technicians.users
      .filter(user => user.user_metadata?.role === 'technician' && user.user_metadata?.fcm_token)
      .map(user => user.user_metadata.fcm_token)

    if (technicianTokens.length === 0) {
      return new Response(JSON.stringify({ message: 'No technicians to notify' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Send push notification to all technicians
    const notification = {
      registration_ids: technicianTokens,
      notification: {
        title: '🔔 طلب جديد متاح!',
        body: `${orderData.brand} ${orderData.model} - ${orderData.issue}`,
        sound: 'default',
      },
      data: {
        orderId,
        type: 'new_order',
        ...orderData,
      },
    }

    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${FIREBASE_SERVER_KEY}`,
      },
      body: JSON.stringify(notification),
    })

    const result = await response.json()

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
