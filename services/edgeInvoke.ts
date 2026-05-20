// Plain-fetch invoker for Supabase Edge Functions.
//
// We avoid supabase.functions.invoke on React Native because in some
// configurations its fetch path stages the request body through the
// Blob module — and after any Metro reload / context restart the blob
// URI becomes unresolvable, producing
//   "Unable to resolve data for blob: <uuid>"
// BEFORE the request even reaches the network. Plain fetch with a
// JSON string body sidesteps that.
//
// Behaviour:
//   - Throws nothing — returns { data } on 2xx, { errorMessage } otherwise.
//   - errorMessage is the server-provided "error" field when present,
//     else "<status> <statusText> — <body excerpt>".
//   - Times out via AbortController after `timeoutMs` (default 25s).
import { logger } from '../utils/logger';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

export interface EdgeResult<T> {
  data?: T;
  errorMessage?: string;
}

export async function callEdgeFunction<T = any>(
  name: string,
  body: any,
  opts: { timeoutMs?: number; accessToken?: string } = {}
): Promise<EdgeResult<T>> {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return { errorMessage: 'Missing Supabase env vars' };
  }
  const url = `${SUPABASE_URL.replace(/\/+$/, '')}/functions/v1/${name}`;
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 25000;
  const t = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        apikey: SUPABASE_ANON,
        // Use the caller-provided session token when available so RLS-aware
        // edge functions get the right user context. Fall back to the
        // anon key (for public endpoints like signup / send-otp).
        Authorization: `Bearer ${opts.accessToken || SUPABASE_ANON}`,
      },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(t);
    const msg = e?.name === 'AbortError'
      ? `${name} timed out`
      : (e?.message || String(e));
    return { errorMessage: msg };
  }
  clearTimeout(t);

  let text = '';
  try {
    text = await res.text();
  } catch {
    return { errorMessage: `${res.status} ${res.statusText || ''} (no body)`.trim() };
  }
  let parsed: any = null;
  if (text) {
    try { parsed = JSON.parse(text); } catch { /* not JSON */ }
  }
  if (!res.ok) {
    if (parsed?.error) return { errorMessage: parsed.error };
    const head = text.slice(0, 200).trim();
    return {
      errorMessage: `${res.status}${res.statusText ? ` ${res.statusText}` : ''}${head ? ` — ${head}` : ''}`,
    };
  }
  if (parsed && typeof parsed === 'object' && parsed.error) {
    logger.warn(`edge ${name} returned 2xx but with error field`, parsed.error);
    return { errorMessage: parsed.error };
  }
  return { data: parsed as T };
}
