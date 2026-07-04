/**
 * estimate.ts — pure initial price-estimate engine for the request flow.
 *
 * Product framing: this is an honest STARTING ESTIMATE, not a guaranteed
 * market price. Technicians still submit their own offers on top; the
 * customer chooses. The engine is deliberately data-driven so numbers can be
 * tuned without code changes:
 *
 *   1. Remote config (platform_settings key `pricing_estimates_v1`) can
 *      override any issue's range and set a regional multiplier — see
 *      services/estimateService.ts.
 *   2. Fallback: the curated Saudi-market baselines in constants/repairData
 *      (per-issue priceRange / estimatedPrice).
 *
 * Pure and framework-free so it's unit-testable and reusable server-side
 * later (e.g. when a real market-data source plugs in).
 */
import { SPARE_PART_MULTIPLIERS, type SparePartQuality } from '../types/order';

export interface EstimateRange {
  /** Typical starting price in SAR. */
  typical: number;
  min: number;
  max: number;
}

/** Per-issue override coming from remote config. All fields optional. */
export interface IssueEstimateOverride {
  typical?: number;
  min?: number;
  max?: number;
}

export interface EstimateConfig {
  /** Keyed by issue id (e.g. 'screen', 'battery'). */
  issues?: Record<string, IssueEstimateOverride>;
  /** Regional price multipliers keyed by region code (e.g. 'RUH', 'EP'). */
  regionMultipliers?: Record<string, number>;
  /** Global tuning knob applied to everything (default 1). */
  globalMultiplier?: number;
}

export interface EstimateInput {
  /** Baseline from the issue catalog (repairData). */
  baseTypical: number;
  baseMin?: number;
  baseMax?: number;
  sparePartQuality?: SparePartQuality;
  /** Issue id, to look up remote overrides. */
  issueId?: string;
  /** Region code, to apply the regional multiplier when configured. */
  regionCode?: string | null;
  /** Remote config (already fetched); pass null/undefined to use baselines. */
  config?: EstimateConfig | null;
}

export interface EstimateResult extends EstimateRange {
  /** 'remote' when a remote override shaped the number, else 'baseline'. */
  source: 'remote' | 'baseline';
  /** False when there is no basis for a number (quote-on-inspection). */
  hasEstimate: boolean;
}

const round5 = (n: number) => Math.max(0, Math.round(n / 5) * 5);

const clampMultiplier = (raw: unknown, fallback = 1): number => {
  const n = typeof raw === 'number' ? raw : Number(raw);
  // Guard against config typos nuking prices: multipliers stay in [0.5, 2].
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(2, Math.max(0.5, n));
};

/**
 * Compute the customer-facing starting estimate. Returns hasEstimate=false
 * when there's no usable basis (e.g. "Other" issues priced at 0) — callers
 * show "quote on inspection" instead of a fake number.
 */
export function computeEstimate(input: EstimateInput): EstimateResult {
  const { config, issueId, regionCode } = input;

  const override =
    (issueId && config?.issues && config.issues[issueId]) || undefined;

  let typical = override?.typical ?? input.baseTypical ?? 0;
  let min = override?.min ?? input.baseMin ?? typical;
  let max = override?.max ?? input.baseMax ?? typical;
  const source: EstimateResult['source'] =
    override && (override.typical != null || override.min != null || override.max != null)
      ? 'remote'
      : 'baseline';

  if (!typical || typical <= 0) {
    return { typical: 0, min: 0, max: 0, source, hasEstimate: false };
  }

  // Spare-part tier scales the whole range (same convention as the invoice).
  const tier = input.sparePartQuality
    ? SPARE_PART_MULTIPLIERS[input.sparePartQuality] ?? 1
    : 1;

  // Region + global tuning from remote config, each clamped to sane bounds.
  const regional = regionCode
    ? clampMultiplier(config?.regionMultipliers?.[regionCode])
    : 1;
  const global = clampMultiplier(config?.globalMultiplier);
  const factor = tier * regional * global;

  typical = round5(typical * factor);
  min = round5((min > 0 ? min : typical) * factor);
  max = round5((max > 0 ? max : typical) * factor);
  // Keep the range coherent after rounding.
  min = Math.min(min, typical);
  max = Math.max(max, typical);

  return { typical, min, max, source, hasEstimate: true };
}

/**
 * Display copy for the estimate. Always frames it as a starting estimate —
 * never as a final or guaranteed price.
 */
export function formatEstimate(
  result: EstimateResult,
  lang: 'ar' | 'en' = 'ar'
): string {
  if (!result.hasEstimate) {
    return lang === 'ar' ? 'حسب الفحص' : 'Quote on inspection';
  }
  if (result.max > result.min) {
    return lang === 'ar'
      ? `تقديرياً من ${result.min} إلى ${result.max} ر.س`
      : `Est. ${result.min} – ${result.max} SAR`;
  }
  return lang === 'ar'
    ? `يبدأ تقديرياً من ${result.typical} ر.س`
    : `Est. from ${result.typical} SAR`;
}

/** Parse/validate a raw remote-config value into an EstimateConfig. */
export function parseEstimateConfig(raw: unknown): EstimateConfig | null {
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!obj || typeof obj !== 'object') return null;
    const cfg = obj as Record<string, any>;
    const out: EstimateConfig = {};
    if (cfg.issues && typeof cfg.issues === 'object') {
      const issues: Record<string, IssueEstimateOverride> = {};
      for (const [k, v] of Object.entries(cfg.issues)) {
        if (!v || typeof v !== 'object') continue;
        const o = v as Record<string, any>;
        const entry: IssueEstimateOverride = {};
        if (Number.isFinite(Number(o.typical)) && Number(o.typical) > 0)
          entry.typical = Number(o.typical);
        if (Number.isFinite(Number(o.min)) && Number(o.min) > 0) entry.min = Number(o.min);
        if (Number.isFinite(Number(o.max)) && Number(o.max) > 0) entry.max = Number(o.max);
        if (Object.keys(entry).length > 0) issues[k] = entry;
      }
      if (Object.keys(issues).length > 0) out.issues = issues;
    }
    if (cfg.regionMultipliers && typeof cfg.regionMultipliers === 'object') {
      const rm: Record<string, number> = {};
      for (const [k, v] of Object.entries(cfg.regionMultipliers)) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) rm[k] = n;
      }
      if (Object.keys(rm).length > 0) out.regionMultipliers = rm;
    }
    if (Number.isFinite(Number(cfg.globalMultiplier)) && Number(cfg.globalMultiplier) > 0) {
      out.globalMultiplier = Number(cfg.globalMultiplier);
    }
    return out;
  } catch {
    return null;
  }
}
