/**
 * onboardingPreference.ts — remembers whether the user has already seen the
 * first-run onboarding carousel, so it shows exactly once (on a fresh install)
 * and never again.
 *
 * Backed by AsyncStorage, matching the project's other non-sensitive prefs
 * (see rolePreference.ts and the `@fixate/*` key convention). Intentionally
 * NOT cleared on logout — onboarding is a one-time intro tied to the install,
 * not to a session, so a returning signed-out user should not see it again.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';

const ONBOARDING_KEY = '@fixate/onboarding-seen';

/** True once the user has completed or skipped onboarding. Defaults to false
 *  (treat as "not seen") on any read error so we fail towards showing the
 *  intro rather than silently swallowing a first run. */
export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_KEY);
    return value === 'true';
  } catch (e) {
    logger.warn('[onboardingPreference] read failed', e);
    return false;
  }
}

/** Mark onboarding as seen. Best-effort; never throws. */
export async function markOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
  } catch (e) {
    logger.warn('[onboardingPreference] save failed', e);
  }
}
