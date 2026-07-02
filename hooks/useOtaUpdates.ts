/**
 * useOtaUpdates.ts — silent OTA (expo-updates) check on app startup.
 *
 * On mount, checks for a newer EAS update in the background. If one is found,
 * it's downloaded and applied with Updates.reloadAsync() — no prompts, no UI.
 *
 * Guards:
 *   - Only runs when Updates.isEnabled is true. That flag is false in a dev
 *     build / Expo Go / when no update URL is configured, so this is a no-op
 *     everywhere except a production (or preview) release build. Belt-and-
 *     suspenders with __DEV__ so we never fire a reload during local dev.
 *   - Never throws into render: all work is inside the effect and any error is
 *     swallowed (a failed update check must not disrupt app startup).
 *   - Non-blocking: the check runs after mount and does not gate first paint.
 */
import { useEffect } from 'react';
import * as Updates from 'expo-updates';

export function useOtaUpdates(): void {
  useEffect(() => {
    // Skip entirely in dev and any build where updates aren't enabled
    // (Expo Go, dev client, simulator dev runs).
    if (__DEV__ || !Updates.isEnabled) return;

    let cancelled = false;

    (async () => {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (cancelled || !result.isAvailable) return;

        await Updates.fetchUpdateAsync();
        if (cancelled) return;

        // Apply immediately with a silent reload.
        await Updates.reloadAsync();
      } catch {
        // Offline, no update, or transient failure — ignore and keep running
        // on the currently-embedded bundle.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
