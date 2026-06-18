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
    // Force Gregorian on Arabic locale — admin screens must never show Hijri.
    return d.toLocaleString(isRTL ? 'ar-SA-u-ca-gregory' : 'en-US', {
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
 * Full request date + time for client-facing cards, e.g.
 *   "الخميس، 18 يونيو 2026 — 11:30 ص"
 * Always Gregorian (Miladi); Latin digits even on Arabic locale (-nu-latn) so
 * dates read consistently with the rest of the customer UI.
 */
export function fmtRequestDateTime(
  v: string | number | Date | null | undefined,
  isRTL = false,
): string {
  if (v == null || v === '') return '';
  try {
    const d = v instanceof Date ? v : new Date(v);
    if (!Number.isFinite(d.getTime())) return '';
    const locale = isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB';
    const datePart = d.toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const timePart = d.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${datePart} — ${timePart}`;
  } catch {
    return String(v);
  }
}

/**
 * Client "My Requests" date format — EXACTLY:
 *   "١٨ يونيو، ٢٠٢٦ - ١١:٢٠ ص"
 * Arabic-Indic numerals, Arabic month name, Arabic AM/PM (ص/م), Gregorian
 * calendar, no weekday, no seconds, " - " between date and time. Assembled from
 * formatToParts so the comma + separator are exact regardless of locale data.
 * English locale falls back to a clean standard format.
 */
export function fmtMyRequestDate(
  v: string | number | Date | null | undefined,
  isRTL = false,
): string {
  if (v == null || v === '') return '';
  try {
    const d = v instanceof Date ? v : new Date(v);
    if (!Number.isFinite(d.getTime())) return '';
    const dtf = new Intl.DateTimeFormat(isRTL ? 'ar-SA' : 'en-GB', {
      calendar: 'gregory',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    if (!isRTL) return dtf.format(d);
    const parts = dtf.formatToParts(d);
    const get = (t: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === t)?.value ?? '';
    return `${get('day')} ${get('month')}، ${get('year')} - ${get('hour')}:${get('minute')} ${get('dayPeriod')}`;
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
