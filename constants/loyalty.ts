// Loyalty points configuration.
//
// Config-driven so the earn rate and redeem tiers can later be controlled by
// an admin/backend without an app release. `services/loyaltyService.ts`
// applies these defaults and will prefer a remote config row if one exists.

export interface RedeemTier {
  id: string;
  points: number;
  /** What the customer can redeem the points for. */
  category: 'accessory' | 'repair';
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  /** Indicative monetary value in SAR (used for display only for now). */
  valueSAR: number;
}

export interface LoyaltyConfig {
  /** Points earned per 1 SAR spent. */
  pointsPerSAR: number;
  tiers: RedeemTier[];
}

export const LOYALTY_CONFIG: LoyaltyConfig = {
  pointsPerSAR: 1,
  tiers: [
    {
      id: 'tier_500',
      points: 500,
      category: 'accessory',
      titleAr: 'خصم على إكسسوار صغير',
      titleEn: 'Small accessory discount',
      descAr: 'استبدل نقاطك بخصم على إكسسوار صغير',
      descEn: 'Redeem points for a discount on a small accessory',
      valueSAR: 15,
    },
    {
      id: 'tier_1000',
      points: 1000,
      category: 'repair',
      titleAr: 'إكسسوار أكبر أو خصم إصلاح',
      titleEn: 'Larger accessory or repair discount',
      descAr: 'خصم أكبر على إكسسوار أو على فاتورة الإصلاح',
      descEn: 'A larger accessory or a discount on a repair invoice',
      valueSAR: 35,
    },
    {
      id: 'tier_2000',
      points: 2000,
      category: 'repair',
      titleAr: 'مكافأة مميزة أو خصم إصلاح كبير',
      titleEn: 'Premium reward or large repair discount',
      descAr: 'مكافأة مميزة أو خصم كبير على فاتورة إصلاح',
      descEn: 'A premium reward or a large repair-invoice discount',
      valueSAR: 80,
    },
  ],
};

/** Points earned for a given amount spent (SAR). */
export const pointsForSpend = (amountSAR: number): number =>
  Math.max(0, Math.floor((amountSAR || 0) * LOYALTY_CONFIG.pointsPerSAR));

/** Highest tier the customer can currently afford with `balance`. */
export const highestAffordableTier = (balance: number): RedeemTier | null => {
  const affordable = LOYALTY_CONFIG.tiers
    .filter((t) => balance >= t.points)
    .sort((a, b) => b.points - a.points);
  return affordable[0] ?? null;
};
