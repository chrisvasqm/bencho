// Runs once before all test files: checks the test database, then builds the k6 bundles.
import pg from 'pg';
import { testDatabaseUrl } from './helpers/test-config.ts';

export default async function setup(): Promise<void> {
  const connectionString = testDatabaseUrl();
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
  // The lifecycle tests run the real k6 bundles.
  await import('../scripts/build-k6.ts');
}
