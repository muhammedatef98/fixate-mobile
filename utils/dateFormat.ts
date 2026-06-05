/**
 * Date/number formatting helpers that force the Gregorian calendar even
 * when the app language is Arabic.
 *
 * The native `ar-SA` locale defaults to the Hijri (Umm al-Qura) calendar
 * on iOS, which surfaces dates like `١٤٤٦/٠٤/١٥` instead of the expected
 * Gregorian equivalent. For operational admin/staff screens this caused
 * confusion — admins need Gregorian dates regardless of the UI language.
 *
 * The fix is to use the BCP-47 calendar extension `u-ca-gregory` on the
 * Arabic locale. This keeps Arabic-Indic digits and RTL formatting while
 * forcing the underlying calendar to Gregorian.
 *
 *   new Date().toLocaleDateString('ar-SA-u-ca-gregory')
 *
 * Number formatting (toLocaleString for counts/money) is unaffected by
 * calendar choice but we export a paired helper so callers can use one
 * import for everything operational.
 */

/** Locale string used for *date* formatting when isRTL. Forces Gregorian. */
export const ADMIN_DATE_LOCALE_AR = 'ar-SA-u-ca-gregory';
/** Locale string for English admin dates. */
export const ADMIN_DATE_LOCALE_EN = 'en-GB';
/** Locale string used for *number* formatting. */
export const ADMIN_NUMBER_LOCALE_AR = 'ar-EG';
export const ADMIN_NUMBER_LOCALE_EN = 'en-US';

export function fmtAdminDate(
  v: string | number | Date | null | undefined,
  isRTL: boolean,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (v == null || v === '') return '—';
  const d = v instanceof Date ? v : new Date(v);
  if (!Number.isFinite(d.getTime())) return '—';
  const locale = isRTL ? ADMIN_DATE_LOCALE_AR : ADMIN_DATE_LOCALE_EN;
  return d.toLocaleDateString(locale, opts);
}

export function fmtAdminDateTime(
  v: string | number | Date | null | undefined,
  isRTL: boolean,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (v == null || v === '') return '—';
  const d = v instanceof Date ? v : new Date(v);
  if (!Number.isFinite(d.getTime())) return '—';
  const locale = isRTL ? ADMIN_DATE_LOCALE_AR : ADMIN_DATE_LOCALE_EN;
  return d.toLocaleString(locale, opts);
}

export function fmtAdminNumber(
  n: number | string | null | undefined,
  isRTL: boolean,
  opts?: Intl.NumberFormatOptions,
): string {
  const num = Number(n ?? 0);
  if (!Number.isFinite(num)) return '0';
  const locale = isRTL ? ADMIN_NUMBER_LOCALE_AR : ADMIN_NUMBER_LOCALE_EN;
  return num.toLocaleString(locale, opts);
}
