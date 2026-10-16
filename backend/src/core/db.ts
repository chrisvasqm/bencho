import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import pg from 'pg';
import * as schema from '../modules/runs/schema.ts';

export type Database = ReturnType<typeof connectDatabase>['db'];

const MIGRATION_LOCK_KEY = 727001;

export function connectDatabase(connectionString: string) {
  const pool = new pg.Pool({
    connectionString,
    // Fail instead of waiting forever when the database is down, so hung attempts never fill
    // the pool. statement_timeout is enforced by Postgres, so a slow statement is cancelled
    // there instead of only being abandoned by the client.
    connectionTimeoutMillis: 5000,
    keepAlive: true,
    statement_timeout: 30_000,
  });
  // An idle client losing its connection (database restart) emits here; unhandled, it would
  // crash the process. The pool drops that client and opens a new one on the next query.
  pool.on('error', (error) => {
    console.error('database pool: idle client error', error.message);
  });
  return { db: drizzle(pool, { schema }), pool };
}

// Matches connectionTimeoutMillis, so an abandoned ping never outlives its own probe.
const PING_TIMEOUT_MS = 5000;

/** Throws when the database cannot answer a trivial query within PING_TIMEOUT_MS. */
export async function pingDatabase(db: Database): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('Database ping timed out')), PING_TIMEOUT_MS);
  });
  try {
    await Promise.race([db.execute(sql`select 1`), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Applies committed migrations under an advisory lock, so parallel instances never race. */
export async function runMigrations(connectionString: string): Promise<void> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  const db = drizzle(client);
  try {
    await db.execute(sql`select pg_advisory_lock(${MIGRATION_LOCK_KEY})`);
    await migrate(db, { migrationsFolder: 'drizzle' });
    await db.execute(sql`select pg_advisory_unlock(${MIGRATION_LOCK_KEY})`);
  } finally {
    await client.end();
  }
}
