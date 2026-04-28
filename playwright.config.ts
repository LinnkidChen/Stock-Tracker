import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? process.env.PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const isCI = Boolean(process.env.CI);
const webServerCommand = isCI
  ? `pnpm exec next start -H 127.0.0.1 -p ${port}`
  : `pnpm exec next dev --turbopack -H 127.0.0.1 -p ${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: webServerCommand,
        url: `${baseURL}/next.svg`,
        reuseExistingServer: !isCI,
        timeout: 120_000,
        env: {
          CLERK_SECRET_KEY: '',
          NEXT_TELEMETRY_DISABLED: '1',
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '',
          NEXT_PUBLIC_SENTRY_DISABLED: 'true'
        }
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
