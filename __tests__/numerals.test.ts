/**
 * The app shows Latin digits (0-9) EVERYWHERE, in both languages — never
 * Arabic-Indic (٠-٩). This is easy to regress: any `toLocaleString('ar-SA')`
 * or a plain 'ar-SA' Intl locale silently reintroduces them.
 */
import { formatAppDate, formatAppDateOnly, formatAppTimeOnly } from '../lib/formatDate';
import { fmtAdminNumber } from '../utils/dateFormat';

const ARABIC_INDIC = /[٠-٩۰-۹]/;

// 18 June 2026, 11:20 local time.
const SAMPLE = new Date(2026, 5, 18, 11, 20);

describe('digits are always Latin', () => {
  test.each([true, false])('formatAppDate — isRTL=%s', (isRTL) => {
    const out = formatAppDate(SAMPLE, isRTL);
    expect(out).not.toMatch(ARABIC_INDIC);
    expect(out).toContain('18');
    expect(out).toContain('2026');
  });

  test.each([true, false])('formatAppDateOnly / formatAppTimeOnly — isRTL=%s', (isRTL) => {
    expect(formatAppDateOnly(SAMPLE, isRTL)).not.toMatch(ARABIC_INDIC);
    expect(formatAppTimeOnly(SAMPLE, isRTL)).not.toMatch(ARABIC_INDIC);
  });

  test('Arabic dates stay Gregorian (Miladi), never Hijri', () => {
    // A Hijri rendering of this date would land in 1447/1448, not 2026.
    expect(formatAppDateOnly(SAMPLE, true)).toContain('2026');
  });

  test.each([true, false])('fmtAdminNumber — isRTL=%s', (isRTL) => {
    const out = fmtAdminNumber(1234567, isRTL);
    expect(out).not.toMatch(ARABIC_INDIC);
    expect(out).toBe('1,234,567');
  });
});
