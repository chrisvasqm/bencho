// One app per test file on its own throwaway database, with the hooks every file needs.
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import pg from 'pg';
import supertest from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi, type MockInstance } from 'vitest';
import { createApp } from '../../src/app.ts';
import { loadConfig } from '../../src/core/config.ts';
import { connectDatabase, pingDatabase, runMigrations, type Database } from '../../src/core/db.ts';
import { RunsRepository } from '../../src/modules/runs/repository.ts';
import type { NewRun, Run } from '../../src/modules/runs/schema.ts';
import { RunsService, type K6Settings } from '../../src/modules/runs/service.ts';
import { DEFAULT_LIMITS, DEFAULT_STAGES } from '../../k6/lib/defaults.ts';
import { DEFAULT_FLOW } from '../../k6/lib/flow.ts';

export interface TestApp {
  request: () => supertest.Agent;
  service: RunsService;
  repository: RunsRepository;
  db: Database;
  k6: K6Settings;
  databaseUrl: string;
  /** Lets the current test log through console.error (checked after each test otherwise). */
  allowLoggedErrors: () => void;
  /** Inserts a run row directly, without starting k6. */
  seedRun: (overrides?: Partial<NewRun>) => Promise<Run>;
}

/** Registers the hooks and returns the app; fields are filled once beforeAll has run. */
export function useTestApp(): TestApp {
  const config = loadConfig();
  const k6: K6Settings = { bundleDir: 'dist/k6', defaultBaseUrl: config.DEFAULT_BASE_URL };
  const databaseUrl = withDatabaseName(
    config.TEST_DATABASE_URL,
    `perf_test_${randomUUID().slice(0, 8)}`,
  );
  let pool: pg.Pool;
  let consoleError: MockInstance<typeof console.error>;
  let loggedErrorsAllowed = false;

  const context = {
    k6,
    databaseUrl,
    allowLoggedErrors: () => {
      loggedErrorsAllowed = true;
    },
    seedRun: async (overrides: Partial<NewRun> = {}) =>
      context.repository.create({
        type: 'load',
        baseUrl: k6.defaultBaseUrl,
        stages: DEFAULT_STAGES.load,
        limits: DEFAULT_LIMITS,
        flow: DEFAULT_FLOW,
        status: 'passed',
        ...overrides,
      }),
  } as TestApp;

  beforeAll(async () => {
    await adminQuery(config.TEST_DATABASE_URL, `create database "${databaseName(databaseUrl)}"`);
    await runMigrations(databaseUrl);
    const connection = connectDatabase(databaseUrl);
    pool = connection.pool;
    context.db = connection.db;
    context.repository = new RunsRepository(connection.db);
    context.service = new RunsService(context.repository, k6);
    const app = createApp({
      runsService: context.service,
      checkDatabase: () => pingDatabase(connection.db),
    });
    context.request = () => supertest.agent(app);
  });

  beforeEach(async () => {
    await context.db.execute(sql`truncate table runs cascade`);
    loggedErrorsAllowed = false;
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await stopActiveRuns(context.service);
    await context.service.waitForIdle();
    consoleError.mockRestore();
    if (!loggedErrorsAllowed)
      expect(consoleError, 'console.error was called').not.toHaveBeenCalled();
  });

  afterAll(async () => {
    await pool?.end();
    await adminQuery(
      config.TEST_DATABASE_URL,
      `drop database if exists "${databaseName(databaseUrl)}" with (force)`,
    );
  });

  return context;
}

/** Stops every queued or running run, so no k6 process outlives its test. */
async function stopActiveRuns(service: RunsService): Promise<void> {
  const { runs } = await service.list({ active: true, page: 1, pageSize: 50 });
  await Promise.all(runs.map((run) => service.stop(run.id).catch(() => undefined)));
}

async function adminQuery(connectionString: string, statement: string): Promise<void> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(statement);
  } finally {
    await client.end();
  }
}

function withDatabaseName(connectionString: string, name: string): string {
  const url = new URL(connectionString);
  url.pathname = `/${name}`;
  return url.toString();
}

function databaseName(connectionString: string): string {
  return new URL(connectionString).pathname.slice(1);
}

/** Asserts the one error shape every failing endpoint uses. */
export function expectError(body: unknown, code: string): void {
  expect(body).toMatchObject({ error: { code, message: expect.any(String) } });
  expect(Object.keys((body as { error: object }).error).sort()).toEqual([
    'code',
    'details',
    'message',
  ]);
}
