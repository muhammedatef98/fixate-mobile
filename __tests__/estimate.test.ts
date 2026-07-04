import {
  computeEstimate,
  formatEstimate,
  parseEstimateConfig,
} from '../utils/estimate';

describe('computeEstimate', () => {
  it('uses baseline issue pricing when no remote config is present', () => {
    const res = computeEstimate({
      baseTypical: 280,
      baseMin: 200,
      baseMax: 1100,
      issueId: 'screen',
      config: null,
    });
    expect(res.hasEstimate).toBe(true);
    expect(res.source).toBe('baseline');
    expect(res.typical).toBe(280);
    expect(res.min).toBe(200);
    expect(res.max).toBe(1100);
  });

  it('returns no-estimate for a zero baseline (quote on inspection)', () => {
    const res = computeEstimate({ baseTypical: 0, issueId: 'other', config: null });
    expect(res.hasEstimate).toBe(false);
    expect(formatEstimate(res, 'en')).toBe('Quote on inspection');
    expect(formatEstimate(res, 'ar')).toBe('حسب الفحص');
  });

  it('applies the spare-part tier multiplier to the whole range', () => {
    const res = computeEstimate({
      baseTypical: 280,
      baseMin: 200,
      baseMax: 1100,
      sparePartQuality: 'economy', // 0.55x
      config: null,
    });
    expect(res.typical).toBe(155); // 280 * 0.55 = 154 → rounded to nearest 5
    expect(res.min).toBeLessThanOrEqual(res.typical);
    expect(res.max).toBeGreaterThanOrEqual(res.typical);
  });

  it('prefers a remote per-issue override and reports the remote source', () => {
    const res = computeEstimate({
      baseTypical: 280,
      baseMin: 200,
      baseMax: 1100,
      issueId: 'screen',
      config: { issues: { screen: { typical: 320, min: 250, max: 1200 } } },
    });
    expect(res.source).toBe('remote');
    expect(res.typical).toBe(320);
    expect(res.min).toBe(250);
    expect(res.max).toBe(1200);
  });

  it('applies regional and global multipliers with sane clamping', () => {
    const res = computeEstimate({
      baseTypical: 200,
      issueId: 'battery',
      regionCode: 'EP',
      config: { regionMultipliers: { EP: 1.1 }, globalMultiplier: 1 },
    });
    expect(res.typical).toBe(220);

    // A typo'd multiplier (e.g. 100) is clamped to 2x, never a 100x price.
    const clamped = computeEstimate({
      baseTypical: 200,
      issueId: 'battery',
      regionCode: 'EP',
      config: { regionMultipliers: { EP: 100 } },
    });
    expect(clamped.typical).toBe(400);
  });

  it('keeps the range coherent (min <= typical <= max) after rounding', () => {
    const res = computeEstimate({
      baseTypical: 130,
      baseMin: 100,
      baseMax: 220,
      sparePartQuality: 'high_quality',
      config: null,
    });
    expect(res.min).toBeLessThanOrEqual(res.typical);
    expect(res.max).toBeGreaterThanOrEqual(res.typical);
  });
});

describe('formatEstimate', () => {
  it('always frames the number as an estimate, never a final price', () => {
    const range = computeEstimate({
      baseTypical: 280,
      baseMin: 200,
      baseMax: 1100,
      config: null,
    });
    expect(formatEstimate(range, 'en')).toBe('Est. 200 – 1100 SAR');
    expect(formatEstimate(range, 'ar')).toContain('تقديري');

    const point = computeEstimate({ baseTypical: 300, config: null });
    expect(formatEstimate(point, 'en')).toBe('Est. from 300 SAR');
  });
});

describe('parseEstimateConfig', () => {
  it('accepts a valid object (or JSON string) and strips junk', () => {
    const cfg = parseEstimateConfig({
      issues: { screen: { typical: 300, min: -5, max: 'abc' }, junk: 'nope' },
      regionMultipliers: { RUH: 1.05, BAD: 'x' },
      globalMultiplier: 1.1,
    });
    expect(cfg).toEqual({
      issues: { screen: { typical: 300 } },
      regionMultipliers: { RUH: 1.05 },
      globalMultiplier: 1.1,
    });

    const fromString = parseEstimateConfig('{"globalMultiplier": 0.9}');
    expect(fromString?.globalMultiplier).toBe(0.9);
  });

  it('returns null for malformed input (safe fallback to baselines)', () => {
    expect(parseEstimateConfig('not-json')).toBeNull();
    expect(parseEstimateConfig(42)).toBeNull();
    expect(parseEstimateConfig(null)).toBeNull();
  });
});
