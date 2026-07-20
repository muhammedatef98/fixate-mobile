/**
 * sentryService.ts — thin wrapper around @sentry/react-native.
 *
 * `initSentry()` is called once at module-load time from app/_layout.tsx, so
 * the native + JS error handlers are installed before any screen renders.
 * This module keeps the Sentry import surface in one place.
 */
import * as Sentry from '@sentry/react-native';

/**
 * Initialize Sentry.
 *
 * The DSN is read from `EXPO_PUBLIC_SENTRY_DSN` and is intentionally NOT
 * hardcoded. A Sentry DSN is a publishable value, so exposing it via an
 * `EXPO_PUBLIC_*` variable is expected and safe. When the variable is absent
 * (e.g. a local checkout that hasn't set it) we skip initialization and fail
 * safe: the app runs exactly as before, just without error reporting — no
 * crash, no throw.
 */
export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    if (__DEV__) {
       
      console.warn(
        '[sentry] EXPO_PUBLIC_SENTRY_DSN is not set — Sentry is disabled. ' +
          'Set it in your env / EAS secrets to enable crash reporting.'
      );
    }
    return;
  }

  Sentry.init({
    dsn,
    // Only transmit events from real (production) builds. In development the
    // SDK loads but stays silent, so local work creates no noise and spends no
    // event quota. reportError() still logs to the console while __DEV__.
    enabled: !__DEV__,
    // Never attach IP address / user identifiers automatically — preserves the
    // project's existing privacy posture (no PII).
    sendDefaultPii: false,
    // Errors only; no performance tracing (keeps overhead and quota low).
    tracesSampleRate: 0,
  });
}

/**
 * Report an error to Sentry. In development we also surface it on the
 * console so it is visible during local work.
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (__DEV__) {
     
    console.error('[reportError]', error, context);
  }

  const exception = error instanceof Error ? error : new Error(String(error));

  Sentry.captureException(exception, context ? { extra: context } : undefined);
}
