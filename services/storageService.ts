import { supabase } from './supabaseClient';
import { decode } from 'base64-arraybuffer';
// expo-file-system v19 routed the readAsStringAsync export through a
// deprecation warning that runs on every call. Importing from the
// `/legacy` path gets the same function without the deprecation noise.
// (The new File class API is overkill here — we just need bytes for upload.)
import { readAsStringAsync } from 'expo-file-system/legacy';
import { logger } from '../utils/logger';

const ORDERS_BUCKET = 'orders';

const guessContentType = (uri: string): string => {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  if (lower.endsWith('.mp4') || lower.endsWith('.mov')) return 'video/mp4';
  return 'image/jpeg';
};

const guessExt = (uri: string, contentType: string): string => {
  const m = /\.([a-zA-Z0-9]+)(?:\?|$)/.exec(uri);
  if (m) return m[1].toLowerCase();
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType.startsWith('video/')) return 'mp4';
  return 'jpg';
};

const withTimeout = <T>(p: PromiseLike<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);

export const uploadOrderMedia = async (
  userId: string,
  localUris: string[],
  folderHint?: string
): Promise<string[]> => {
  if (!localUris.length) return [];

  const folder = folderHint || `${userId}/${Date.now()}`;
  const urls: string[] = [];

  for (let i = 0; i < localUris.length; i++) {
    const uri = localUris[i];
    try {
      const contentType = guessContentType(uri);
      const ext = guessExt(uri, contentType);
      const path = `${folder}/${i}-${Date.now()}.${ext}`;

      const base64 = await withTimeout(
        readAsStringAsync(uri, { encoding: 'base64' }),
        15000,
        `Read ${uri}`
      );
      const fileBytes = decode(base64);

      const { error } = await withTimeout(
        supabase.storage.from(ORDERS_BUCKET).upload(path, fileBytes, { contentType, upsert: false }),
        20000,
        `Upload ${path}`
      );
      if (error) throw error;

      const { data: pub } = supabase.storage.from(ORDERS_BUCKET).getPublicUrl(path);
      if (pub?.publicUrl) urls.push(pub.publicUrl);
    } catch (err) {
      // Don't silently swallow — bubble up so the submit handler shows the user
      logger.error(`uploadOrderMedia failed for ${uri}`, err);
      throw err;
    }
  }

  return urls;
};
