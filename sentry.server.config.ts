// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn:
    process.env.NEXT_PUBLIC_SENTRY_DSN ||
    'https://fa838104be186449a1842b3ad2f21dd0@o4510546710626304.ingest.us.sentry.io/4510546712657920',

  // Check if Sentry should be disabled
  enabled: process.env.NEXT_PUBLIC_SENTRY_DISABLED !== 'true',

  enableLogs: true,

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false
});
