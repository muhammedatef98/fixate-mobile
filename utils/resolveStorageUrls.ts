import { supabase } from '../services/supabaseClient';

// Order photos (customer media, technician before/after, chat images) are
// uploaded by services/storageService.ts into the private `orders` bucket,
// which stores getPublicUrl() links. Those links 400 on a private bucket,
// so they must be exchanged for signed URLs before display.
const BUCKET = 'orders';
const OBJECT_PATH_RE = new RegExp(`/object/(?:public|sign|authenticated)/${BUCKET}/([^?]+)`);

/**
 * Accepts an array of storage paths OR full Supabase storage URLs.
 * Returns signed URLs (1-hour expiry).
 * Already-signed URLs (contain `token=`) are returned as-is.
 */
export async function resolveStorageUrls(urls: string[]): Promise<string[]> {
  if (!urls || urls.length === 0) return [];
  return Promise.all(
    urls.map(async (u) => {
      if (!u) return u;
      // Already signed — don't re-sign
      if (u.includes('token=')) return u;
      // Extract relative path from full URL if needed. Links to other buckets
      // (e.g. public market-images) are returned untouched.
      const match = u.match(OBJECT_PATH_RE);
      if (!match && /^https?:\/\//.test(u)) return u;
      const path = match ? decodeURIComponent(match[1]) : u;
      try {
        const { data, error } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, 3600);
        if (error || !data?.signedUrl) {
          console.warn('[resolveStorageUrls] failed to sign', path, error?.message);
          return u;
        }
        return data.signedUrl;
      } catch (e) {
        console.warn('[resolveStorageUrls] exception', e);
        return u;
      }
    })
  );
}
