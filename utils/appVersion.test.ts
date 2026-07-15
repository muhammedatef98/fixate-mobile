import { compareVersions, isUpdateRequired } from './appVersion';

describe('compareVersions', () => {
  it('orders by numeric segment', () => {
    expect(compareVersions('1.2.0', '1.10.0')).toBe(-1);
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
    expect(compareVersions('1.2.0', '1.2.0')).toBe(0);
  });
  it('treats missing segments as zero', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('1.2.1', '1.2')).toBe(1);
  });
});

describe('isUpdateRequired', () => {
  it('blocks builds older than the floor', () => {
    expect(isUpdateRequired('1.3.0', '1.2.0')).toBe(true);
  });
  it('allows equal or newer builds', () => {
    expect(isUpdateRequired('1.2.0', '1.2.0')).toBe(false);
    expect(isUpdateRequired('1.2.0', '1.5.0')).toBe(false);
  });
  it('fails open on blank floor or unknown current version', () => {
    expect(isUpdateRequired('', '1.0.0')).toBe(false);
    expect(isUpdateRequired('9.9.9', '')).toBe(false);
  });
});
