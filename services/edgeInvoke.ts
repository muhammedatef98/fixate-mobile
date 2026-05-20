// Plain XHR invoker for Supabase Edge Functions.
//
// Why XHR not fetch:
//   On React Native, both `supabase.functions.invoke` AND plain `fetch`
//   can fail with "Unable to resolve data for blob: <uuid>" or with a
//   response whose `.text()` / `.json()` raises an error — the fetch
//   polyfill stages bodies through the Blob module and the blob can
//   become orphaned after a context restart. XMLHttpRequest is the
//   lower-level transport that fetch is built on; it never touches
//   BlobModule for `responseType: ''` (string) and reading
//   `responseText` always works synchronously once `onload` fires.
//
// Behaviour:
//   - Returns { data } on 2xx with a JSON body.
//   - Returns { errorMessage } on non-2xx OR on network/timeout.
//   - errorMessage prefers the server's `{ error }` field, then status
//     + statusText, then the raw body excerpt.

import { logger } from '../utils/logger';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

export interface EdgeResult<T> {
  data?: T;
  errorMessage?: string;
}

interface RawResponse {
  status: number;
  statusText: string;
  body: string;
}

const xhrPost = (
  url: string,
  body: string,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<RawResponse> =>
  new Promise<RawResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    // responseType='' (default) — string. NEVER 'blob' here.
    xhr.responseType = '';
    xhr.timeout = timeoutMs;
    xhr.onload = () => {
      resolve({
        status: xhr.status,
        statusText: xhr.statusText || '',
        body: xhr.responseText || '',
      });
    };
    xhr.onerror = () => reject(new Error('Network request failed'));
    xhr.ontimeout = () => reject(new Error('Request timed out'));
    xhr.onabort = () => reject(new Error('Request aborted'));
    try {
      xhr.send(body);
    } catch (e: any) {
      reject(e);
    }
  });

export async function callEdgeFunction<T = any>(
  name: string,
  payload: any,
  opts: { timeoutMs?: number; accessToken?: string } = {}
): Promise<EdgeResult<T>> {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return { errorMessage: 'Missing Supabase env vars' };
  }
  const url = `${SUPABASE_URL.replace(/\/+$/, '')}/functions/v1/${name}`;
  const body = JSON.stringify(payload ?? {});
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    apikey: SUPABASE_ANON,
    // Caller-provided token for user-context endpoints, anon key for
    // public ones (signup / send-otp).
    Authorization: `Bearer ${opts.accessToken || SUPABASE_ANON}`,
  };

  let raw: RawResponse;
  try {
    raw = await xhrPost(url, body, headers, opts.timeoutMs ?? 25000);
  } catch (e: any) {
    const msg = e?.message || String(e);
    return { errorMessage: msg };
  }

  // Try to parse the body once. It's a string from XHR, so this never
  // touches the Blob module and never throws an "unresolvable blob".
  let parsed: any = null;
  if (raw.body) {
    try {
      parsed = JSON.parse(raw.body);
    } catch {
      // Not JSON — fall through.
    }
  }

  if (raw.status < 200 || raw.status >= 300) {
    if (parsed?.error) return { errorMessage: parsed.error };
    const head = raw.body.slice(0, 200).trim();
    const statusBit = `${raw.status}${raw.statusText ? ` ${raw.statusText}` : ''}`;
    return { errorMessage: head ? `${statusBit} — ${head}` : statusBit };
  }

  if (parsed && typeof parsed === 'object' && parsed.error) {
    logger.warn(`edge ${name} returned 2xx but with error field`, parsed.error);
    return { errorMessage: parsed.error };
  }
  return { data: (parsed as T) ?? (undefined as any) };
}
