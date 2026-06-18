/**
 * formatDate.ts — the single source of truth for date formatting across the app.
 *
 * THE RULE — one consistent format, Gregorian (Miladi) ONLY, never Hijri:
 *   Arabic : ١٨ يونيو، ٢٠٢٦ - ١١:٢٠ ص
 *   English: 18 June, 2026 - 11:20 AM
 *
 * - Arabic-Indic numerals on the Arabic locale, Latin on English.
 * - Full month name, Gregorian year, AM/PM suffix (ص / م on Arabic).
 * - Separator between date and time is " - ".
 * - No weekday, no seconds, no Hijri/Islamic calendar anywhere.
 *
 * Every screen MUST use formatAppDate / formatAppDateOnly / formatAppTimeOnly.
 * Do not hand-roll toLocale or Intl.DateTimeFormat for dates elsewhere.
 */

type DateInput = string | number | Date | null | undefined;

const toDate = (input: DateInput): Date | null => {
  if (input == null || input === '') return null;
  const date = input instanceof Date ? input : new Date(input);
  return Number.isFinite(date.getTime()) ? date : null;
};

// Arabic locale yields Arabic-Indic numerals + Arabic month names + ص/م.
// 'en-GB' keeps day-before-month ordering with Latin numerals.
//
// IMPORTANT: the Gregorian calendar is pinned via the Unicode locale extension
// '-u-ca-gregory', NOT only the { calendar } option. On React Native (Hermes)
// the { calendar } option is silently ignored, so 'ar-SA' falls back to its
// default Islamic (Hijri) calendar. The locale-extension form is honoured on
// device and is what keeps dates Gregorian (Miladi) everywhere.
const localeFor = (isRTL: boolean): string =>
  isRTL ? 'ar-SA-u-ca-gregory' : 'en-GB';

const partsFor = (
  date: Date,
  isRTL: boolean,
  options: Intl.DateTimeFormatOptions,
): Map<Intl.DateTimeFormatPartTypes, string> => {
  const dtf = new Intl.DateTimeFormat(localeFor(isRTL), {
    calendar: 'gregory',
    ...options,
  });
  const map = new Map<Intl.DateTimeFormatPartTypes, string>();
  for (const part of dtf.formatToParts(date)) map.set(part.type, part.value);
  return map;
};

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
};

const TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
};

/** "١٨ يونيو، ٢٠٢٦" / "18 June, 2026" */
const datePiece = (
  parts: Map<Intl.DateTimeFormatPartTypes, string>,
  isRTL: boolean,
): string => {
  const day = parts.get('day') ?? '';
  const month = parts.get('month') ?? '';
  const year = parts.get('year') ?? '';
  const comma = isRTL ? '،' : ',';
  return `${day} ${month}${comma} ${year}`;
};

/** "١١:٢٠ ص" / "11:20 AM" */
const timePiece = (
  parts: Map<Intl.DateTimeFormatPartTypes, string>,
  isRTL: boolean,
): string => {
  const hour = parts.get('hour') ?? '';
  const minute = parts.get('minute') ?? '';
  // Arabic keeps ص/م; English normalises to upper-case AM/PM.
  const period = parts.get('dayPeriod') ?? '';
  const normalisedPeriod = isRTL ? period : period.toUpperCase();
  return `${hour}:${minute} ${normalisedPeriod}`.trim();
};

/**
 * Full date + time — the canonical app format.
 *   "١٨ يونيو، ٢٠٢٦ - ١١:٢٠ ص"
 */
export const formatAppDate = (input: DateInput, isRTL = true): string => {
  const date = toDate(input);
  if (!date) return '';
  const parts = partsFor(date, isRTL, { ...DATE_OPTIONS, ...TIME_OPTIONS });
  return `${datePiece(parts, isRTL)} - ${timePiece(parts, isRTL)}`;
};

/** Date only — "١٨ يونيو، ٢٠٢٦" */
export const formatAppDateOnly = (input: DateInput, isRTL = true): string => {
  const date = toDate(input);
  if (!date) return '';
  return datePiece(partsFor(date, isRTL, DATE_OPTIONS), isRTL);
};

/** Time only — "١١:٢٠ ص" */
export const formatAppTimeOnly = (input: DateInput, isRTL = true): string => {
  const date = toDate(input);
  if (!date) return '';
  return timePiece(partsFor(date, isRTL, TIME_OPTIONS), isRTL);
};
