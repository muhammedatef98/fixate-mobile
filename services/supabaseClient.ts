import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// React Native's fetch has no built-in request timeout. supabase-js relies on
// fetch directly, so a stalled connection (slow Wi-Fi, captive portal, dropped
// packets) can keep a request "in flight" forever — orders list never loads,
// submit button spins indefinitely, OTP send never resolves. We wrap fetch
// with an AbortController timeout so every supabase call is guaranteed to
// settle within a bounded window.
//
// Edge Functions get a longer timeout (25s) because they may legitimately
// take longer than a REST query — for example send-otp does Resend HTTP +
// hashing + insert, and on a cold function start you can hit 12-15s easily.
// REST/Auth queries get 12s because they should be fast.
const fetchWithTimeout: typeof fetch = (input, init) => {
  const url = typeof input === 'string' ? input : (input as Request).url || '';
  const isEdgeFunction = url.includes('/functions/v1/');
  const ms = isEdgeFunction ? 25000 : 12000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  return fetch(input as any, { ...(init || {}), signal: controller.signal }).finally(() => {
    clearTimeout(timeoutId);
  }) as Promise<Response>;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: fetchWithTimeout,
  },
});
