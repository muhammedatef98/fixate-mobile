/**
 * Leaked-password check against the HaveIBeenPwned range API using
 * k-anonymity: only the first 5 hex chars of the SHA-1 hash ever leave the
 * device — the password itself is never sent anywhere. This replicates
 * Supabase's paid "leaked password protection" for free, client-side.
 *
 * Fails open: any network / API problem returns 0 so signup is never
 * blocked by connectivity issues.
 */

/* Pure-JS SHA-1 — React Native has no crypto.subtle and expo-crypto would
 * add a native module for what 40 lines cover. SHA-1 is fine here: HIBP's
 * dataset is keyed by SHA-1; this is lookup hashing, not password storage. */
export const sha1Hex = (message: string): string => {
  const utf8 = unescape(encodeURIComponent(message));
  const words: number[] = [];
  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] = (words[i >> 2] ?? 0) | (utf8.charCodeAt(i) << (24 - (i % 4) * 8));
  }
  const bitLen = utf8.length * 8;
  words[bitLen >> 5] = (words[bitLen >> 5] ?? 0) | (0x80 << (24 - (bitLen % 32)));
  words[(((bitLen + 64) >> 9) << 4) + 15] = bitLen;
  for (let i = 0; i < words.length; i++) words[i] = words[i] ?? 0;

  const rotl = (n: number, b: number) => (n << b) | (n >>> (32 - b));
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const w = new Array<number>(80);

  for (let i = 0; i < words.length; i += 16) {
    for (let t = 0; t < 80; t++) {
      w[t] = t < 16
        ? (words[i + t] ?? 0)
        : rotl(w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16], 1);
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let t = 0; t < 80; t++) {
      const f = t < 20 ? (b & c) | (~b & d)
        : t < 40 ? b ^ c ^ d
        : t < 60 ? (b & c) | (b & d) | (c & d)
        : b ^ c ^ d;
      const k = t < 20 ? 0x5a827999 : t < 40 ? 0x6ed9eba1 : t < 60 ? 0x8f1bbcdc : 0xca62c1d6;
      const temp = (rotl(a, 5) + f + e + k + w[t]) | 0;
      e = d; d = c; c = rotl(b, 30); b = a; a = temp;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
  }

  return [h0, h1, h2, h3, h4]
    .map((h) => (h >>> 0).toString(16).padStart(8, '0'))
    .join('');
};

const HIBP_TIMEOUT_MS = 3000;

/** Times a password appeared in known breaches; 0 = clean or check unavailable. */
export const pwnedCount = async (password: string): Promise<number> => {
  try {
    const hash = sha1Hex(password).toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HIBP_TIMEOUT_MS);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      signal: controller.signal,
      headers: { 'Add-Padding': 'true' },
    });
    clearTimeout(timer);
    if (!res.ok) return 0;

    const body = await res.text();
    for (const line of body.split('\n')) {
      const [lineSuffix, count] = line.trim().split(':');
      if (lineSuffix === suffix) return parseInt(count, 10) || 0;
    }
    return 0;
  } catch {
    return 0; // fail open — never block auth on connectivity
  }
};
