// Real k6 runs against the demo app (QuickPizza) from the local stack.
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import supertest from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { RunsService } from '../src/modules/runs/service.ts';
import { flowStep, longRunPayload, shortRunPayload, soapStep } from './helpers/payloads.ts';
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

    expect(run).toMatchObject({
      status: 'passed',
      exitCode: 0,
      errorMessage: null,
      stoppedEarly: false,
    });
    expect(run.summary).toHaveProperty('metrics');
    expect(new Date(run.startedAt).getTime()).toBeLessThanOrEqual(
      new Date(run.finishedAt).getTime(),
    );
    const { points } = (await app.request().get(`/api/v1/runs/${run.id}/points`)).body;
    expect(points.length).toBeGreaterThan(0);
    expect(points[0]).toMatchObject({ runId: run.id, second: expect.any(Number) });
  });

  it('stops a run early once a limit breaks, with stop on limit on', async () => {
    const plannedSeconds = 60;
    const run = await runToEnd(
      shortRunPayload({
        stages: [{ duration: `${plannedSeconds}s`, target: 1 }],
        // Every request gets a 404 where 200 is expected, so limits break from the start.
        flow: [flowStep({ path: '/no-such-page' })],
        stopOnLimit: true,
      }),
    );

    expect(run).toMatchObject({
      status: 'failed',
      exitCode: 99,
      errorMessage: null,
      stoppedEarly: true,
    });
    expect(run.summary.metrics.checks.value).toBe(0);
    const elapsedSeconds =
      (new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000;
    expect(elapsedSeconds).toBeLessThan(plannedSeconds - 10);
  }, 90_000);

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
    expect(run).toMatchObject({
      status: 'passed',
      exitCode: 0,
      errorMessage: null,
      stoppedEarly: false,
    });
  });

  it('passes a rate run that starts flow runs per second up to its VU cap', async () => {
    const run = await runToEnd(
      shortRunPayload({
        mode: 'rate',
        maxVirtualUsers: 2,
        stages: [{ duration: '2s', target: 4 }],
      }),
    );

    expect(run).toMatchObject({
      status: 'passed',
      exitCode: 0,
      errorMessage: null,
      stoppedEarly: false,
    });
    // 0 → 4 runs per second over 2 s is about 4 flow runs.
    expect(run.summary.metrics.iterations.count).toBeGreaterThan(0);
    expect(run.summary.metrics.vus_max.max).toBe(2);
  });

  it('runs a rate below 1 flow run per second', async () => {
    // 0.5 per second, held for 8 s after a 1 s ramp: about 4 flow runs.
    const run = await runToEnd(
      shortRunPayload({
        mode: 'rate',
        maxVirtualUsers: 2,
        stages: [
          { duration: '1s', target: 0.5 },
          { duration: '8s', target: 0.5 },
        ],
      }),
    );

    expect(run).toMatchObject({ status: 'passed', exitCode: 0 });
    expect(run.summary.metrics.iterations.count).toBeGreaterThanOrEqual(3);
    expect(run.summary.metrics.iterations.count).toBeLessThanOrEqual(6);
  });

  it('fails a rate run that drops more flow runs than the error limit allows', async () => {
    // 0 → 20 runs per second plans 20 runs; 1 VU with 1 s think time manages about 2.
    const run = await runToEnd(
      shortRunPayload({
        mode: 'rate',
        maxVirtualUsers: 1,
        thinkTimeSeconds: 1,
        stages: [{ duration: '2s', target: 20 }],
      }),
    );

    expect(run).toMatchObject({ status: 'failed', exitCode: 99, errorMessage: null });
    expect(run.summary.metrics.dropped_iterations.count).toBeGreaterThan(10);
    // The per-second points show the finished and the dropped flow runs too.
    const { points } = (await app.request().get(`/api/v1/runs/${run.id}/points`)).body;
    const total = (key: string) =>
      points.reduce((sum: number, point: Record<string, number>) => sum + (point[key] ?? 0), 0);
    expect(total('iterationsPerSecond')).toBeGreaterThan(0);
    // Samples that reach the CSV after their second is stored are skipped, so at most the total.
    expect(total('droppedPerSecond')).toBeGreaterThan(0);
    expect(total('droppedPerSecond')).toBeLessThanOrEqual(
      run.summary.metrics.dropped_iterations.count,
    );
  });

  it('cuts flow runs off after the grace period once the stages end', async () => {
    // Each flow run waits 20 s after its request; with no grace k6 stops when the 3 s of stages
    // end, where the default 30 s grace would wait about 20 s for the flow run to finish.
    const run = await runToEnd(
      shortRunPayload({
        stages: [
          { duration: '1s', target: 1 },
          { duration: '2s', target: 1 },
        ],
        thinkTimeSeconds: 20,
        gracePeriodSeconds: 0,
      }),
    );

    const seconds = (Date.parse(run.finishedAt) - Date.parse(run.startedAt)) / 1000;
    expect(run.limits.gracePeriodSeconds).toBe(0);
    expect(seconds).toBeLessThan(12);
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

  it('stores a sample of failed responses with their status and body', async () => {
    const run = await runToEnd(
      shortRunPayload({
        flow: [flowStep({ name: 'Home', expectedStatus: 418 })],
      }),
    );

    // Home fails every time with the same 200 page: one distinct sample.
    const home = run.failures.filter((failure: { step: string }) => failure.step === 'Home');
    expect(home).toHaveLength(1);
    expect(home[0]).toMatchObject({ reason: 'status', status: 200 });
    // A 200 may hold tokens, so its body is not stored; the home page is HTML, so no keys either.
    expect(home[0].body).toMatch(/^\(not JSON, \d+ characters\)$/);
  });

  it('stores only the JSON keys of a step whose value to save is missing', async () => {
    const run = await runToEnd(
      shortRunPayload({
        flow: [
          flowStep({
            name: 'Login',
            method: 'POST',
            path: '/api/users/token/login',
            body: '{"username": "default", "password": "12345678"}',
            extract: [{ name: 'missing', path: 'no.such.field' }],
          }),
        ],
      }),
    );

    expect(run.failures).toEqual([
      // The login worked: its token must not be stored, only the shape of the body.
      { step: 'Login', reason: 'extract', status: 200, body: '{"token":"<string>"}' },
    ]);
  });

  describe('with SOAP steps', () => {
    // A token with XML special characters (a&b<c): k6 must decode it and escape it again, or
    // the Order body would hold a&amp;amp;b... instead.
    const ESCAPED_TOKEN = 'a&amp;b&lt;c';
    const envelope = (content: string) =>
      `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${content}</soap:Body></soap:Envelope>`;
    const received: { path: string; contentType: string; body: string }[] = [];
    let server: Server;
    let baseUrl: string;

    async function readBody(request: IncomingMessage): Promise<string> {
      let body = '';
      for await (const chunk of request) body += String(chunk);
      return body;
    }

    // Responses come with an XML declaration only when the step asks (X-Prolog): one that
    // starts with its root tag once broke k6's tag regex.
    // A SOAP service: Login answers a token; Order accepts only that token, escaped.
    beforeAll(async () => {
      server = createServer((request, response) => {
        void readBody(request).then((body) => {
          const contentType = request.headers['content-type'] ?? '';
          received.push({ path: request.url ?? '', contentType, body });
          const isXml = contentType.startsWith('text/xml');
          const ok =
            request.url === '/login'
              ? isXml && body.includes('<User>user-')
              : isXml && body.includes(`<Token>${ESCAPED_TOKEN}</Token>`);
          const content =
            request.url === '/login'
              ? `<LoginResponse><Token>${ESCAPED_TOKEN}</Token><session>s-1</session></LoginResponse>`
              : '<OrderResponse><Id>7</Id></OrderResponse>';
          response.writeHead(ok ? 200 : 500, { 'Content-Type': 'text/xml; charset=utf-8' });
          const prolog = request.headers['x-prolog'] ? '<?xml version="1.0"?>' : '';
          response.end(prolog + envelope(ok ? content : '<soap:Fault/>'));
        });
      });
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    afterAll(async () => {
      await new Promise((resolve) => server.close(resolve));
    });

    it('sends XML bodies and saves values from XML responses', async () => {
      received.length = 0;
      const run = await runToEnd(
        shortRunPayload({
          baseUrl,
          flow: [
            soapStep(envelope('<Login><User>user-{{shortId}}</User></Login>'), {
              name: 'Login',
              path: '/login',
              extract: [
                { name: 'token', path: 'LoginResponse.Token' },
                { name: 'session', path: 'session' },
              ],
            }),
            soapStep(envelope('<Order><Token>{{token}}</Token></Order>'), {
              name: 'Order',
              path: '/order',
            }),
          ],
        }),
      );

      // A wrong token or content type gets a 500, which fails the status check: exit code 99.
      expect(run).toMatchObject({
        status: 'passed',
        exitCode: 0,
        errorMessage: null,
        stoppedEarly: false,
      });
      expect(received.some((request) => request.path === '/order')).toBe(true);
      expect(received[0]?.contentType).toBe('text/xml; charset=utf-8');
    });

    it('stores only the element names of a SOAP step whose value to save is missing', async () => {
      const run = await runToEnd(
        shortRunPayload({
          baseUrl,
          flow: [
            soapStep(envelope('<Login><User>user-{{shortId}}</User></Login>'), {
              name: 'Login',
              path: '/login',
              headers: { 'X-Prolog': '1' },
              extract: [{ name: 'missing', path: 'LoginResponse.Session' }],
            }),
          ],
        }),
      );

      expect(run.failures).toEqual([
        {
          step: 'Login',
          reason: 'extract',
          status: 200,
          body: '<Envelope><Body><LoginResponse><Token/><session/></LoginResponse></Body></Envelope>',
        },
      ]);
    });
  });

  it('stores no failures for a run where every step passes', async () => {
    const run = await runToEnd(shortRunPayload());

    expect(run.failures).toEqual([]);
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
