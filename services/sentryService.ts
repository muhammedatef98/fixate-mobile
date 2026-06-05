/**
 * sentryService.ts — Sentry stubs.
 * Replace with real @sentry/react-native calls once configured. Until
 * then, errors fall back to the console in dev and are silently dropped
 * in production.
 */
export function initSentry(): void {
  // No-op stub — wire up Sentry here when ready.
}

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.error('[reportError]', error, context);
  }
  // Production: no-op until Sentry is wired up.
}
