// With ALLOW_PRIVATE_TARGETS=false, runs cannot be aimed at this network: literal private hosts are
// refused before the run starts, hosts that resolve to a private address are refused by k6.
import { lookup } from 'node:dns/promises';
import { describe, expect, it } from 'vitest';
import { PRIVATE_TARGET_MESSAGE } from '../src/modules/runs/targets.ts';
import { flowStep, longRunPayload, runPayload } from './helpers/payloads.ts';
import { expectError, useTestApp } from './helpers/test-app.ts';

const app = useTestApp({ allowPrivateTargets: () => false });

const createRun = (body: Record<string, unknown>) => app.request().post('/api/v1/runs').send(body);

// nip.io answers 127.0.0.1.nip.io with 127.0.0.1: a public name for a private address, which
// only k6 can see once it resolves it. Skipped offline or behind a resolver that drops private
// answers (DNS rebinding protection).
const nipHost = '127.0.0.1.nip.io';
const nipResolves = await Promise.race([
  lookup(nipHost, { family: 4 }).then(({ address }) => address === '127.0.0.1'),
  new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000).unref()),
]).catch(() => false);
if (!nipResolves) console.warn(`${nipHost} does not resolve to 127.0.0.1: DNS test skipped`);

describe('POST /api/v1/runs with private targets blocked', () => {
  it.each([
    ['localhost', 'http://localhost:10001'],
    ['localhost as a fully qualified name', 'http://localhost.:10001'],
    ['a *.localhost name', 'http://api.localhost'],
    ['a *.internal name', 'http://metadata.internal'],
    ['loopback', 'http://127.0.0.1:10001'],
    ['a 10/8 address', 'http://10.1.2.3'],
    ['a 172.16/12 address', 'http://172.31.255.254'],
    ['a 192.168/16 address', 'http://192.168.1.1'],
    ['link-local (cloud metadata)', 'http://169.254.169.254/latest/meta-data'],
    ['a carrier-grade NAT address', 'http://100.100.1.1'],
    ['IPv6 loopback', 'http://[::1]:10001'],
    ['the IPv6 unspecified address', 'http://[::]:10001'],
    ['an IPv6 unique local address', 'http://[fd12:3456::1]'],
    ['an IPv6 link-local address', 'http://[fe80::1]'],
    ['an IPv4-mapped IPv6 address', 'http://[::ffff:127.0.0.1]'],
    ['a NAT64 address of a private IPv4', 'http://[64:ff9b::a00:1]'],
    ['a decimal IPv4 address', 'http://2130706433'],
  ])('returns 400 TARGET_NOT_ALLOWED for %s as base URL', async (_label, baseUrl) => {
    const response = await createRun(runPayload({ baseUrl }));

    expect(response.status).toBe(400);
    expectError(response.body, 'TARGET_NOT_ALLOWED');
    expect(response.body.error.message).toContain(PRIVATE_TARGET_MESSAGE);
    expect(response.body.error.details).toEqual({ host: new URL(baseUrl).hostname });
  });

  it('returns 400 TARGET_NOT_ALLOWED for a step whose full URL is private', async () => {
    const flow = [flowStep({ name: 'Inside', path: 'http://10.0.0.1/admin' })];
    const response = await createRun(runPayload({ baseUrl: 'http://example.com', flow }));

    expect(response.status).toBe(400);
    expectError(response.body, 'TARGET_NOT_ALLOWED');
  });

  it('accepts a step whose host is a placeholder: k6 checks it once filled', async () => {
    const flow = [
      flowStep({ name: 'Pick', extract: [{ name: 'tenant', path: 'tenant' }] }),
      flowStep({ name: 'Tenant', path: 'https://{{tenant}}.example.com/health' }),
    ];
    const response = await createRun(runPayload({ baseUrl: 'http://example.com', flow }));

    expect(response.status).toBe(202);
  });

  it('stores nothing when the target is refused', async () => {
    await createRun(runPayload({ baseUrl: 'http://localhost:10001' }));

    expect((await app.request().get('/api/v1/runs')).body.total).toBe(0);
  });

  // No request reaches the address: k6 refuses it before connecting, and the run aborts at once
  // instead of spinning for its whole duration.
  it.runIf(nipResolves)(
    'aborts a run as error when the host resolves to a private address',
    async () => {
      const started = Date.now();
      const created = await createRun(
        longRunPayload({
          baseUrl: `http://${nipHost}:10001`,
          stages: [{ duration: '30s', target: 2 }],
        }),
      );
      expect(created.status).toBe(202);

      await app.service.waitForIdle();
      const { run } = (await app.request().get(`/api/v1/runs/${created.body.run.id}`)).body;

      expect(run).toMatchObject({
        status: 'error',
        exitCode: 108,
        errorMessage: PRIVATE_TARGET_MESSAGE,
      });
      expect(Date.now() - started).toBeLessThan(15_000);
    },
  );
});
