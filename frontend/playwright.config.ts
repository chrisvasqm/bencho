import { defineConfig, devices } from '@playwright/test';

// Own ports, never the dev stack's: the tests delete every run between tests.
const backendPort = Number(process.env.E2E_BACKEND_PORT ?? 10103);
const frontendPort = Number(process.env.E2E_FRONTEND_PORT ?? 10104);
const baseURL = `http://localhost:${frontendPort}`;

export default defineConfig({
  testDir: 'e2e',
  // One backend and database for all tests: run them one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  // Real k6 runs take a few seconds; the UI polls every 2 s.
  timeout: 60_000,
  expect: { timeout: 30_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    testIdAttribute: 'data-testid',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Fresh database on postgres-test, real k6, QuickPizza as the target.
      command: 'pnpm e2e:server',
      cwd: '../backend',
      env: { PORT: String(backendPort) },
      url: `http://localhost:${backendPort}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'pipe',
    },
    {
      command: 'pnpm exec vite',
      env: { FRONTEND_PORT: String(frontendPort), BACKEND_PORT: String(backendPort) },
      url: baseURL,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
