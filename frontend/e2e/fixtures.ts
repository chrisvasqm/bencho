// Shared fixtures: a page that fails on console errors, an API client for setup, and a clean
// database before every test.
import {
  expect,
  test as base,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from '@playwright/test';

export { expect };

type RunType = 'load' | 'stress' | 'spike';
export interface ApiRun {
  id: string;
  type: RunType;
  status: string;
}

const ACTIVE = new Set(['queued', 'running']);

/** Talks to the backend through the frontend's /api proxy, like the app does. */
export class RunsApi {
  private baseUrl?: string;

  constructor(private readonly request: APIRequestContext) {}

  async defaults(): Promise<{ baseUrl: string; stages: Record<RunType, unknown[]> }> {
    return this.json(this.request.get('/api/v1/defaults'));
  }

  async list(query: Record<string, string | number> = {}): Promise<ApiRun[]> {
    const page = await this.json<{ runs: ApiRun[] }>(
      this.request.get('/api/v1/runs', { params: { pageSize: 50, ...query } }),
    );
    return page.runs;
  }

  async get(id: string): Promise<ApiRun> {
    return (await this.json<{ run: ApiRun }>(this.request.get(`/api/v1/runs/${id}`))).run;
  }

  /** Starts a run that lasts a minute, so it stays active until stopped. */
  async startLong(type: RunType = 'load'): Promise<ApiRun> {
    const created = await this.json<{ run: ApiRun }>(
      this.request.post('/api/v1/runs', {
        data: {
          type,
          baseUrl: await this.targetUrl(),
          stages: [{ duration: '1m', target: 1 }],
        },
      }),
    );
    return created.run;
  }

  private async targetUrl(): Promise<string> {
    this.baseUrl ??= (await this.defaults()).baseUrl;
    return this.baseUrl;
  }

  async stop(id: string): Promise<void> {
    const response = await this.request.post(`/api/v1/runs/${id}/stop`);
    // 409: it finished on its own meanwhile, which is just as good.
    if (response.status() !== 202 && response.status() !== 409) {
      throw new Error(`stop ${id}: ${response.status()} ${await response.text()}`);
    }
  }

  async waitUntilFinished(id: string): Promise<void> {
    await expect.poll(async () => ACTIVE.has((await this.get(id)).status)).toBe(false);
  }

  /** A finished (stopped) run, made in well under a second: stopped before k6 starts. */
  async seedFinished(type: RunType = 'load'): Promise<ApiRun> {
    const run = await this.startLong(type);
    await this.stop(run.id);
    await this.waitUntilFinished(run.id);
    return this.get(run.id);
  }

  async seedFinishedMany(count: number, type: RunType = 'load'): Promise<ApiRun[]> {
    const runs: ApiRun[] = [];
    for (let index = 0; index < count; index += 1) runs.push(await this.seedFinished(type));
    return runs;
  }

  /** Stops every active run and deletes all runs. */
  async reset(): Promise<void> {
    const active = await this.list({ active: 'true' });
    for (const run of active) await this.stop(run.id);
    for (const run of active) await this.waitUntilFinished(run.id);
    const ids = (await this.list()).map((run) => run.id);
    if (ids.length > 0) await this.ok(this.request.post('/api/v1/runs/delete', { data: { ids } }));
    expect(await this.list()).toEqual([]);
  }

  private async json<Body>(pending: Promise<APIResponse>): Promise<Body> {
    return (await (await this.ok(pending)).json()) as Body;
  }

  private async ok(pending: Promise<APIResponse>): Promise<APIResponse> {
    const response = await pending;
    if (!response.ok())
      throw new Error(`${response.url()}: ${response.status()} ${await response.text()}`);
    return response;
  }
}

interface Fixtures {
  api: RunsApi;
  /** Console messages matching one of these do not fail the test (expected network errors). */
  allowedConsoleErrors: RegExp[];
}

export const test = base.extend<Fixtures>({
  allowedConsoleErrors: [[], { option: true }],

  api: async ({ request }, use) => {
    const api = new RunsApi(request);
    await api.reset();
    await use(api);
    await api.reset();
  },

  page: async ({ page, allowedConsoleErrors, api }, use) => {
    // `api` first, so every test starts on an empty database.
    void api;
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const { url } = message.location();
      const text = url ? `${message.text()} (${url})` : message.text();
      if (!allowedConsoleErrors.some((pattern) => pattern.test(text))) errors.push(text);
    });
    await use(page);
    expect(errors, 'console errors').toEqual([]);
  },
});

/** Opens the app and waits until the run form has loaded its defaults. */
export async function openApp(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('start-run')).toBeEnabled();
  await expect(page.getByTestId('base-url')).toBeVisible();
}
