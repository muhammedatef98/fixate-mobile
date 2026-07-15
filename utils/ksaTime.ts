/**
 * KSA-fixed time helpers for admin scheduling.
 *
 * The app serves Saudi Arabia, so when an admin picks "09:30" for a scheduled
 * push they mean 09:30 *Riyadh time* — not the timezone their own device
 * happens to be on. Interpreting the picked wall-clock in device-local time
 * (the JS default for a bare `new Date("...T09:30")`) would fire the push at
 * the wrong Saudi hour whenever the admin's device isn't on KSA time.
 *
 * Asia/Riyadh is a fixed UTC+3 with no daylight saving (and none planned), so
 * we can pin the offset directly instead of pulling in a timezone library.
 * ponytail: fixed +03:00 offset — swap to a tz lib only if KSA ever adopts DST.
 */

export const KSA_UTC_OFFSET = '+03:00';

/**
 * Convert a KSA wall-clock date + time into a UTC ISO string for storage.
 * `dateStr` is "YYYY-MM-DD", `timeStr` is "H:MM" or "HH:MM". Returns null on
 * malformed input so callers can reject it.
 */
export const ksaDateTimeToIso = (dateStr: string, timeStr: string): string | null => {
  const d = dateStr.trim();
  const t = (timeStr.trim() || '09:00');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  if (!/^\d{1,2}:\d{2}$/.test(t)) return null;
  const dt = new Date(`${d}T${t.padStart(5, '0')}:00${KSA_UTC_OFFSET}`);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
};

/** Today's date as "YYYY-MM-DD" in Riyadh (independent of the device zone). */
export const ksaTodayDateString = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

/**
 * Format a stored UTC ISO timestamp back into Riyadh local time for display,
 * so what the admin sees matches when the push actually fires. Latin digits,
 * 12-hour clock. Returns "—" on bad input.
 */
export const fmtKsaDateTime = (iso: string | null | undefined, isRTL = false): string => {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '—';
  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(dt);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(dt);
  const suffix = isRTL ? ' (توقيت السعودية)' : ' (KSA)';
  return `${date} · ${time}${suffix}`;
};
