import { supabase } from './supabaseClient';
import { decode } from 'base64-arraybuffer';
// expo-file-system v19 routed the readAsStringAsync export through a
// deprecation warning that runs on every call. Importing from the
// `/legacy` path gets the same function without the deprecation noise.
import { readAsStringAsync } from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { logger } from '../utils/logger';

const ORDERS_BUCKET = 'orders';
const AVATARS_BUCKET = 'avatars';
// Marketplace listing photos live in a dedicated public bucket so they
// can be served via getPublicUrl() without exposing the rest of the
// orders bucket (orders/%, chat-%) which stays private.
const MARKET_IMAGES_BUCKET = 'market-images';

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
 * - Resizes the longest edge to 1600 px — enough resolution that the
 *   marketplace detail page hero (full-screen on phones) still looks crisp,
 *   without uploading a 12 MP iPhone original.
 * - Re-encodes as JPEG at 0.82 quality. This is the *only* compression stage
 *   in the pipeline: callers must pick at quality: 1 so we don't stack two
 *   lossy JPEG passes (the earlier 0.7 picker + 0.6 manipulator combo was
 *   what made ad cards look washed out / over-blurred).
 * A typical iPhone shot still drops to ~400-700 KB.
 * Falls back to the original URI if compression fails.
 */
const compressImage = async (uri: string): Promise<string> => {
  if (!isImage(uri)) return uri;
  try {
    const result = await manipulateAsync(
      uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.82, format: SaveFormat.JPEG }
    );
    return result.uri;
  } catch (e) {
    logger.warn('compressImage failed, using original', e);
    return uri;
  }
};

const uploadOne = async (
  bucket: string,
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
      supabase.storage.from(bucket).upload(path, fileBytes, { contentType, upsert: false }),
      85000,
      `Upload ${path}`
    );
    if (error) throw error;

    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
    return pub?.publicUrl ?? null;
  } catch (err) {
    logger.error(`upload to ${bucket} failed for ${uri}`, err);
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
  // allSettled — one bad photo (corrupt file, transient network) must not
  // discard the photos that uploaded fine. Only a total failure throws.
  const settled = await Promise.allSettled(
    localUris.map((uri, i) => uploadOne(ORDERS_BUCKET, folder, uri, i))
  );
  const urls = settled
    .filter((r): r is PromiseFulfilledResult<string | null> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((u): u is string => !!u);
  if (urls.length === 0) {
    const firstError = settled.find((r) => r.status === 'rejected') as
      | PromiseRejectedResult
      | undefined;
    throw firstError?.reason instanceof Error
      ? firstError.reason
      : new Error('Image upload failed');
  }
  return urls;
};

/**
 * Upload marketplace listing photos to the dedicated public
 * `market-images` bucket. Storage RLS requires the first path segment
 * to be the uploader's user id; the bucket is public so getPublicUrl()
 * resolves to an anonymously-fetchable URL — which is what the listing
 * cards and detail hero use.
 */
export const uploadMarketMedia = async (
  userId: string,
  localUris: string[]
): Promise<string[]> => {
  if (!localUris.length) return [];
  const folder = `${userId}/${Date.now()}`;
  const settled = await Promise.allSettled(
    localUris.map((uri, i) => uploadOne(MARKET_IMAGES_BUCKET, folder, uri, i))
  );
  const urls = settled
    .filter((r): r is PromiseFulfilledResult<string | null> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((u): u is string => !!u);
  if (urls.length === 0) {
    const firstError = settled.find((r) => r.status === 'rejected') as
      | PromiseRejectedResult
      | undefined;
    throw firstError?.reason instanceof Error
      ? firstError.reason
      : new Error('Image upload failed');
  }
  return urls;
};

/**
 * Upload a profile photo to the public `avatars` bucket. The storage RLS
 * policy requires the first path segment to be the user's id. Returns the
 * public URL ready to store in users.avatar_url.
 */
export const uploadAvatar = async (
  userId: string,
  uri: string
): Promise<string> => {
  try {
    let workingUri = uri;
    try {
      const resized = await manipulateAsync(
        uri,
        [{ resize: { width: 512 } }],
        { compress: 0.7, format: SaveFormat.JPEG }
      );
      workingUri = resized.uri;
    } catch (e) {
      logger.warn('avatar resize failed, using original', e);
    }

    const path = `${userId}/avatar-${Date.now()}.jpg`;
    const base64 = await withTimeout(
      readAsStringAsync(workingUri, { encoding: 'base64' }),
      20000,
      'Read avatar'
    );
    const fileBytes = decode(base64);

    const { error } = await withTimeout(
      supabase.storage
        .from(AVATARS_BUCKET)
        .upload(path, fileBytes, { contentType: 'image/jpeg', upsert: true }),
      60000,
      'Upload avatar'
    );
    if (error) throw error;

    const { data: pub } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
    if (!pub?.publicUrl) throw new Error('Failed to resolve avatar URL');
    return pub.publicUrl;
  } catch (err) {
    logger.error('uploadAvatar failed', err);
    throw err;
  }
};
