import { sha1Hex, pwnedCount } from '../utils/pwnedPassword';

describe('sha1Hex', () => {
  // FIPS 180-1 / well-known vectors
  it('hashes known vectors correctly', () => {
    expect(sha1Hex('abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    expect(sha1Hex('')).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
    expect(sha1Hex('password')).toBe('5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8');
    expect(sha1Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '84983e441c3bd26ebaae4aa1f95129e5e54670f1'
    );
  });

  it('handles multi-byte utf-8 (Arabic)', () => {
    // python3: hashlib.sha1('كلمة'.encode()).hexdigest()
    expect(sha1Hex('كلمة')).toHaveLength(40);
    expect(sha1Hex('كلمة')).not.toBe(sha1Hex('كلمه'));
  });
});

describe('pwnedCount', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('returns the breach count when the hash suffix matches', async () => {
    // sha1('password') = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
    const suffix = '1E4C9B93F3F0682250B6CF8331B7EE68FD8';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => `AAAA:1\n${suffix}:42\nBBBB:3`,
    }) as unknown as typeof fetch;

    await expect(pwnedCount('password')).resolves.toBe(42);
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toBe('https://api.pwnedpasswords.com/range/5BAA6');
  });

  it('returns 0 for a clean password', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => 'AAAA:1\nBBBB:3',
    }) as unknown as typeof fetch;

    await expect(pwnedCount('S0me-Very-Un1que-Pass!')).resolves.toBe(0);
  });

  it('fails open on network errors', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    await expect(pwnedCount('password')).resolves.toBe(0);
  });

  it('fails open on non-200 responses', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    await expect(pwnedCount('password')).resolves.toBe(0);
  });
});
