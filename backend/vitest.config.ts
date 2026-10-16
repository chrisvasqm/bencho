import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Builds the k6 bundles once; each test file then makes its own throwaway database.
    globalSetup: ['test/global-setup.ts'],
    // Real k6 runs take a few seconds, and a stop can wait up to its 10 s grace period.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
