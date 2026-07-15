import { ksaDateTimeToIso } from './ksaTime';

describe('ksaDateTimeToIso', () => {
  it('interprets the wall-clock as Riyadh time (UTC+3), not device-local', () => {
    // 09:30 in Riyadh is 06:30 UTC, regardless of the machine running the test.
    expect(ksaDateTimeToIso('2026-07-15', '09:30')).toBe('2026-07-15T06:30:00.000Z');
  });
  it('handles a single-digit hour', () => {
    expect(ksaDateTimeToIso('2026-01-01', '9:05')).toBe('2026-01-01T06:05:00.000Z');
  });
  it('rejects malformed input', () => {
    expect(ksaDateTimeToIso('2026/07/15', '09:30')).toBeNull();
    expect(ksaDateTimeToIso('2026-07-15', 'noon')).toBeNull();
  });
});
