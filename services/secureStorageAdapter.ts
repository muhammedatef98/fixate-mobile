import * as SecureStore from 'expo-secure-store';

/**
 * Storage adapter for the Supabase auth client.
 *
 * Supabase serializes the whole session (access JWT + refresh token + user
 * profile) into one string. On real accounts that easily exceeds 2 KB, which
 * triggers the expo-secure-store warning:
 *
 *   "Value being stored in SecureStore is larger than 2048 bytes…"
 *
 * The warning is harmless today but expo-secure-store has announced that a
 * future SDK will throw instead. To stay safe we transparently chunk values
 * larger than the keychain-friendly limit and reassemble on read. Small
 * values still take exactly one SecureStore entry, so the common path is
 * unchanged.
 *
 * Backwards-compatible: if a legacy non-chunked value exists at `key` we
 * read it as-is and rewrite it through the chunking path on the next set.
 */

// Keep each individual chunk safely under SecureStore's 2 KB advisory limit.
// 1800 leaves headroom for any per-entry overhead the keychain imposes.
const MAX_CHUNK_SIZE = 1800;
const META_SUFFIX = '__meta';
const CHUNK_SUFFIX = '__chunk__';

const setOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

const metaKey = (key: string) => `${key}${META_SUFFIX}`;
const chunkKey = (key: string, i: number) => `${key}${CHUNK_SUFFIX}${i}`;

const safeDelete = (k: string) =>
  SecureStore.deleteItemAsync(k).catch(() => undefined);

const deleteAllChunks = async (key: string, count: number) => {
  const ops: Promise<void | undefined>[] = [];
  for (let i = 0; i < count; i++) ops.push(safeDelete(chunkKey(key, i)));
  ops.push(safeDelete(metaKey(key)));
  await Promise.all(ops);
};

interface ChunkMeta {
  v: 1;
  chunks: number;
}

const parseMeta = (raw: string | null): ChunkMeta | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.v === 1 &&
      typeof parsed.chunks === 'number' &&
      parsed.chunks > 0
    ) {
      return parsed as ChunkMeta;
    }
  } catch {
    // Not JSON / not our envelope — treat as missing.
  }
  return null;
};

export const secureStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    // Prefer the chunk envelope. If present, reassemble from the chunks.
    const metaRaw = await SecureStore.getItemAsync(metaKey(key));
    const meta = parseMeta(metaRaw);
    if (meta) {
      const parts: string[] = new Array(meta.chunks);
      for (let i = 0; i < meta.chunks; i++) {
        const part = await SecureStore.getItemAsync(chunkKey(key, i));
        if (part == null) {
          // Corrupt / partial write — drop the whole entry so Supabase
          // treats it as "no session" and re-authenticates cleanly.
          await deleteAllChunks(key, meta.chunks);
          return null;
        }
        parts[i] = part;
      }
      return parts.join('');
    }

    // Legacy / small-value path — read whatever's at the bare key.
    return SecureStore.getItemAsync(key);
  },

  setItem: async (key: string, value: string): Promise<void> => {
    // Always clear the legacy single-key slot so we never end up with both
    // a legacy value and a chunked envelope under the same logical key.
    await safeDelete(key);

    // Discover any prior chunk count so we can wipe stale chunks before
    // writing the new value (new write may have fewer chunks than the old).
    const previousMetaRaw = await SecureStore.getItemAsync(metaKey(key));
    const previousMeta = parseMeta(previousMetaRaw);

    if (value.length <= MAX_CHUNK_SIZE) {
      // Small enough to fit in a single entry — write it directly to the
      // bare key, and clear any previous chunk envelope so reads don't get
      // a stale combined value.
      if (previousMeta) await deleteAllChunks(key, previousMeta.chunks);
      else await safeDelete(metaKey(key));
      await SecureStore.setItemAsync(key, value, setOptions);
      return;
    }

    // Large value — chunk it. Clear any stale chunks first.
    if (previousMeta) await deleteAllChunks(key, previousMeta.chunks);

    const chunkCount = Math.ceil(value.length / MAX_CHUNK_SIZE);
    for (let i = 0; i < chunkCount; i++) {
      const slice = value.slice(i * MAX_CHUNK_SIZE, (i + 1) * MAX_CHUNK_SIZE);
      await SecureStore.setItemAsync(chunkKey(key, i), slice, setOptions);
    }
    const meta: ChunkMeta = { v: 1, chunks: chunkCount };
    await SecureStore.setItemAsync(metaKey(key), JSON.stringify(meta), setOptions);
  },

  removeItem: async (key: string): Promise<void> => {
    const metaRaw = await SecureStore.getItemAsync(metaKey(key));
    const meta = parseMeta(metaRaw);
    if (meta) await deleteAllChunks(key, meta.chunks);
    await safeDelete(key);
  },
};
