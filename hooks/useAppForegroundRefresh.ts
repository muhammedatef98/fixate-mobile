import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

/**
 * H-6: realtime subscriptions are best-effort and the OS may suspend them
 * after the app goes to the background for more than a few tens of seconds.
 * On resume we trigger a refetch so the UI catches up with whatever
 * happened while we were not listening.
 *
 * The hook fires the supplied callback when AppState transitions
 * background → active and only if the gap exceeded `thresholdMs`
 * (default 5 s) so quick foreground bounces don't spam the network.
 *
 * Usage:
 *   useAppForegroundRefresh(loadMessages);
 */
export function useAppForegroundRefresh(
  onForeground: () => void | Promise<void>,
  thresholdMs: number = 5_000,
): void {
  const lastBackgroundedAtRef = useRef<number | null>(null);
  const lastStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = lastStateRef.current;
      lastStateRef.current = next;

      if (next === 'background' || next === 'inactive') {
        lastBackgroundedAtRef.current = Date.now();
        return;
      }
      if (next === 'active' && (prev === 'background' || prev === 'inactive')) {
        const since = lastBackgroundedAtRef.current
          ? Date.now() - lastBackgroundedAtRef.current
          : Infinity;
        lastBackgroundedAtRef.current = null;
        if (since >= thresholdMs) {
          // Fire-and-forget. Errors are the caller's responsibility.
          void onForeground();
        }
      }
    });

    return () => {
      sub.remove();
    };
  }, [onForeground, thresholdMs]);
}
