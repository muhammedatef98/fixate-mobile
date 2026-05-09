import { supabase } from './supabaseClient';
import { decode } from 'base64-arraybuffer';
// expo-file-system v19 routed the readAsStringAsync export through a
// deprecation warning that runs on every call. Importing from the
// `/legacy` path gets the same function without the deprecation noise.
import { readAsStringAsync } from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { logger } from '../utils/logger';

const ORDERS_BUCKET = 'orders';

const isImage = (uri: string) => /\.(jpe?g|png|webp|heic|heif)(\?.*)?$/i.test(uri);

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

/**
 * Compress a single image so the upload payload stays small.
 * - Resizes the longest edge to 1280 px (good detail for repair photos
 *   without uploading a 12 MP iPhone original).
 * - Re-encodes as JPEG at 0.6 quality (~70-80% size reduction vs source).
 * Typical iPhone shot (~3.5 MB) drops to ~250-400 KB.
 * Falls back to the original URI if compression fails.
 */
const compressImage = async (uri: string): Promise<string> => {
  if (!isImage(uri)) return uri;
  try {
    const result = await manipulateAsync(
      uri,
      [{ resize: { width: 1280 } }],
      { compress: 0.6, format: SaveFormat.JPEG }
    );
    return result.uri;
  } catch (e) {
    logger.warn('compressImage failed, using original', e);
    return uri;
  }
};

const uploadOne = async (
  folder: string,
  uri: string,
  index: number
): Promise<string | null> => {
  try {
    const compressedUri = await compressImage(uri);
    const contentType = guessContentType(compressedUri);
    const ext = guessExt(compressedUri, contentType);
    const path = `${folder}/${index}-${Date.now()}.${ext}`;

    const base64 = await withTimeout(
      readAsStringAsync(compressedUri, { encoding: 'base64' }),
      20000,
      `Read ${compressedUri}`
    );
    const fileBytes = decode(base64);

    const { error } = await withTimeout(
      supabase.storage.from(ORDERS_BUCKET).upload(path, fileBytes, { contentType, upsert: false }),
      85000,
      `Upload ${path}`
    );
    if (error) throw error;

    const { data: pub } = supabase.storage.from(ORDERS_BUCKET).getPublicUrl(path);
    return pub?.publicUrl ?? null;
  } catch (err) {
    logger.error(`uploadOrderMedia failed for ${uri}`, err);
    throw err;
  }
};

/**
 * Upload N photos in parallel. With 1280-px JPEG compression each photo
 * sits at ~250-400 KB, so even three at a time finish in a few seconds
 * instead of the per-photo 30-50s we used to see.
 */
export const uploadOrderMedia = async (
  userId: string,
  localUris: string[],
  folderHint?: string
): Promise<string[]> => {
  if (!localUris.length) return [];
  const folder = folderHint || `${userId}/${Date.now()}`;
  const results = await Promise.all(localUris.map((uri, i) => uploadOne(folder, uri, i)));
  return results.filter((u): u is string => !!u);
};
