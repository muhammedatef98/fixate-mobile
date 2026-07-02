/**
 * rolePreference.ts — remembers which side of the app (customer vs technician)
 * the user last entered, so a returning logged-in user skips the role-selection
 * screen on cold launch and lands straight in their flow.
 *
 * Backed by AsyncStorage, matching the project's other non-sensitive prefs
 * (language/theme in AppContext use the same `@fixate/*` key convention).
 * Cleared on logout so role-selection reappears for the next sign-in.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';

export type AppRole = 'customer' | 'technician';

const ROLE_KEY = '@fixate/last-role';

/** Persist the flow the user is currently in. Best-effort; never throws. */
export async function saveLastRole(role: AppRole): Promise<void> {
  try {
    await AsyncStorage.setItem(ROLE_KEY, role);
  } catch (e) {
    logger.warn('[rolePreference] save failed', e);
  }
}

/** Read the last-used flow, or null if none saved / on error. */
export async function getLastRole(): Promise<AppRole | null> {
  try {
    const value = await AsyncStorage.getItem(ROLE_KEY);
    return value === 'customer' || value === 'technician' ? value : null;
  } catch (e) {
    logger.warn('[rolePreference] read failed', e);
    return null;
  }
}

/** Forget the saved flow (called on logout). Best-effort; never throws. */
export async function clearLastRole(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ROLE_KEY);
  } catch (e) {
    logger.warn('[rolePreference] clear failed', e);
  }
}
