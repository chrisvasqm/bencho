// Starts the API for the frontend e2e tests on its own throwaway database on postgres-test,
// so runs never touch dev data or another e2e run. The database is dropped on exit.
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { testDatabaseUrl } from './test-database.ts';

const name = `perf_e2e_${randomUUID().slice(0, 8)}`;
const server = testDatabaseUrl();

async function admin(statement: string): Promise<void> {
  const client = new pg.Client({ connectionString: server });
  await client.connect();
  try {
    await client.query(statement);
  } finally {
    await client.end();
  }
}

await admin(`create database "${name}"`);
// Playwright stops the server with SIGTERM (Ctrl+C sends SIGINT).
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    admin(`drop database if exists "${name}" with (force)`)
      .catch((error: unknown) => console.error(`could not drop ${name}`, error))
      .finally(() => process.exit(0));
  });
}

const url = new URL(server);
url.pathname = `/${name}`;
process.env.DATABASE_URL = url.toString();
await import('../src/server.ts');
