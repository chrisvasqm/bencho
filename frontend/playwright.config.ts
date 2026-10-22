import { defineConfig, devices } from '@playwright/test';

// Each worker starts its own backend (throwaway database, real k6, QuickPizza as the target)
// and Vite dev server: see e2e/servers.ts. Their ports come from the worker index, so the
// tests never share a server with each other or with a stack.
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  // Real k6 runs take a few seconds; the UI polls every 2 s.
  timeout: 60_000,
  expect: { timeout: 30_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    testIdAttribute: 'data-testid',
    trace: 'retain-on-failure',
    // English copy and number formats, whatever the machine's language.
    locale: 'en-US',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
