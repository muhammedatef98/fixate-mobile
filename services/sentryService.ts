/**
 * sentryService.ts — thin wrapper around @sentry/react-native.
 *
 * Sentry itself is initialized at module-load time in app/_layout.tsx
 * (so the SDK is ready before any screen renders). This module exposes
 * the helpers the rest of the app uses to report errors, keeping the
 * Sentry import surface in one place.
 */
import * as Sentry from '@sentry/react-native';

/**
 * Kept for call sites that signal "Sentry should be ready by now".
 * Initialization happens in app/_layout.tsx; this is intentionally a
 * lightweight confirmation hook rather than a second init.
 */
export function initSentry(): void {
  // No init here — see Sentry.init() in app/_layout.tsx.
}

/**
 * Report an error to Sentry. In development we also surface it on the
 * console so it is visible during local work.
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.error('[reportError]', error, context);
  }

  const exception = error instanceof Error ? error : new Error(String(error));

  Sentry.captureException(exception, context ? { extra: context } : undefined);
}
