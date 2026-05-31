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
  // allSettled — one bad photo (corrupt file, transient network) must not
  // discard the photos that uploaded fine. Only a total failure throws.
  const settled = await Promise.allSettled(
    localUris.map((uri, i) => uploadOne(folder, uri, i))
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
/**
 * D2 / B-5 prep: convert whatever is stored in orders.before_photos /
 * orders.after_photos / orders.media_urls (either a legacy public URL or a
 * raw storage path) into a short-lived signed URL that works regardless of
 * whether the `orders` bucket is currently public or private.
 *
 * Behaviour is intentionally permissive:
 *   - If the bucket is still public, signed URLs are still produced (Supabase
 *     allows signing on public buckets), so nothing visible to the user
 *     changes.
 *   - If `createSignedUrls` fails for any reason, we fall back to the
 *     original stored values so the rest of the app does not break.
 *   - If a stored value is an HTTP URL that does NOT point at the orders
 *     bucket (e.g. someone hand-pasted an external image URL), we leave it
 *     untouched and return it as-is.
 *
 * This makes the eventual private-bucket flip a no-op at the client level.
 */
const ORDERS_URL_PATH_RE =
  /\/storage\/v1\/object\/(?:public|sign)\/orders\/([^?]+)(?:\?.*)?$/i;

const extractOrdersPath = (value: string): string | null => {
  if (!value) return null;
  const match = ORDERS_URL_PATH_RE.exec(value);
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  // Anything that doesn't look like an absolute URL is treated as a path
  // already relative to the bucket.
  if (!/^https?:\/\//i.test(value)) return value;
  // Absolute URL that doesn't belong to our orders bucket — leave alone.
  return null;
};

export const resolveOrderMediaUrls = async (
  values: ReadonlyArray<string> | null | undefined
): Promise<string[]> => {
  if (!values || values.length === 0) return [];

  // Build a per-index "needs signing" map. Foreign URLs (e.g. picsum) keep
  // their value unchanged in the final array.
  const paths: (string | null)[] = values.map(extractOrdersPath);
  const signableIndices: number[] = [];
  const signablePaths: string[] = [];
  paths.forEach((p, i) => {
    if (p !== null) {
      signableIndices.push(i);
      signablePaths.push(p);
    }
  });

  if (signablePaths.length === 0) return [...values];

  try {
    const { data, error } = await supabase.storage
      .from(ORDERS_BUCKET)
      .createSignedUrls(signablePaths, 60 * 60);

    if (error || !data) {
      logger.warn('resolveOrderMediaUrls: createSignedUrls failed, falling back to stored values', error);
      return [...values];
    }

    const resolved: string[] = [...values];
    signableIndices.forEach((origIndex, i) => {
      const signed = data[i]?.signedUrl;
      if (signed) resolved[origIndex] = signed;
    });
    return resolved;
  } catch (e) {
    logger.warn('resolveOrderMediaUrls threw, falling back to stored values', e);
    return [...values];
  }
};

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
