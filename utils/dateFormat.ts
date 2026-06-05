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
