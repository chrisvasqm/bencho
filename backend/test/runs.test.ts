// Every /runs endpoint on one throwaway database. One test walks the whole CRUD flow of a run;
// the rest cover what that flow cannot: variants, limits and errors of each endpoint.
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_LIMITS, DEFAULT_STAGES } from '../k6/lib/defaults.ts';
import { DEFAULT_FLOW, MAX_STEPS } from '../k6/lib/flow.ts';
import { MAX_BULK_DELETE, MAX_STAGES, RUN_STATUSES, type Run } from '../src/modules/runs/schema.ts';
import {
  flowStep,
  longRunPayload,
  PASSING_LIMITS,
  runPayload,
  TARGET_BASE_URL,
} from './helpers/payloads.ts';
import { expectError, useTestApp } from './helpers/test-app.ts';

const app = useTestApp();

const FINISHED = RUN_STATUSES.filter((status) => status !== 'queued' && status !== 'running');

const createRun = (body: unknown) =>
  app
    .request()
    .post('/api/v1/runs')
    .send(body as object);
const readRun = (id: string) => app.request().get(`/api/v1/runs/${id}`);
const listRuns = (query: Record<string, unknown> = {}) =>
  app.request().get('/api/v1/runs').query(query);
const stopRun = (id: string) => app.request().post(`/api/v1/runs/${id}/stop`);
const deleteRun = (id: string) => app.request().delete(`/api/v1/runs/${id}`);
const bulkDelete = (body: unknown) =>
  app
    .request()
    .post('/api/v1/runs/delete')
    .send(body as object);

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

const ids = (runs: Array<{ id: string }>) => runs.map((run) => run.id);

/** Seeds runs one minute apart, oldest first, so the newest-first order is certain. */
async function seedRuns(specs: Array<Pick<Run, 'type' | 'status'>>): Promise<Run[]> {
  const start = Date.UTC(2026, 0, 1);
  const seeded: Run[] = [];
  for (const [index, spec] of specs.entries()) {
    seeded.push(await app.seedRun({ ...spec, createdAt: new Date(start + index * 60_000) }));
  }
  return seeded;
}

describe('a run, from creation to deletion', () => {
  it('is created, read, listed, stopped and deleted', async () => {
    // Create: queued, with the limits and flow left out filled in. One virtual user for a
    // minute, so k6 barely touches the target before the stop below.
    const payload = longRunPayload({ type: 'stress' });
    const created = await createRun(payload);
    expect(created.status).toBe(202);
    const { id } = created.body.run;
    expect(created.body.run).toMatchObject({
      id: expect.any(String),
      type: 'stress',
      baseUrl: TARGET_BASE_URL,
      status: 'queued',
      stages: payload.stages,
      limits: { ...DEFAULT_LIMITS, ...PASSING_LIMITS, thinkTimeSeconds: 0 },
      flow: DEFAULT_FLOW,
      exitCode: null,
      summary: null,
      errorMessage: null,
      startedAt: null,
      finishedAt: null,
    });

    // Read: the same run, with no points yet.
    const read = await readRun(id);
    expect(read.status).toBe(200);
    expect(read.body.run).toMatchObject({ id, type: 'stress', createdAt: expect.any(String) });
    const points = await app.request().get(`/api/v1/runs/${id}/points`);
    expect(points.status).toBe(200);
    expect(points.body).toEqual({ points: [] });

    // List: on the first page, and among the active runs.
    const listed = await listRuns();
    expect(listed.body).toMatchObject({ total: 1, page: 1, pageSize: 10 });
    expect(ids(listed.body.runs)).toEqual([id]);
    expect(ids((await listRuns({ active: 'true' })).body.runs)).toEqual([id]);
    expect(ids((await listRuns({ type: 'load' })).body.runs)).toEqual([]);

    // Stop: accepted while queued or running; the run ends as stopped.
    const stopped = await stopRun(id);
    expect(stopped.status).toBe(202);
    expect(stopped.body.run.id).toBe(id);
    await app.service.waitForIdle();
    const afterStop = (await readRun(id)).body.run;
    expect(afterStop).toMatchObject({ status: 'stopped', errorMessage: null });
    expect(afterStop.finishedAt).not.toBeNull();
    expect((await listRuns({ active: 'true' })).body.total).toBe(0);

    // Delete: gone from reads and the list.
    const deleted = await deleteRun(id);
    expect(deleted.status).toBe(204);
    expect(deleted.text).toBe('');
    expect((await readRun(id)).status).toBe(404);
    expect((await listRuns()).body).toEqual({ runs: [], total: 0, page: 1, pageSize: 10 });
  });
});

describe('POST /api/v1/runs', () => {
  describe('accepted runs', () => {
    it.each(['load', 'stress', 'spike'] as const)(
      'queues a %s run with its default stages',
      async (type) => {
        const response = await createRun(runPayload({ type }));

        expect(response.status).toBe(202);
        expect(response.body.run).toMatchObject({
          type,
          status: 'queued',
          stages: DEFAULT_STAGES[type],
        });
      },
    );

    it('stores custom stages, limits and flow', async () => {
      const custom = {
        stages: [
          { duration: '1m30s', target: 5 },
          { duration: '500ms', target: 0 },
        ],
        thinkTimeSeconds: 0.5,
        maxErrorRate: 0,
        latencyLimitsMs: { p50: 1, p90: 2, p95: 3, p99: 4 },
        flow: [
          flowStep({
            name: 'Login',
            method: 'POST',
            path: '/api/users/token/login',
            headers: { 'Content-Type': 'application/json' },
            body: '{"username": "user{{vu}}", "id": "{{uuid}}"}',
            extract: [{ name: 'token', path: 'token' }],
            wait: { minSeconds: 1, maxSeconds: 2.5 },
          }),
          flowStep({
            name: 'Ratings',
            path: '/api/ratings',
            headers: { Authorization: 'Token {{token}}' },
            expectedStatus: 204,
          }),
        ],
      };

      const response = await createRun(runPayload(custom));

      expect(response.status).toBe(202);
      expect(response.body.run).toMatchObject({
        stages: custom.stages,
        // Authorization is a secret header: stored, returned redacted.
        flow: [custom.flow[0], { ...custom.flow[1], headers: { Authorization: '[redacted]' } }],
        limits: {
          thinkTimeSeconds: 0.5,
          maxErrorRate: 0,
          latencyLimitsMs: custom.latencyLimitsMs,
        },
      });
    });

    it('stores secret headers but never returns them', async () => {
      const headers = {
        Authorization: 'Bearer s3cret',
        'X-Api-Key': 'k3y',
        'Private-Token': 't0k3n',
        Cookie: 'session=abc',
        'X-Trace': 'keep',
      };
      const flow = [flowStep({ headers })];
      const redacted = {
        Authorization: '[redacted]',
        'X-Api-Key': '[redacted]',
        'Private-Token': '[redacted]',
        Cookie: '[redacted]',
        'X-Trace': 'keep',
      };

      const created = await createRun(runPayload({ flow }));
      const { id } = created.body.run;

      expect(created.body.run.flow[0].headers).toEqual(redacted);
      expect((await readRun(id)).body.run.flow[0].headers).toEqual(redacted);
      expect((await listRuns()).body.runs[0].flow[0].headers).toEqual(redacted);
      // k6 still needs the real values: the row keeps them.
      expect((await app.repository.findById(id))?.flow[0]?.headers).toEqual(headers);
    });

    it('fills limits left out with the defaults', async () => {
      const response = await createRun(runPayload({ maxErrorRate: 0.2 }));

      expect(response.body.run.limits).toEqual({ ...DEFAULT_LIMITS, maxErrorRate: 0.2 });
    });

    it('ignores fields the client may not set', async () => {
      const response = await createRun(
        runPayload({ status: 'passed', exitCode: 0, id: '00000000-0000-4000-8000-000000000000' }),
      );

      expect(response.status).toBe(202);
      expect(response.body.run.status).toBe('queued');
      expect(response.body.run.exitCode).toBeNull();
      expect(response.body.run.id).not.toBe('00000000-0000-4000-8000-000000000000');
    });

    it('accepts stages that last exactly 60 minutes', async () => {
      const response = await createRun(runPayload({ stages: [{ duration: '1h', target: 1 }] }));

      expect(response.status).toBe(202);
    });

    it(`accepts ${MAX_STAGES} stages and ${MAX_STEPS} steps`, async () => {
      const response = await createRun(
        runPayload({
          stages: Array.from({ length: MAX_STAGES }, () => ({ duration: '1s', target: 1001 })),
          flow: Array.from({ length: MAX_STEPS }, (_, index) =>
            flowStep({ name: `Step ${index}` }),
          ),
        }),
      );

      expect(response.status).toBe(202);
    });
  });

  describe('concurrency cap', () => {
    it('rejects a 4th run while 3 are in progress', async () => {
      for (let started = 0; started < 3; started += 1) {
        expect((await createRun(longRunPayload())).status).toBe(202);
      }

      const response = await createRun(longRunPayload());

      expect(response.status).toBe(409);
      expectError(response.body, 'TOO_MANY_RUNS');
    });

    it('lets only 3 of 4 parallel requests through', async () => {
      const responses = await Promise.all(
        Array.from({ length: 4 }, () => createRun(longRunPayload())),
      );

      const statuses = responses.map((response) => response.status).sort();
      expect(statuses).toEqual([202, 202, 202, 409]);
    });

    it('frees a slot once a run is stopped', async () => {
      const started = await Promise.all(
        Array.from({ length: 3 }, () => createRun(longRunPayload())),
      );
      const id = started[0]?.body.run.id;
      expect((await stopRun(id)).status).toBe(202);

      // As soon as the run reads as finished, a new run must be accepted: no grace period.
      await expect
        .poll(async () => (await readRun(id)).body.run.status, { timeout: 15_000, interval: 50 })
        .toBe('stopped');
      expect((await createRun(longRunPayload())).status).toBe(202);
    });
  });

  describe('validation', () => {
    const tooLongStages = [{ duration: '1h1s', target: 1 }];
    const tooManyStages = Array.from({ length: MAX_STAGES + 1 }, () => ({
      duration: '1s',
      target: 1,
    }));

    it.each([
      ['an empty body', {}],
      ['a missing type', { baseUrl: TARGET_BASE_URL }],
      ['an unknown type', runPayload({ type: 'soak' })],
      ['a missing base URL', { type: 'load' }],
      ['a base URL that is not a URL', runPayload({ baseUrl: 'quickpizza' })],
      ['a base URL that is not http(s)', runPayload({ baseUrl: 'ftp://quickpizza' })],
      ['credentials in the base URL', runPayload({ baseUrl: 'http://user:secret@quickpizza' })],
      ['an empty stage list', runPayload({ stages: [] })],
      [`more than ${MAX_STAGES} stages`, runPayload({ stages: tooManyStages })],
      ['stages over 60 minutes', runPayload({ stages: tooLongStages })],
      ['a duration without unit', runPayload({ stages: [{ duration: '30', target: 1 }] })],
      ['a negative duration', runPayload({ stages: [{ duration: '-1s', target: 1 }] })],
      [
        'an unsafe integer target',
        runPayload({ stages: [{ duration: '1s', target: Number.MAX_SAFE_INTEGER + 1 }] }),
      ],
      ['a negative target', runPayload({ stages: [{ duration: '1s', target: -1 }] })],
      ['a fractional target', runPayload({ stages: [{ duration: '1s', target: 1.5 }] })],
      ['a negative think time', runPayload({ thinkTimeSeconds: -1 })],
      ['an error rate over 1', runPayload({ maxErrorRate: 1.1 })],
      ['a negative error rate', runPayload({ maxErrorRate: -0.1 })],
      ['a latency limit of 0', runPayload({ latencyLimitsMs: { p50: 0, p90: 1, p95: 1, p99: 1 } })],
      ['a partial latency limit set', runPayload({ latencyLimitsMs: { p50: 100 } })],
      ['a type of the wrong JSON type', runPayload({ type: 1 })],
      ['a JSON array body', [runPayload()]],
    ])('returns 400 VALIDATION for %s', async (_label, body) => {
      const response = await createRun(body);

      expect(response.status).toBe(400);
      expectError(response.body, 'VALIDATION');
      expect(response.body.error.message).toBe('Invalid body');
      expect(response.body.error.details).toEqual(expect.any(Array));
    });

    it.each([
      ['an empty flow', []],
      [
        `more than ${MAX_STEPS} steps`,
        Array.from({ length: MAX_STEPS + 1 }, (_, index) => flowStep({ name: `Step ${index}` })),
      ],
      ['a blank step name', [flowStep({ name: '   ' })]],
      ['an unknown method', [flowStep({ method: 'TRACE' as 'GET' })]],
      ['duplicate step names (any case)', [flowStep({ name: 'Home' }), flowStep({ name: 'home' })]],
      ['a relative path without /', [flowStep({ path: 'api/pizza' })]],
      ['a full URL that does not parse', [flowStep({ path: 'http://' })]],
      ['credentials in a full URL', [flowStep({ path: 'http://user:secret@quickpizza/x' })]],
      ['an unknown placeholder', [flowStep({ path: '/users/{{userId}}' })]],
      [
        'a placeholder saved only by a later step',
        [
          flowStep({ name: 'Use', path: '/{{token}}' }),
          flowStep({ name: 'Save', extract: [{ name: 'token', path: 'token' }] }),
        ],
      ],
      ['a body that is not JSON', [flowStep({ method: 'POST', body: '{name: pizza}' })]],
      ['an invalid header name', [flowStep({ headers: { 'Bad Header': 'x' } })]],
      ['a line break in a header value', [flowStep({ headers: { 'X-Test': 'a\r\nInjected: 1' } })]],
      [
        'a header name used twice (any case)',
        [flowStep({ headers: { 'X-Test': 'a', 'x-test': 'b' } })],
      ],
      ['an expected status below 100', [flowStep({ expectedStatus: 99 })]],
      ['an expected status above 599', [flowStep({ expectedStatus: 600 })]],
      ['an extract named like a built-in', [flowStep({ extract: [{ name: 'vu', path: 'id' }] })]],
      [
        'an extract name starting with a digit',
        [flowStep({ extract: [{ name: '1id', path: 'id' }] })],
      ],
      ['an extract with an empty path', [flowStep({ extract: [{ name: 'id', path: ' ' }] })]],
      ['a negative wait', [flowStep({ wait: { minSeconds: -1, maxSeconds: 1 } })]],
      ['a wait over 30 seconds', [flowStep({ wait: { minSeconds: 1, maxSeconds: 31 } })]],
      [
        'a longest wait shorter than the shortest wait',
        [flowStep({ wait: { minSeconds: 3, maxSeconds: 1 } })],
      ],
    ])('returns 400 VALIDATION for a flow with %s', async (_label, flow) => {
      const response = await createRun(runPayload({ flow }));

      expect(response.status).toBe(400);
      expectError(response.body, 'VALIDATION');
    });

    it('stores nothing when validation fails', async () => {
      await createRun(runPayload({ type: 'soak' }));

      expect((await listRuns()).body.total).toBe(0);
    });
  });
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
  it('returns the stored outcome of a finished run', async () => {
    const seeded = await app.seedRun({ status: 'failed', exitCode: 99, summary: { metrics: {} } });

    const response = await readRun(seeded.id);

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

describe('GET /api/v1/runs', () => {
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
      const response = await listRuns();

      expect(response.body.total).toBe(5);
      expect(ids(response.body.runs)).toEqual(ids(seeded).reverse());
    });

    it('filters by type', async () => {
      const response = await listRuns({ type: 'load' });

      expect(response.body.total).toBe(3);
      expect(response.body.runs.every((run: Run) => run.type === 'load')).toBe(true);
    });

    it('returns only queued and running runs when active=true', async () => {
      const response = await listRuns({ active: 'true' });

      expect(response.body.runs.map((run: Run) => run.status).sort()).toEqual([
        'queued',
        'running',
      ]);
    });

    it('combines type and active filters', async () => {
      const response = await listRuns({ type: 'load', active: 'true' });

      expect(ids(response.body.runs)).toEqual([seeded[2]?.id]);
    });

    it('treats active=false as no status filter', async () => {
      const response = await listRuns({ active: 'false' });

      expect(response.body.total).toBe(5);
    });

    it('pages through results and keeps the total', async () => {
      const first = await listRuns({ page: 1, pageSize: 2 });
      const last = await listRuns({ page: 3, pageSize: 2 });

      expect(first.body).toMatchObject({ total: 5, page: 1, pageSize: 2 });
      expect(ids(first.body.runs)).toEqual([seeded[4]?.id, seeded[3]?.id]);
      expect(ids(last.body.runs)).toEqual([seeded[0]?.id]);
    });

    it('returns an empty page past the end, with the real total', async () => {
      const response = await listRuns({ page: 99 });

      expect(response.body).toEqual({ runs: [], total: 5, page: 99, pageSize: 10 });
    });

    it('accepts the largest page size, 50', async () => {
      const response = await listRuns({ pageSize: 50 });

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
    const response = await listRuns(query);

    expect(response.status).toBe(400);
    expectError(response.body, 'VALIDATION');
    expect(response.body.error.message).toBe('Invalid query');
  });
});

describe('POST /api/v1/runs/:id/stop', () => {
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

  it.each(FINISHED)('returns 409 RUN_NOT_ACTIVE for a %s run', async (status) => {
    const seeded = await app.seedRun({ status });

    const response = await stopRun(seeded.id);

    expect(response.status).toBe(409);
    expectError(response.body, 'RUN_NOT_ACTIVE');
  });

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

describe('DELETE /api/v1/runs/:id', () => {
  it.each(FINISHED)('deletes a %s run and its points', async (status) => {
    const seeded = await app.seedRun({ status });
    await app.repository.addPoints(seeded.id, [point(0)]);

    const response = await deleteRun(seeded.id);

    expect(response.status).toBe(204);
    expect((await readRun(seeded.id)).status).toBe(404);
    expect(await app.repository.listPoints(seeded.id)).toEqual([]);
  });

  it.each(['queued', 'running'] as const)(
    'returns 409 RUN_IN_PROGRESS for a %s run and keeps it',
    async (status) => {
      const seeded = await app.seedRun({ status });

      const response = await deleteRun(seeded.id);

      expect(response.status).toBe(409);
      expectError(response.body, 'RUN_IN_PROGRESS');
      expect((await readRun(seeded.id)).status).toBe(200);
    },
  );

  it('returns 404 RUN_NOT_FOUND for an unknown id', async () => {
    const response = await deleteRun(randomUUID());

    expect(response.status).toBe(404);
    expectError(response.body, 'RUN_NOT_FOUND');
  });

  it('returns 404 RUN_NOT_FOUND once the run is deleted', async () => {
    const seeded = await app.seedRun();
    await deleteRun(seeded.id);

    expect((await deleteRun(seeded.id)).status).toBe(404);
  });

  it('returns 400 VALIDATION for an id that is not a UUID', async () => {
    const response = await deleteRun('not-a-uuid');

    expect(response.status).toBe(400);
    expectError(response.body, 'VALIDATION');
  });

  it('leaves other runs alone', async () => {
    const [target, other] = [await app.seedRun(), await app.seedRun()];

    await deleteRun(target.id);

    expect((await readRun(other.id)).status).toBe(200);
  });
});

describe('POST /api/v1/runs/delete', () => {
  it('deletes finished runs and skips runs in progress and unknown ids', async () => {
    const passed = await app.seedRun({ status: 'passed' });
    const stopped = await app.seedRun({ status: 'stopped' });
    const running = await app.seedRun({ status: 'running' });
    const unknown = randomUUID();
    await app.repository.addPoints(passed.id, [point(0)]);

    const response = await bulkDelete({ ids: [passed.id, stopped.id, running.id, unknown] });

    expect(response.status).toBe(200);
    expect([...response.body.deleted].sort()).toEqual([passed.id, stopped.id].sort());
    expect([...response.body.skipped].sort()).toEqual([running.id, unknown].sort());
    expect(await app.repository.listPoints(passed.id)).toEqual([]);
    expect((await readRun(running.id)).status).toBe(200);
  });

  it('reports a repeated id once', async () => {
    const seeded = await app.seedRun();

    const response = await bulkDelete({ ids: [seeded.id, seeded.id, seeded.id] });

    expect(response.body).toEqual({ deleted: [seeded.id], skipped: [] });
  });

  it('skips everything when no id matches', async () => {
    const unknown = [randomUUID(), randomUUID()];

    const response = await bulkDelete({ ids: unknown });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ deleted: [], skipped: unknown });
  });

  it(`accepts ${MAX_BULK_DELETE} ids`, async () => {
    const response = await bulkDelete({
      ids: Array.from({ length: MAX_BULK_DELETE }, () => randomUUID()),
    });

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
