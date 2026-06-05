import { supabase } from '../services/supabaseClient';

const BUCKET = 'order-media';

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
      // Extract relative path from full URL if needed
      const path = u.includes(`/${BUCKET}/`) ? u.split(`/${BUCKET}/`)[1] : u;
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
