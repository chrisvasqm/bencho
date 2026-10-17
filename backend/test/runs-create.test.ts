import { describe, expect, it } from 'vitest';
import { DEFAULT_LIMITS, DEFAULT_STAGES } from '../k6/lib/defaults.ts';
import { DEFAULT_FLOW, MAX_STEPS } from '../k6/lib/flow.ts';
import { MAX_STAGES } from '../src/modules/runs/schema.ts';
import { flowStep, longRunPayload, runPayload, TARGET_BASE_URL } from './helpers/payloads.ts';
import { expectError, useTestApp } from './helpers/test-app.ts';

const app = useTestApp();

const createRun = (body: unknown) =>
  app
    .request()
    .post('/api/v1/runs')
    .send(body as object);

describe('POST /api/v1/runs', () => {
  describe('accepted runs', () => {
    it.each(['load', 'stress', 'spike'] as const)(
      'queues a %s run with its default stages, limits and flow',
      async (type) => {
        const response = await createRun(runPayload({ type }));

        expect(response.status).toBe(202);
        expect(response.body.run).toMatchObject({
          id: expect.any(String),
          type,
          baseUrl: TARGET_BASE_URL,
          status: 'queued',
          stages: DEFAULT_STAGES[type],
          limits: DEFAULT_LIMITS,
          flow: DEFAULT_FLOW,
          exitCode: null,
          summary: null,
          errorMessage: null,
          startedAt: null,
          finishedAt: null,
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
        flow: custom.flow,
        limits: {
          thinkTimeSeconds: 0.5,
          maxErrorRate: 0,
          latencyLimitsMs: custom.latencyLimitsMs,
        },
      });
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
          stages: Array.from({ length: MAX_STAGES }, () => ({ duration: '1s', target: 1000 })),
          flow: Array.from({ length: MAX_STEPS }, (_, index) =>
            flowStep({ name: `Step ${index}` }),
          ),
        }),
      );

      expect(response.status).toBe(202);
    });

    it('stores the run so it can be read back', async () => {
      const created = await createRun(runPayload());

      const read = await app.request().get(`/api/v1/runs/${created.body.run.id}`);

      expect(read.status).toBe(200);
      expect(read.body.run.id).toBe(created.body.run.id);
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
      const stopped = await app.request().post(`/api/v1/runs/${id}/stop`);
      expect(stopped.status).toBe(202);

      // As soon as the run reads as finished, a new run must be accepted: no grace period.
      await expect
        .poll(async () => (await app.request().get(`/api/v1/runs/${id}`)).body.run.status, {
          timeout: 15_000,
          interval: 50,
        })
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
      ['an empty stage list', runPayload({ stages: [] })],
      [`more than ${MAX_STAGES} stages`, runPayload({ stages: tooManyStages })],
      ['stages over 60 minutes', runPayload({ stages: tooLongStages })],
      ['a duration without unit', runPayload({ stages: [{ duration: '30', target: 1 }] })],
      ['a negative duration', runPayload({ stages: [{ duration: '-1s', target: 1 }] })],
      ['a target over 1000', runPayload({ stages: [{ duration: '1s', target: 1001 }] })],
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
      ['a wait over 300 seconds', [flowStep({ wait: { minSeconds: 1, maxSeconds: 301 } })]],
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

      const list = await app.request().get('/api/v1/runs');

      expect(list.body.total).toBe(0);
    });
  });
});
