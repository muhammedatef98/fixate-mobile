import { createClient } from '@supabase/supabase-js';
import { secureStorageAdapter } from './secureStorageAdapter';

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
  const method =
    init?.method ??
    (typeof input === 'string' ? 'GET' : (input as Request).method) ??
    'GET';
  const isEdgeFunction = url.includes('/functions/v1/');
  const isStorage = url.includes('/storage/v1/');
  // Mutations against /auth/v1/user (email change, password change) trigger
  // a synchronous SMTP dispatch on the server. That can legitimately take
  // longer than the brisk 15s envelope used for quick auth reads
  // (sign-in / sign-out / getUser / token refresh). On a slow network or
  // Resend cold start it manifests as a client-side
  // "TypeError: Network request failed" — the request had already reached
  // Supabase and tokens were issued, but the client aborted before the
  // SMTP send returned. Give these specific mutations the same envelope
  // as edge functions; everything else on /auth/ stays at 15s.
  const isAuthMutation =
    url.includes('/auth/v1/user') && (method === 'PUT' || method === 'POST');
  const ms = isStorage
    ? 90000
    : isEdgeFunction
      ? 45000
      : isAuthMutation
        ? 45000
        : 15000;
  const controller = new AbortController();
  // Label the reason so a timeout abort is distinguishable in logs from a
  // user/navigation cancel (otherwise both surface as a bare "Aborted").
  const timeoutId = setTimeout(
    () => controller.abort(`Request timed out after ${ms}ms: ${method} ${url}`),
    ms
  );
  return fetch(input as any, { ...(init || {}), signal: controller.signal }).finally(() => {
    clearTimeout(timeoutId);
  }) as Promise<Response>;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: fetchWithTimeout,
  },
});
