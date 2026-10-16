import { beforeEach, describe, expect, it } from 'vitest';
import type { Run } from '../src/modules/runs/schema.ts';
import { expectError, useTestApp } from './helpers/test-app.ts';

const app = useTestApp();

/** Seeds runs one minute apart, oldest first, so the newest-first order is certain. */
async function seedRuns(specs: Array<Pick<Run, 'type' | 'status'>>): Promise<Run[]> {
  const start = Date.UTC(2026, 0, 1);
  const seeded: Run[] = [];
  for (const [index, spec] of specs.entries()) {
    seeded.push(await app.seedRun({ ...spec, createdAt: new Date(start + index * 60_000) }));
  }
  return seeded;
}

const ids = (runs: Array<{ id: string }>) => runs.map((run) => run.id);

describe('GET /api/v1/runs', () => {
  it('returns an empty first page with the default page size', async () => {
    const response = await app.request().get('/api/v1/runs');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ runs: [], total: 0, page: 1, pageSize: 10 });
  });

  describe('with seeded runs', () => {
    let seeded: Run[];

    beforeEach(async () => {
      seeded = await seedRuns([
        { type: 'load', status: 'passed' },
        { type: 'stress', status: 'failed' },
        { type: 'load', status: 'running' },
        { type: 'spike', status: 'queued' },
        { type: 'load', status: 'error' },
      ]);
    });

    it('lists every run, newest first', async () => {
      const response = await app.request().get('/api/v1/runs');

      expect(response.body.total).toBe(5);
      expect(ids(response.body.runs)).toEqual(ids(seeded).reverse());
    });

    it('filters by type', async () => {
      const response = await app.request().get('/api/v1/runs').query({ type: 'load' });

      expect(response.body.total).toBe(3);
      expect(response.body.runs.every((run: Run) => run.type === 'load')).toBe(true);
    });

    it('returns only queued and running runs when active=true', async () => {
      const response = await app.request().get('/api/v1/runs').query({ active: 'true' });

      expect(response.body.runs.map((run: Run) => run.status).sort()).toEqual([
        'queued',
        'running',
      ]);
    });

    it('combines type and active filters', async () => {
      const response = await app
        .request()
        .get('/api/v1/runs')
        .query({ type: 'load', active: 'true' });

      expect(ids(response.body.runs)).toEqual([seeded[2]?.id]);
    });

    it('treats active=false as no status filter', async () => {
      const response = await app.request().get('/api/v1/runs').query({ active: 'false' });

      expect(response.body.total).toBe(5);
    });

    it('pages through results and keeps the total', async () => {
      const first = await app.request().get('/api/v1/runs').query({ page: 1, pageSize: 2 });
      const last = await app.request().get('/api/v1/runs').query({ page: 3, pageSize: 2 });

      expect(first.body).toMatchObject({ total: 5, page: 1, pageSize: 2 });
      expect(ids(first.body.runs)).toEqual([seeded[4]?.id, seeded[3]?.id]);
      expect(ids(last.body.runs)).toEqual([seeded[0]?.id]);
    });

    it('returns an empty page past the end, with the real total', async () => {
      const response = await app.request().get('/api/v1/runs').query({ page: 99 });

      expect(response.body).toEqual({ runs: [], total: 5, page: 99, pageSize: 10 });
    });

    it('accepts the largest page size, 50', async () => {
      const response = await app.request().get('/api/v1/runs').query({ pageSize: 50 });

      expect(response.status).toBe(200);
      expect(response.body.pageSize).toBe(50);
    });
  });

  it.each([
    ['unknown type', { type: 'soak' }],
    ['active not true/false', { active: 'yes' }],
    ['page 0', { page: 0 }],
    ['negative page', { page: -1 }],
    ['fractional page', { page: 1.5 }],
    ['non-numeric page', { page: 'abc' }],
    ['page size 0', { pageSize: 0 }],
    ['page size over 50', { pageSize: 51 }],
  ])('returns 400 VALIDATION for %s', async (_label, query) => {
    const response = await app.request().get('/api/v1/runs').query(query);

    expect(response.status).toBe(400);
    expectError(response.body, 'VALIDATION');
    expect(response.body.error.message).toBe('Invalid query');
  });
});
