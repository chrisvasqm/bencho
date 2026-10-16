import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import pg from 'pg';
import * as schema from '../modules/runs/schema.ts';

export type Database = ReturnType<typeof connectDatabase>['db'];

const MIGRATION_LOCK_KEY = 727001;

export function connectDatabase(connectionString: string) {
  const pool = new pg.Pool({ connectionString });
  return { db: drizzle(pool, { schema }), pool };
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
