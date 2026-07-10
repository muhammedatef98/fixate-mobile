/**
 * pricingMatch.ts — pure repair-price rule matching, framework/DB-free so it
 * can be unit-tested and shared. See services/pricingRegistryService.ts.
 */
export interface RepairPriceContext {
  deviceType?: string | null;
  brand?: string | null;
  model?: string | null;
  category?: string | null;
  repairType?: string | null;
}

export interface MatchableRule {
  device_type: string | null;
  brand: string | null;
  model: string | null;
  category: string | null;
  repair_type: string | null;
  price: number;
}

const RULE_FIELDS: [keyof MatchableRule, keyof RepairPriceContext][] = [
  ['device_type', 'deviceType'],
  ['brand', 'brand'],
  ['model', 'model'],
  ['category', 'category'],
  ['repair_type', 'repairType'],
];

/**
 * A rule applies only when every non-null match column equals the context;
 * among applicable rules the one matching the most columns wins. Returns null
 * when none apply (caller then keeps its baseline pricing).
 */
export const pickBestRulePrice = (
  rules: MatchableRule[],
  ctx: RepairPriceContext
): number | null => {
  let best: { score: number; price: number } | null = null;
  for (const rule of rules) {
    let score = 0;
    let ok = true;
    for (const [rk, ck] of RULE_FIELDS) {
      const rv = rule[rk];
      if (rv == null) continue; // wildcard
      const cv = ctx[ck];
      if (cv != null && String(rv) === String(cv)) score += 1;
      else {
        ok = false;
        break;
      }
    }
    if (ok && (best == null || score > best.score)) {
      best = { score, price: Number(rule.price) };
    }
  }
  return best ? best.price : null;
};
