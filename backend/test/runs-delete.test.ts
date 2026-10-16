import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MAX_BULK_DELETE, RUN_STATUSES } from '../src/modules/runs/schema.ts';
import { expectError, useTestApp } from './helpers/test-app.ts';

const app = useTestApp();

const FINISHED = RUN_STATUSES.filter((status) => status !== 'queued' && status !== 'running');
const POINT = {
  second: 0,
  virtualUsers: 1,
  requestsPerSecond: 1,
  errorRate: 0,
  p50: null,
  p90: null,
  p95: null,
  p99: null,
};

describe('DELETE /api/v1/runs/:id', () => {
  it.each(FINISHED)('deletes a %s run and its points', async (status) => {
    const seeded = await app.seedRun({ status });
    await app.repository.addPoints(seeded.id, [POINT]);

    const response = await app.request().delete(`/api/v1/runs/${seeded.id}`);

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect((await app.request().get(`/api/v1/runs/${seeded.id}`)).status).toBe(404);
    expect(await app.repository.listPoints(seeded.id)).toEqual([]);
  });

  it.each(['queued', 'running'] as const)(
    'returns 409 RUN_IN_PROGRESS for a %s run and keeps it',
    async (status) => {
      const seeded = await app.seedRun({ status });

      const response = await app.request().delete(`/api/v1/runs/${seeded.id}`);

      expect(response.status).toBe(409);
      expectError(response.body, 'RUN_IN_PROGRESS');
      expect((await app.request().get(`/api/v1/runs/${seeded.id}`)).status).toBe(200);
    },
  );

  it('returns 404 RUN_NOT_FOUND for an unknown id', async () => {
    const response = await app.request().delete(`/api/v1/runs/${randomUUID()}`);

    expect(response.status).toBe(404);
    expectError(response.body, 'RUN_NOT_FOUND');
  });

  it('returns 404 the second time the same run is deleted', async () => {
    const seeded = await app.seedRun();
    await app.request().delete(`/api/v1/runs/${seeded.id}`);

    const response = await app.request().delete(`/api/v1/runs/${seeded.id}`);

    expect(response.status).toBe(404);
  });

  it('returns 400 VALIDATION for an id that is not a UUID', async () => {
    const response = await app.request().delete('/api/v1/runs/not-a-uuid');

    expect(response.status).toBe(400);
    expectError(response.body, 'VALIDATION');
  });

  it('leaves other runs alone', async () => {
    const [target, other] = [await app.seedRun(), await app.seedRun()];

    await app.request().delete(`/api/v1/runs/${target.id}`);

    expect((await app.request().get(`/api/v1/runs/${other.id}`)).status).toBe(200);
  });
});

describe('POST /api/v1/runs/delete', () => {
  const bulkDelete = (body: unknown) =>
    app
      .request()
      .post('/api/v1/runs/delete')
      .send(body as object);

  it('deletes finished runs and skips runs in progress and unknown ids', async () => {
    const passed = await app.seedRun({ status: 'passed' });
    const stopped = await app.seedRun({ status: 'stopped' });
    const running = await app.seedRun({ status: 'running' });
    const unknown = randomUUID();
    await app.repository.addPoints(passed.id, [POINT]);

    const response = await bulkDelete({ ids: [passed.id, stopped.id, running.id, unknown] });

    expect(response.status).toBe(200);
    expect([...response.body.deleted].sort()).toEqual([passed.id, stopped.id].sort());
    expect([...response.body.skipped].sort()).toEqual([running.id, unknown].sort());
    expect(await app.repository.listPoints(passed.id)).toEqual([]);
    expect((await app.request().get(`/api/v1/runs/${running.id}`)).status).toBe(200);
  });

  it('reports a repeated id once', async () => {
    const seeded = await app.seedRun();

    const response = await bulkDelete({ ids: [seeded.id, seeded.id, seeded.id] });

    expect(response.body).toEqual({ deleted: [seeded.id], skipped: [] });
  });

  it('skips everything when no id matches', async () => {
    const ids = [randomUUID(), randomUUID()];

    const response = await bulkDelete({ ids });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ deleted: [], skipped: ids });
  });

  it(`accepts ${MAX_BULK_DELETE} ids`, async () => {
    const ids = Array.from({ length: MAX_BULK_DELETE }, () => randomUUID());

    const response = await bulkDelete({ ids });

    expect(response.status).toBe(200);
  });

  it.each([
    ['a missing ids field', {}],
    ['an empty list', { ids: [] }],
    [
      `more than ${MAX_BULK_DELETE} ids`,
      { ids: Array.from({ length: MAX_BULK_DELETE + 1 }, () => randomUUID()) },
    ],
    ['an id that is not a UUID', { ids: ['not-a-uuid'] }],
    ['ids that are not a list', { ids: randomUUID() }],
  ])('returns 400 VALIDATION for %s', async (_label, body) => {
    const response = await bulkDelete(body);

    expect(response.status).toBe(400);
    expectError(response.body, 'VALIDATION');
  });
});
