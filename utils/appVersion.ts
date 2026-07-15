import Constants from 'expo-constants';

/**
 * Force-update support. The admin sets a minimum app version in platform
 * settings; on launch we compare it against the running build and block the
 * app when it's too old. Kept dependency-free — a tiny dotted-number compare
 * is all a semver floor like "1.2.0" needs.
 */

/** The running app version (from app.json `expo.version`). Empty when unknown. */
export const currentAppVersion: string =
  (Constants.expoConfig?.version as string | undefined) ??
  ((Constants as any).manifest?.version as string | undefined) ??
  '';

/**
 * Compare two dotted version strings numerically.
 * Returns -1 if a < b, 0 if equal, 1 if a > b. Missing segments count as 0,
 * so "1.2" === "1.2.0". Non-numeric or empty input compares as 0.
 */
export const compareVersions = (a: string, b: string): number => {
  const pa = String(a || '').split('.');
  const pb = String(b || '').split('.');
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = parseInt(pa[i] ?? '0', 10) || 0;
    const nb = parseInt(pb[i] ?? '0', 10) || 0;
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  return 0;
};

/**
 * True when the running build is older than `minVersion` and must update.
 * A blank floor (admin left it empty) never blocks; an unknown current
 * version fails open (never lock users out on a bad read).
 */
export const isUpdateRequired = (
  minVersion: string | null | undefined,
  current: string = currentAppVersion
): boolean => {
  const min = String(minVersion ?? '').trim();
  if (!min) return false;
  if (!current) return false;
  return compareVersions(current, min) < 0;
};
