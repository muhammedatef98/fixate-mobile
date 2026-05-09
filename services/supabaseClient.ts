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
// Different paths get different ceilings because their legitimate work
// envelopes differ a lot:
//   - REST / Auth: short, idempotent, should finish in 1-2s. 15s ceiling.
//   - Edge Functions: hashing + Resend HTTP + DB insert, cold-start prone.
//     45s ceiling.
//   - Storage upload/download: large binary over mobile networks; a 5 MB
//     photo on weak 4G can take 30-50s. 90s ceiling, otherwise the user
//     gets `StorageUnknownError: Aborted` halfway through their submit.
const fetchWithTimeout: typeof fetch = (input, init) => {
  const url = typeof input === 'string' ? input : (input as Request).url || '';
  const isEdgeFunction = url.includes('/functions/v1/');
  const isStorage = url.includes('/storage/v1/');
  const ms = isStorage ? 90000 : isEdgeFunction ? 45000 : 15000;
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
