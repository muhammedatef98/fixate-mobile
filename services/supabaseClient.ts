import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// React Native fetch has two problems for us:
//   1. No built-in request timeout (slow Wi-Fi → request hangs forever).
//   2. On some RN+iOS combos the polyfill stages response bodies through
//      BlobModule, and the blob URI becomes unresolvable after any JS
//      context restart — yielding the infamous
//        "Unable to resolve data for blob: <uuid>"
//      error. We've seen this consistently on /auth/v1/* responses
//      (verifyOtp → setSession → _getUser path), which is why we route
//      those through XMLHttpRequest instead.
//
// Strategy:
//   - Auth endpoints (/auth/v1/*) → XHR, returning a Response-shaped
//     object that supabase-js can read via .text() / .json() / .ok.
//   - Everything else (REST, storage, realtime control plane) → normal
//     fetch with the AbortController timeout.

// Build a synthetic Response from an XHR result. supabase-js only reads
// a handful of properties (ok, status, statusText, headers, text(),
// json()), so we don't need the full Web Response surface.
const makeXhrResponse = (xhr: XMLHttpRequest): Response => {
  const body: string = xhr.responseText || '';
  // Parse the raw headers blob into a Headers instance so supabase-js
  // can probe Content-Type if it wants to.
  const headers = new Headers();
  const rawHeaders = xhr.getAllResponseHeaders() || '';
  rawHeaders
    .trim()
    .split(/[\r\n]+/)
    .forEach((line) => {
      const idx = line.indexOf(':');
      if (idx > 0) {
        const k = line.slice(0, idx).trim();
        const v = line.slice(idx + 1).trim();
        if (k) headers.append(k, v);
      }
    });
  const ok = xhr.status >= 200 && xhr.status < 300;
  // `Response` itself works on RN but constructing it with a string
  // body is fine — we still implement the methods manually so we know
  // they never touch BlobModule.
  const resp: any = {
    ok,
    status: xhr.status,
    statusText: xhr.statusText || '',
    headers,
    url: xhr.responseURL || '',
    type: 'basic',
    redirected: false,
    bodyUsed: false,
    text: async () => body,
    json: async () => (body ? JSON.parse(body) : null),
    arrayBuffer: async () => {
      const buf = new ArrayBuffer(body.length);
      const view = new Uint8Array(buf);
      for (let i = 0; i < body.length; i++) view[i] = body.charCodeAt(i) & 0xff;
      return buf;
    },
    blob: async () => {
      throw new Error('blob() not supported on XHR-backed Response');
    },
    clone() { return resp; },
  };
  return resp as Response;
};

const xhrFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  return new Promise<Response>((resolve, reject) => {
    let url: string;
    let method = 'GET';
    let bodyToSend: BodyInit | null | undefined;
    let headers: Record<string, string> = {};

    if (input instanceof Request) {
      url = input.url;
      method = input.method || 'GET';
      input.headers.forEach((value, key) => { headers[key] = value; });
      bodyToSend = init?.body ?? (input as any)._bodyInit ?? null;
    } else {
      url = typeof input === 'string' ? input : (input as URL).toString();
      method = (init?.method || 'GET').toUpperCase();
      if (init?.headers) {
        if (init.headers instanceof Headers) {
          init.headers.forEach((value, key) => { headers[key] = value; });
        } else if (Array.isArray(init.headers)) {
          init.headers.forEach(([k, v]) => { headers[k] = v; });
        } else {
          headers = { ...(init.headers as Record<string, string>) };
        }
      }
      bodyToSend = init?.body ?? null;
    }

    const xhr = new XMLHttpRequest();
    try {
      xhr.open(method, url, true);
    } catch (e) {
      reject(e);
      return;
    }
    // Apply caller headers verbatim. Don't add anything; supabase-js
    // already supplies apikey + Authorization on its own.
    Object.entries(headers).forEach(([k, v]) => {
      try { xhr.setRequestHeader(k, v); } catch { /* some browsers block forbidden headers */ }
    });
    xhr.responseType = ''; // string — never blob
    xhr.timeout = 25000;
    xhr.onload = () => resolve(makeXhrResponse(xhr));
    xhr.onerror = () => reject(new Error('Network request failed'));
    xhr.ontimeout = () => reject(new Error('Request timed out'));
    xhr.onabort = () => reject(new Error('Request aborted'));

    // Honour AbortController if the caller passed a signal.
    const signal = init?.signal as AbortSignal | undefined;
    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        reject(new Error('Request aborted'));
        return;
      }
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }

    try {
      if (bodyToSend == null) {
        xhr.send();
      } else if (typeof bodyToSend === 'string') {
        xhr.send(bodyToSend);
      } else {
        // FormData / Blob / ArrayBuffer — XHR can handle these natively
        // but we don't expect auth endpoints to use them.
        xhr.send(bodyToSend as any);
      }
    } catch (e) {
      reject(e);
    }
  });
};

const fetchWithTimeout: typeof fetch = (input, init) => {
  const url = typeof input === 'string'
    ? input
    : (input instanceof URL ? input.toString() : (input as Request).url || '');

  // Route /auth/v1/* through XHR to dodge the RN BlobModule bug. This is
  // the key fix: supabase-js's verifyOtp/setSession/_getUser/refresh
  // calls all hit /auth/v1/* and were failing with
  //   "Unable to resolve data for blob: <uuid>"
  // immediately after a successful OTP. XHR never touches BlobModule.
  if (url.includes('/auth/v1/')) {
    return xhrFetch(input as any, init);
  }

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
