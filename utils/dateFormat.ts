/**
 * Locale-aware date/number formatting for admin screens.
 * Arabic uses Western digits with the ar-SA calendar disabled so figures
 * stay comparable across the dashboard.
 */
const locale = (isRTL: boolean) => (isRTL ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-US');

const toDate = (v: string | number | Date | null | undefined): Date | null => {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

export function fmtAdminDate(v: string | number | Date | null | undefined, isRTL: boolean): string {
  const d = toDate(v);
  if (!d) return '—';
  return d.toLocaleDateString(locale(isRTL), { year: 'numeric', month: 'short', day: 'numeric' });
}

export function fmtAdminDateTime(v: string | number | Date | null | undefined, isRTL: boolean): string {
  const d = toDate(v);
  if (!d) return '—';
  return d.toLocaleString(locale(isRTL), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fmtAdminNumber(n: unknown, isRTL: boolean): string {
  const num = Number(n);
  if (n === null || n === undefined || n === '' || Number.isNaN(num)) return '—';
  return num.toLocaleString(locale(isRTL));
}
