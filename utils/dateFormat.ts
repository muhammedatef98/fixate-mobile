/**
 * dateFormat.ts — shared date formatting utilities.
 */

/**
 * Format a date string for admin screens.
 * Returns a localised short date + time string.
 */
export function fmtAdminDate(iso: string, isRTL = false): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString(isRTL ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/**
 * Format a date string for general display.
 */
export function fmtDate(iso: string, isRTL = false): string {
  return fmtAdminDate(iso, isRTL);
}

/**
 * Format a date+time string for admin screens.
 * Forces the Gregorian calendar on Arabic locale (admin ops shouldn't see Hijri).
 */
export function fmtAdminDateTime(
  v: string | number | Date | null | undefined,
  isRTL = false,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (v == null || v === '') return '—';
  try {
    const d = v instanceof Date ? v : new Date(v);
    if (!Number.isFinite(d.getTime())) return '—';
    const locale = isRTL ? 'ar-SA-u-ca-gregory' : 'en-GB';
    return d.toLocaleString(locale, opts ?? {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(v);
  }
}

/**
 * Format a number for admin screens (counts, money). Arabic locale uses
 * Arabic-Indic digits via 'ar-EG'.
 */
export function fmtAdminNumber(
  n: number | string | null | undefined,
  isRTL = false,
  opts?: Intl.NumberFormatOptions,
): string {
  const num = Number(n ?? 0);
  if (!Number.isFinite(num)) return '0';
  const locale = isRTL ? 'ar-EG' : 'en-US';
  return num.toLocaleString(locale, opts);
}
