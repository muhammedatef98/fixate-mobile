import { supabase } from '../services/supabaseClient';

// Default bucket for inputs that are bare paths with no recognisable bucket
// segment. Real data may live in either `order-media` (current) or `orders`
// (legacy rows still around), so the helper extracts the bucket from the
// URL whenever it can and only falls back to the default when truly given
// just a relative path.
const DEFAULT_BUCKET = 'order-media';
const KNOWN_BUCKETS = new Set(['order-media', 'orders']);

// Matches `/storage/v1/object/(public|sign|authenticated)/<bucket>/<path>`
const STORAGE_URL_RE =
  /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+?)(?:\?|$)/;

interface Parsed {
  bucket: string;
  path: string;
}

function parseStorageRef(u: string): Parsed {
  const m = u.match(STORAGE_URL_RE);
  if (m) {
    return { bucket: decodeURIComponent(m[1]), path: decodeURIComponent(m[2]) };
  }
  // Bare path. If it starts with a known bucket name, peel it off.
  if (!u.startsWith('http')) {
    const slash = u.indexOf('/');
    if (slash > 0) {
      const maybeBucket = u.slice(0, slash);
      if (KNOWN_BUCKETS.has(maybeBucket)) {
        return { bucket: maybeBucket, path: u.slice(slash + 1) };
      }
    }
  }
  return { bucket: DEFAULT_BUCKET, path: u };
}

/**
 * Accepts an array of storage paths OR full Supabase storage URLs.
 * Returns signed URLs (1-hour expiry). Already-signed URLs (contain
 * `token=`) are returned as-is.
 *
 * Handles both the current `order-media` bucket and legacy `orders` URLs
 * by extracting the bucket from the URL itself rather than hard-coding it.
 * If signing fails on what was originally a `/public/` URL, the original
 * is returned so the image at least has a chance to render.
 */
export async function resolveStorageUrls(urls: string[]): Promise<string[]> {
  if (!urls || urls.length === 0) return [];
  return Promise.all(
    urls.map(async (u) => {
      if (!u) return u;
      if (u.includes('token=')) return u; // already signed

      const { bucket, path } = parseStorageRef(u);

      try {
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
        if (error || !data?.signedUrl) {
          // Original was a public URL — return verbatim so the <Image> can
          // still try to load it.
          if (/\/storage\/v1\/object\/public\//.test(u)) return u;
          if (__DEV__)
            console.warn('[resolveStorageUrls] failed to sign', {
              bucket,
              path,
              error: error?.message,
            });
          return u;
        }
        return data.signedUrl;
      } catch (e: unknown) {
        if (__DEV__)
          console.warn('[resolveStorageUrls] exception', {
            bucket,
            path,
            error: (e as Error)?.message,
          });
        return u;
      }
    })
  );
}
