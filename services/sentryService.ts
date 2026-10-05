import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
let initialized = false;

/** Initialise Sentry once. No-op in dev or when no DSN is configured. */
export function initSentry(): void {
  if (initialized || !dsn || __DEV__) return;
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
  initialized = true;
}

/** Report an error with extra context; silently skipped when Sentry is off. */
export function reportError(error: Error, context?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.captureException(error, { extra: context });
}
