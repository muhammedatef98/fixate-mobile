import * as Sentry from '@sentry/react-native';

export const initSentry = () => {
  if (__DEV__) return; // Sentry disabled in development
  Sentry.init({
    dsn: 'https://5a3e562f125bc31dc84d11938d9fba36@o4511510384672768.ingest.us.sentry.io/4511510403219456',
    tracesSampleRate: 0.2,
    environment: 'production',
  });
};

export const reportError = (error: Error, context?: Record<string, unknown>) => {
  if (__DEV__) {
    console.error('[reportError]', error, context);
    return;
  }
  Sentry.captureException(error, { extra: context });
};
