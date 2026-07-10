import { pickBestRulePrice, type MatchableRule } from '../utils/pricingMatch';

const rule = (over: Partial<MatchableRule>): MatchableRule => ({
  device_type: null,
  brand: null,
  model: null,
  category: null,
  repair_type: null,
  price: 0,
  ...over,
});

describe('pickBestRulePrice', () => {
  it('returns null when no rules apply', () => {
    expect(pickBestRulePrice([], { brand: 'Apple' })).toBeNull();
    expect(
      pickBestRulePrice([rule({ brand: 'Samsung', price: 100 })], { brand: 'Apple' })
    ).toBeNull();
  });

  it('matches a wildcard rule (all fields null)', () => {
    expect(pickBestRulePrice([rule({ price: 50 })], { brand: 'Apple' })).toBe(50);
  });

  it('prefers the most specific matching rule', () => {
    const rules = [
      rule({ brand: 'Apple', price: 200 }),
      rule({ brand: 'Apple', model: 'iPhone 15', price: 350 }),
      rule({ price: 100 }),
    ];
    expect(
      pickBestRulePrice(rules, { brand: 'Apple', model: 'iPhone 15', repairType: 'screen' })
    ).toBe(350);
  });

  it('excludes rules whose set field mismatches', () => {
    const rules = [rule({ brand: 'Apple', model: 'iPhone 14', price: 400 })];
    expect(pickBestRulePrice(rules, { brand: 'Apple', model: 'iPhone 15' })).toBeNull();
  });
});
