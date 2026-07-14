/**
 * formatDate.ts — the single source of truth for date formatting across the app.
 *
 * THE RULE — one consistent format, Gregorian (Miladi) ONLY, never Hijri:
 *   Arabic : 18 يونيو، 2026 - 11:20 ص
 *   English: 18 June, 2026 - 11:20 AM
 *
 * - Latin (English) digits in BOTH languages — never Arabic-Indic.
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

// Arabic locale yields Arabic month names + ص/م.
// 'en-GB' keeps day-before-month ordering with Latin numerals.
//
// TWO Unicode locale extensions are pinned on the Arabic locale, and both
// matter:
//   -ca-gregory : the calendar. NOT the { calendar } option — on React Native
//                 (Hermes) that option is silently ignored, so plain 'ar-SA'
//                 falls back to the Islamic (Hijri) calendar.
//   -nu-latn    : the numbering system. Without it 'ar-SA' renders Arabic-Indic
//                 digits (١٨) — the app shows Latin digits (18) in BOTH
//                 languages.
const localeFor = (isRTL: boolean): string =>
  isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB';

/**
 * Belt-and-braces for the Latin-digits rule. '-nu-latn' is the correct way to
 * ask for them, but Intl on Hermes leans on whatever ICU the device ships and a
 * locale extension it doesn't understand is dropped silently — which would put
 * Arabic-Indic digits back on screen with nothing to warn us. Rewriting the
 * formatted output costs nothing and makes the rule unconditional.
 */
// Both digit blocks (Arabic-Indic U+0660.., Extended U+06F0..) are contiguous
// and start on a multiple of 16, so the low nibble IS the digit's value.
const toLatinDigits = (s: string): string =>
  s.replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 0xf));

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
  for (const part of dtf.formatToParts(date)) {
    map.set(part.type, toLatinDigits(part.value));
  }
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

/** "18 يونيو، 2026" / "18 June, 2026" */
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

/** "11:20 ص" / "11:20 AM" */
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
 *   "18 يونيو، 2026 - 11:20 ص"
 */
export const formatAppDate = (input: DateInput, isRTL = true): string => {
  const date = toDate(input);
  if (!date) return '';
  const parts = partsFor(date, isRTL, { ...DATE_OPTIONS, ...TIME_OPTIONS });
  return `${datePiece(parts, isRTL)} - ${timePiece(parts, isRTL)}`;
};

/** Date only — "18 يونيو، 2026" */
export const formatAppDateOnly = (input: DateInput, isRTL = true): string => {
  const date = toDate(input);
  if (!date) return '';
  return datePiece(partsFor(date, isRTL, DATE_OPTIONS), isRTL);
};

/** Time only — "11:20 ص" */
export const formatAppTimeOnly = (input: DateInput, isRTL = true): string => {
  const date = toDate(input);
  if (!date) return '';
  return timePiece(partsFor(date, isRTL, TIME_OPTIONS), isRTL);
};
