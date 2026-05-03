import * as Sentry from '@sentry/nextjs';

const sentryOptions: Sentry.NodeOptions | Sentry.EdgeOptions = {
  // Sentry DSN
  dsn:
    process.env.NEXT_PUBLIC_SENTRY_DSN ||
    'https://fa838104be186449a1842b3ad2f21dd0@o4510546710626304.ingest.us.sentry.io/4510546712657920',

  enableLogs: true,

  // Keep Spotlight off unless the local Spotlight sidecar is explicitly wired up.
  spotlight: false,

  // Adds request headers and IP for users, for more info visit
  sendDefaultPii: true,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false
};

export async function register() {
  if (process.env.NEXT_PUBLIC_SENTRY_DISABLED !== 'true') {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      // Node.js Sentry configuration
      Sentry.init(sentryOptions);
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
      // Edge Sentry configuration
      Sentry.init(sentryOptions);
    }
  }
}

export const onRequestError = Sentry.captureRequestError;
