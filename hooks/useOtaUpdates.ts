import { useEffect } from 'react';
import * as Updates from 'expo-updates';

/**
 * Checks for an OTA update on app launch and silently applies it on next
 * launch if one is available. No UI is shown — the update is fetched in
 * the background and takes effect the next time the user opens the app.
 *
 * Usage: call once at the root of the app (e.g. in `app/_layout.tsx`):
 *
 *   useOtaUpdates();
 *
 * Safe to no-op in development / Expo Go where `Updates.isEnabled` is
 * false. Never throws to the caller — all errors are swallowed so a
 * broken update channel can't brick the app.
 */
export const useOtaUpdates = (): void => {
  useEffect(() => {
    if (!Updates.isEnabled) return;

    let cancelled = false;

    const run = async (): Promise<void> => {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (cancelled || !result.isAvailable) return;

        await Updates.fetchUpdateAsync();
        if (cancelled) return;

        // The update is staged. It will activate on the next cold
        // start. We intentionally do NOT call reloadAsync() here to
        // avoid interrupting whatever the user is doing on first
        // launch.
      } catch {
        // Non-fatal: a failed update check should never break the app.
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);
};
