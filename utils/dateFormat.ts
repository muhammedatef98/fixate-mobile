/**
 * dateFormat.ts — thin compatibility layer over lib/formatDate.ts.
 *
 * All date formatting now flows through the single canonical formatter so the
 * whole app shows ONE Gregorian format (never Hijri). These wrappers exist only
 * to keep existing call sites working; new code should import from
 * `lib/formatDate` directly.
 */
import {
  formatAppDate,
  formatAppDateOnly,
} from '../lib/formatDate';

type DateInput = string | number | Date | null | undefined;

/** @deprecated use formatAppDate */
export function fmtAdminDate(iso: string, isRTL = false): string {
  return formatAppDate(iso, isRTL);
}

/** @deprecated use formatAppDate */
export function fmtDate(iso: string, isRTL = false): string {
  return formatAppDate(iso, isRTL);
}

/** @deprecated use formatAppDate. `opts` is ignored — format is fixed app-wide. */
export function fmtAdminDateTime(
  v: DateInput,
  isRTL = false,
  _opts?: Intl.DateTimeFormatOptions,
): string {
  return formatAppDate(v, isRTL) || '—';
}

/** @deprecated use formatAppDate */
export function fmtRequestDateTime(v: DateInput, isRTL = false): string {
  return formatAppDate(v, isRTL);
}

/** @deprecated use formatAppDate */
export function fmtMyRequestDate(v: DateInput, isRTL = false): string {
  return formatAppDate(v, isRTL);
}

/** Date only, no time. @deprecated use formatAppDateOnly */
export function fmtDateOnly(iso: DateInput, isRTL = false): string {
  return formatAppDateOnly(iso, isRTL);
}

/**
 * Format a number for admin screens (counts, money). NOT a date — digits are
 * always Latin (en-US), in both languages.
 */
export function fmtAdminNumber(
  n: number | string | null | undefined,
  isRTL = false,
  opts?: Intl.NumberFormatOptions,
): string {
  const num = Number(n ?? 0);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString('en-US', opts);
}
