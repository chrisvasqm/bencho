// Real k6 runs against the demo app (QuickPizza) from the local stack.
import supertest from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { RunsService } from '../src/modules/runs/service.ts';
import { flowStep, shortRunPayload } from './helpers/payloads.ts';
import { useTestApp } from './helpers/test-app.ts';

const app = useTestApp();

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
      process.env.PATH = originalPath;
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
