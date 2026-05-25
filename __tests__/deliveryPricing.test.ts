import {
  computeDeliveryFee,
  feeForDistanceKm,
  haversineKm,
  DELIVERY_FEE_MAX_SAR,
  getCityCentroid,
} from '../utils/deliveryPricing';

describe('feeForDistanceKm', () => {
  it('uses the 10 SAR tier under 5km', () => {
    expect(feeForDistanceKm(0)).toBe(10);
    expect(feeForDistanceKm(4.9)).toBe(10);
  });
  it('uses the 20 SAR tier between 5 and 15km', () => {
    expect(feeForDistanceKm(5)).toBe(10); // boundary inclusive on lower side
    expect(feeForDistanceKm(5.1)).toBe(20);
    expect(feeForDistanceKm(15)).toBe(20);
  });
  it('uses the 30 SAR tier between 15 and 30km', () => {
    expect(feeForDistanceKm(15.5)).toBe(30);
    expect(feeForDistanceKm(30)).toBe(30);
  });
  it('caps at 40 SAR beyond 30km', () => {
    expect(feeForDistanceKm(31)).toBe(40);
    expect(feeForDistanceKm(1000)).toBe(40);
  });
  it('never exceeds the global cap', () => {
    expect(feeForDistanceKm(Number.POSITIVE_INFINITY)).toBeLessThanOrEqual(DELIVERY_FEE_MAX_SAR);
  });
});

describe('haversineKm', () => {
  it('measures Qatif → Dammam at ~17-19 km', () => {
    const d = haversineKm(
      { lat: 26.5650, lng: 50.0089 },
      { lat: 26.4207, lng: 50.0888 }
    );
    expect(d).toBeGreaterThan(15);
    expect(d).toBeLessThan(22);
  });
});

describe('computeDeliveryFee', () => {
  it('returns 0 when freeOverride (personal hand-off)', () => {
    const r = computeDeliveryFee({ freeOverride: true, flatFee: 25 });
    expect(r.fee).toBe(0);
    expect(r.source).toBe('free');
  });
  it('uses tier when both origin city and customer coords are known', () => {
    // Same point as Qatif centroid → ~0km → 10 SAR tier
    const r = computeDeliveryFee({
      cityNameEn: 'Al Qatif',
      customer: { lat: 26.565, lng: 50.0089 },
    });
    expect(r.source).toBe('distance');
    expect(r.fee).toBe(10);
  });
  it('falls back to flat fee when centroid unknown', () => {
    const r = computeDeliveryFee({
      cityNameEn: 'Unknown City',
      customer: { lat: 24.7, lng: 46.7 },
      flatFee: 25,
    });
    expect(r.source).toBe('flat');
    expect(r.fee).toBe(25);
  });
  it('caps the flat fallback at 40 SAR', () => {
    const r = computeDeliveryFee({ cityNameEn: 'Unknown', flatFee: 99 });
    expect(r.fee).toBe(40);
  });
  it('returns 0 with default source when nothing is known', () => {
    const r = computeDeliveryFee({});
    expect(r.fee).toBe(0);
    expect(r.source).toBe('default');
  });
});

describe('getCityCentroid', () => {
  it('finds by English name', () => {
    expect(getCityCentroid('Al Qatif', null)).toBeTruthy();
  });
  it('finds by Arabic alias', () => {
    expect(getCityCentroid(null, 'القطيف')).toBeTruthy();
  });
  it('returns null for unknown cities', () => {
    expect(getCityCentroid('Atlantis', 'أتلانتس')).toBeNull();
  });
});
