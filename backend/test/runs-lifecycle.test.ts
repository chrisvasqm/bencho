// Real k6 runs against the demo app (QuickPizza) from the local stack.
import supertest from 'supertest';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { RunsService } from '../src/modules/runs/service.ts';
import { flowStep, longRunPayload, shortRunPayload } from './helpers/payloads.ts';
import { useTestApp } from './helpers/test-app.ts';

const app = useTestApp();

beforeAll(async () => {
  try {
    await fetch(app.k6.defaultBaseUrl, { signal: AbortSignal.timeout(3000) });
  } catch (error) {
    throw new Error(
      `Target app not reachable at ${app.k6.defaultBaseUrl}. Start the stack (QuickPizza) or set DEFAULT_BASE_URL.`,
      { cause: error },
    );
  }
});

/** Starts a run through the API and returns it once k6 has finished. */
async function runToEnd(body: Record<string, unknown>, service = app.service) {
  const request =
    service === app.service
      ? app.request()
      : supertest(createApp({ runsService: service, checkDatabase: async () => undefined }));
  const created = await request.post('/api/v1/runs').send(body);
  expect(created.status).toBe(202);
  await service.waitForIdle();
  return (await app.request().get(`/api/v1/runs/${created.body.run.id}`)).body.run;
}

describe('run lifecycle', () => {
  it('passes when every limit holds, and stores the summary and points', async () => {
    const run = await runToEnd(shortRunPayload());

    expect(run).toMatchObject({ status: 'passed', exitCode: 0, errorMessage: null });
    expect(run.summary).toHaveProperty('metrics');
    expect(new Date(run.startedAt).getTime()).toBeLessThanOrEqual(
      new Date(run.finishedAt).getTime(),
    );
    const { points } = (await app.request().get(`/api/v1/runs/${run.id}/points`)).body;
    expect(points.length).toBeGreaterThan(0);
    expect(points[0]).toMatchObject({ runId: run.id, second: expect.any(Number) });
  });

  it('still extracts values when response bodies are discarded by default', async () => {
    const run = await runToEnd(
      shortRunPayload({
        flow: [
          flowStep(),
          flowStep({
            name: 'Login',
            method: 'POST',
            path: '/api/users/token/login',
            body: '{"username": "default", "password": "12345678"}',
            extract: [{ name: 'token', path: 'token' }],
          }),
          flowStep({
            name: 'Ratings',
            path: '/api/ratings',
            headers: { Authorization: 'Token {{token}}' },
          }),
        ],
      }),
    );

    // A missing token fails the extract check, so the checks limit (rate>0.99) fails: exit code 99.
    expect(run).toMatchObject({ status: 'passed', exitCode: 0, errorMessage: null });
  });

  it('passes a rate run that starts flow runs per second up to its VU cap', async () => {
    const run = await runToEnd(
      shortRunPayload({
        mode: 'rate',
        maxVirtualUsers: 2,
        stages: [{ duration: '2s', target: 4 }],
      }),
    );

    expect(run).toMatchObject({ status: 'passed', exitCode: 0, errorMessage: null });
    // 0 → 4 runs per second over 2 s is about 4 flow runs.
    expect(run.summary.metrics.iterations.count).toBeGreaterThan(0);
    expect(run.summary.metrics.vus_max.max).toBe(2);
  });

  // Up to 20 s until the first points, then up to k6's 10 s stop grace: more than the default.
  it('stops a live k6 run gracefully and records it as stopped', { timeout: 45_000 }, async () => {
    const created = await app.request().post('/api/v1/runs').send(longRunPayload());
    const { id } = created.body.run;
    // Wait until k6 is sending requests (first stored points), not just spawned: a SIGINT
    // during k6 startup kills it before it can stop gracefully.
    await expect
      .poll(async () => (await app.repository.listPoints(id)).length, {
        timeout: 20_000,
        interval: 500,
      })
      .toBeGreaterThan(0);

    const response = await app.request().post(`/api/v1/runs/${id}/stop`);
    await app.service.waitForIdle();

    expect(response.status).toBe(202);
    const { run } = (await app.request().get(`/api/v1/runs/${id}`)).body;
    expect(run).toMatchObject({ status: 'stopped', errorMessage: null });
    expect(run.finishedAt).not.toBeNull();
    // k6 got SIGINT and stopped gracefully: it ran (exit code set) and wrote its summary.
    expect(run.exitCode).not.toBe(-1);
    expect(run.summary).toHaveProperty('metrics');
  });

  it('fails with exit code 99 when a limit is broken', async () => {
    // The demo app answers 200, so expecting 418 makes every request an error.
    const run = await runToEnd(
      shortRunPayload({ flow: [flowStep({ expectedStatus: 418 })], maxErrorRate: 0.01 }),
    );

    expect(run).toMatchObject({ status: 'failed', exitCode: 99, errorMessage: null });
  });

  describe('when k6 cannot run the test', () => {
    const originalPath = process.env.PATH;

    afterEach(() => {
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
    });

    it('records an error with k6 output when the bundle is missing', async () => {
      const broken = new RunsService(app.repository, { ...app.k6, bundleDir: 'no-such-dir' });

      const run = await runToEnd(shortRunPayload(), broken);

      expect(run.status).toBe('error');
      expect(run.exitCode).not.toBe(0);
      expect(run.errorMessage).toEqual(expect.any(String));
      expect(run.errorMessage.length).toBeGreaterThan(0);
    });

    it('records an error when the k6 binary is not installed', async () => {
      process.env.PATH = '/nonexistent';

      const run = await runToEnd(shortRunPayload());

      expect(run.status).toBe('error');
      expect(run.errorMessage).toMatch(/ENOENT/);
      expect(run.finishedAt).not.toBeNull();
    });
  });
});
