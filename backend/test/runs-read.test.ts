import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { expectError, useTestApp } from './helpers/test-app.ts';

const app = useTestApp();

const point = (second: number) => ({
  second,
  virtualUsers: second + 1,
  requestsPerSecond: 10,
  errorRate: 0,
  p50: 1.5,
  p90: null,
  p95: null,
  p99: null,
});

describe.each([
  ['GET /api/v1/runs/:id', (id: string) => `/api/v1/runs/${id}`],
  ['GET /api/v1/runs/:id/points', (id: string) => `/api/v1/runs/${id}/points`],
])('%s', (_name, path) => {
  it('returns 404 RUN_NOT_FOUND for an unknown id', async () => {
    const response = await app.request().get(path(randomUUID()));

    expect(response.status).toBe(404);
    expectError(response.body, 'RUN_NOT_FOUND');
  });

  it.each(['not-a-uuid', '123', '00000000-0000-0000-0000-00000000000g'])(
    'returns 400 VALIDATION for the id %s',
    async (id) => {
      const response = await app.request().get(path(id));

      expect(response.status).toBe(400);
      expectError(response.body, 'VALIDATION');
      expect(response.body.error.message).toBe('Invalid params');
    },
  );
});

describe('GET /api/v1/runs/:id', () => {
  it('returns the stored run', async () => {
    const seeded = await app.seedRun({
      status: 'failed',
      exitCode: 99,
      summary: { metrics: {} },
    });

    const response = await app.request().get(`/api/v1/runs/${seeded.id}`);

    expect(response.status).toBe(200);
    expect(response.body.run).toMatchObject({
      id: seeded.id,
      status: 'failed',
      exitCode: 99,
      summary: { metrics: {} },
      createdAt: seeded.createdAt.toISOString(),
    });
  });
});

describe('GET /api/v1/runs/:id/points', () => {
  it('returns an empty list for a run without points', async () => {
    const seeded = await app.seedRun();

    const response = await app.request().get(`/api/v1/runs/${seeded.id}/points`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ points: [] });
  });

  it('returns the points ordered by second, with null percentiles kept', async () => {
    const seeded = await app.seedRun();
    await app.repository.addPoints(seeded.id, [point(2), point(0), point(1)]);

    const response = await app.request().get(`/api/v1/runs/${seeded.id}/points`);

    expect(response.body.points.map((stored: { second: number }) => stored.second)).toEqual([
      0, 1, 2,
    ]);
    expect(response.body.points[0]).toEqual({ runId: seeded.id, ...point(0) });
  });

  it('returns only the points of the requested run', async () => {
    const [first, second] = [await app.seedRun(), await app.seedRun()];
    await app.repository.addPoints(first.id, [point(0)]);
    await app.repository.addPoints(second.id, [point(0), point(1)]);

    const response = await app.request().get(`/api/v1/runs/${first.id}/points`);

    expect(response.body.points).toHaveLength(1);
  });
});
