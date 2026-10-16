// Starts the API for the frontend e2e tests on a fresh database on postgres-test.
// Recreated at every start, so each e2e run begins empty and never touches dev data.
import pg from 'pg';
import { loadConfig } from '../src/core/config.ts';
import { testDatabaseUrl } from './test-database.ts';

const name = `perf_e2e_${loadConfig().PORT}`;
const server = testDatabaseUrl();
const client = new pg.Client({ connectionString: server });
await client.connect();
try {
  await client.query(`drop database if exists "${name}" with (force)`);
  await client.query(`create database "${name}"`);
} finally {
  await client.end();
}

const url = new URL(server);
url.pathname = `/${name}`;
process.env.DATABASE_URL = url.toString();
await import('../src/server.ts');
