// Runs once before all test files: checks the services the tests need, then builds k6 bundles.
import pg from 'pg';
import { loadConfig } from '../src/core/config.ts';

export default async function setup(): Promise<void> {
  const config = loadConfig();
  await expectPostgres(config.TEST_DATABASE_URL);
  await expectReachable(config.DEFAULT_BASE_URL);
  // The lifecycle tests run the real k6 bundles.
  await import('../scripts/build-k6.ts');
}

async function expectPostgres(connectionString: string): Promise<void> {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 3000 });
  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      `Test database not reachable at ${new URL(connectionString).host}. Run \`pnpm test:db\` first.`,
      { cause: error },
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** k6 runs in the tests target this app (QuickPizza from the local stack). */
async function expectReachable(baseUrl: string): Promise<void> {
  try {
    await fetch(baseUrl, { signal: AbortSignal.timeout(3000) });
  } catch (error) {
    throw new Error(
      `Target app not reachable at ${baseUrl}. Start the stack (QuickPizza on 10001) or set DEFAULT_BASE_URL.`,
      { cause: error },
    );
  }
}
