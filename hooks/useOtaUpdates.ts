import { useEffect } from 'react';
import * as Updates from 'expo-updates';
import { logger } from '../utils/logger';

/**
 * Checks for an over-the-air update on launch and applies it on the next
 * app start. Does nothing in dev builds or when updates are disabled.
 */
export function useOtaUpdates(): void {
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (check.isAvailable) await Updates.fetchUpdateAsync();
      } catch (e) {
        logger.warn('OTA update check failed', e);
      }
    })();
  }, []);
}
