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
// with a 12s AbortController timeout so every supabase call is guaranteed to
// settle within a bounded window.
const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
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
