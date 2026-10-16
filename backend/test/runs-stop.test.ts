import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { longRunPayload } from './helpers/payloads.ts';
import { expectError, useTestApp } from './helpers/test-app.ts';

const app = useTestApp();

const stopRun = (id: string) => app.request().post(`/api/v1/runs/${id}/stop`);

describe('POST /api/v1/runs/:id/stop', () => {
  it('stops a live k6 run and records it as stopped', async () => {
    const created = await app.request().post('/api/v1/runs').send(longRunPayload());
    const { id } = created.body.run;
    await expect
      .poll(async () => (await app.request().get(`/api/v1/runs/${id}`)).body.run.status)
      .toBe('running');

    const response = await stopRun(id);
    await app.service.waitForIdle();

    expect(response.status).toBe(202);
    expect(response.body.run.id).toBe(id);
    const { run } = (await app.request().get(`/api/v1/runs/${id}`)).body;
    expect(run).toMatchObject({ status: 'stopped', errorMessage: null });
    expect(run.finishedAt).not.toBeNull();
  });

  it('stops a run right after it was queued, before k6 starts', async () => {
    const created = await app.request().post('/api/v1/runs').send(longRunPayload());

    const response = await stopRun(created.body.run.id);
    await app.service.waitForIdle();

    expect(response.status).toBe(202);
    const { run } = (await app.request().get(`/api/v1/runs/${created.body.run.id}`)).body;
    expect(run.status).toBe('stopped');
  });

  it.each(['queued', 'running'] as const)(
    'marks a %s run left over from a restart as stopped at once',
    async (status) => {
      const seeded = await app.seedRun({ status });

      const response = await stopRun(seeded.id);

      expect(response.status).toBe(202);
      expect(response.body.run.status).toBe('stopped');
      expect(response.body.run.finishedAt).not.toBeNull();
    },
  );

  it.each(['passed', 'failed', 'error', 'stopped'] as const)(
    'returns 409 RUN_NOT_ACTIVE for a %s run',
    async (status) => {
      const seeded = await app.seedRun({ status });

      const response = await stopRun(seeded.id);

      expect(response.status).toBe(409);
      expectError(response.body, 'RUN_NOT_ACTIVE');
    },
  );

  it('returns 404 RUN_NOT_FOUND for an unknown id', async () => {
    const response = await stopRun(randomUUID());

    expect(response.status).toBe(404);
    expectError(response.body, 'RUN_NOT_FOUND');
  });

  it('returns 400 VALIDATION for an id that is not a UUID', async () => {
    const response = await stopRun('not-a-uuid');

    expect(response.status).toBe(400);
    expectError(response.body, 'VALIDATION');
  });
});
