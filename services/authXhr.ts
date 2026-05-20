// XHR-based hits against Supabase's `/auth/v1/*` endpoints.
//
// Same reason as services/edgeInvoke.ts: supabase-js's internal fetch
// path stages bodies/responses through React Native's BlobModule, and
// the blob URI it caches can be unresolvable after a context restart —
// producing "Unable to resolve data for blob: <uuid>" before the
// request ever reaches the server. XHR with responseType='' bypasses
// the Blob path entirely.
//
// Only the auth operations the app actually uses live here. Everything
// else continues to flow through the regular supabase client.

import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

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

interface VerifySessionResponse {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user?: any;
}

/**
 * Verifies an emailed-OTP / magic-link token_hash and establishes a
 * Supabase session — the same job as
 *   supabase.auth.verifyOtp({ type: 'magiclink', token_hash })
 * but routed via XHR so the RN Blob bug can't intercept it.
 *
 * On success, sets the session on the supabase client so the rest of
 * the app sees the user as logged in (RLS, .auth.getUser(), realtime).
 */
export const verifyMagicLinkOtp = async (
  token_hash: string,
  type: 'magiclink' | 'email' | 'recovery' | 'invite' = 'magiclink'
): Promise<{ user: any } | null> => {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    throw new Error('Missing Supabase env vars');
  }
  const url = `${SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/verify`;
  const res = await xhrPost(
    url,
    JSON.stringify({ type, token_hash }),
    {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
    },
    25000
  );

  let parsed: any = null;
  if (res.body) {
    try { parsed = JSON.parse(res.body); } catch { /* not JSON */ }
  }

  if (res.status < 200 || res.status >= 300) {
    const msg =
      parsed?.error_description ||
      parsed?.msg ||
      parsed?.error ||
      `${res.status}${res.statusText ? ` ${res.statusText}` : ''}`;
    logger.warn('auth/verify failed', msg);
    throw new Error(msg);
  }

  if (!parsed?.access_token || !parsed?.refresh_token) {
    throw new Error('No session returned');
  }
  const sessionResp = parsed as VerifySessionResponse;

  // Hand the fresh tokens to supabase-js. setSession is local-only when
  // the access_token is still valid — it just persists to AsyncStorage
  // and fires the auth state event. No network call inside it, so the
  // Blob bug can't reach us here.
  const { error } = await supabase.auth.setSession({
    access_token: sessionResp.access_token,
    refresh_token: sessionResp.refresh_token,
  });
  if (error) {
    logger.warn('setSession after XHR verify failed', error);
    throw error;
  }

  return { user: sessionResp.user };
};

/**
 * Email + password sign-in routed through XHR — same Blob-bug bypass.
 * Sets the session on the supabase client on success.
 */
export const signInWithPasswordXhr = async (
  email: string,
  password: string
): Promise<{ user: any }> => {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    throw new Error('Missing Supabase env vars');
  }
  const url = `${SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/token?grant_type=password`;
  const res = await xhrPost(
    url,
    JSON.stringify({ email, password }),
    {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
    },
    25000
  );
  let parsed: any = null;
  if (res.body) {
    try { parsed = JSON.parse(res.body); } catch { /* not JSON */ }
  }
  if (res.status < 200 || res.status >= 300) {
    const msg =
      parsed?.error_description ||
      parsed?.msg ||
      parsed?.error ||
      `${res.status}${res.statusText ? ` ${res.statusText}` : ''}`;
    throw new Error(msg);
  }
  if (!parsed?.access_token || !parsed?.refresh_token) {
    throw new Error('No session returned');
  }
  const { error } = await supabase.auth.setSession({
    access_token: parsed.access_token,
    refresh_token: parsed.refresh_token,
  });
  if (error) throw error;
  return { user: parsed.user };
};
