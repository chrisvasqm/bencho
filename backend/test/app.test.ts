import supertest from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/core/config.ts';
import { connectDatabase, pingDatabase } from '../src/core/db.ts';
import { RunsRepository } from '../src/modules/runs/repository.ts';
import { RunsService } from '../src/modules/runs/service.ts';
import { DEFAULT_LIMITS, DEFAULT_STAGES } from '../k6/lib/defaults.ts';
import { DEFAULT_FLOW } from '../k6/lib/flow.ts';
import { expectError, useTestApp } from './helpers/test-app.ts';

const app = useTestApp();

describe('ALLOW_PRIVATE_TARGETS', () => {
  it.each([
    ['unset outside production', { NODE_ENV: 'development' }, true],
    ['unset in production', { NODE_ENV: 'production' }, false],
    ['exactly true in production', { NODE_ENV: 'production', ALLOW_PRIVATE_TARGETS: 'true' }, true],
    ['false outside production', { NODE_ENV: 'test', ALLOW_PRIVATE_TARGETS: 'false' }, false],
  ])('is %s → %s', (_label, env, expected) => {
    expect(loadConfig(env).allowPrivateTargets).toBe(expected);
  });

  it('rejects any other value', () => {
    expect(() => loadConfig({ ALLOW_PRIVATE_TARGETS: 'yes' })).toThrow('ALLOW_PRIVATE_TARGETS');
  });
});

describe('GET /api/v1/health', () => {
  it('returns ok when the database answers', async () => {
    const response = await app.request().get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  describe('when the database is not reachable', () => {
    // A real pool on a closed port: the ping fails at once with ECONNREFUSED.
    const unreachable = connectDatabase('postgres://perf:perf@127.0.0.1:1/perf');

    afterAll(() => unreachable.pool.end());

    it('returns 503 DATABASE_UNAVAILABLE and logs the cause', async () => {
      const logged = app.allowLoggedErrors();
      const offline = createApp({
        runsService: app.service,
        checkDatabase: () => pingDatabase(unreachable.db),
      });

      const response = await supertest(offline).get('/api/v1/health');

      expect(response.status).toBe(503);
      expectError(response.body, 'DATABASE_UNAVAILABLE');
      expect(logged).toHaveBeenCalledWith('health: database check failed', expect.any(String));
    });
  });
});

describe('GET /api/v1/defaults', () => {
  it('returns the configured target and the default stages, limits and flow', async () => {
    const response = await app.request().get('/api/v1/defaults');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      baseUrl: app.k6.defaultBaseUrl,
      stages: DEFAULT_STAGES,
      limits: DEFAULT_LIMITS,
      flow: DEFAULT_FLOW,
    });
  });

  it('has stages for every run type', async () => {
    const response = await app.request().get('/api/v1/defaults');

    expect(Object.keys(response.body.stages).sort()).toEqual(['load', 'spike', 'stress']);
  });
});

describe('unknown routes and unreadable bodies', () => {
  it.each([
    ['GET', '/api/v1/nope'],
    ['GET', '/'],
    ['PUT', '/api/v1/runs'],
    ['PATCH', '/api/v1/defaults'],
  ] as const)('%s %s returns 404 NOT_FOUND', async (method, path) => {
    const response = await app.request()[method.toLowerCase() as 'get'](path);

    expect(response.status).toBe(404);
    expectError(response.body, 'NOT_FOUND');
    expect(response.body.error.message).toBe(`${method} ${path} not found`);
  });

  it('returns 400 BAD_REQUEST for malformed JSON', async () => {
    const response = await app
      .request()
      .post('/api/v1/runs')
      .set('Content-Type', 'application/json')
      .send('{"type": "load",');

    expect(response.status).toBe(400);
    expectError(response.body, 'BAD_REQUEST');
  });

  it('returns 413 PAYLOAD_TOO_LARGE for a body over 2 MB', async () => {
    const response = await app
      .request()
      .post('/api/v1/runs')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ padding: 'x'.repeat(2 * 1024 * 1024) }));

    expect(response.status).toBe(413);
    expectError(response.body, 'PAYLOAD_TOO_LARGE');
  });
});

describe('unexpected errors', () => {
  // A real service whose database refuses connections: every query throws.
  const unreachable = connectDatabase('postgres://perf:perf@127.0.0.1:1/perf');

  afterAll(() => unreachable.pool.end());

  it('returns 500 INTERNAL with a friendly message, no stack, and logs the error', async () => {
    const logged = app.allowLoggedErrors();
    const broken = createApp({
      runsService: new RunsService(new RunsRepository(unreachable.db), app.k6),
      checkDatabase: async () => undefined,
    });

    const response = await supertest(broken).get('/api/v1/runs');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: { code: 'INTERNAL', message: 'Something went wrong. Try again.', details: null },
    });
    expect(response.text).not.toMatch(/ECONNREFUSED|\.ts:\d+/);
    expect(logged).toHaveBeenCalledOnce();
  });
});
