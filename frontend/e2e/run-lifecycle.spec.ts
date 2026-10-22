// Real k6 runs, started and controlled from the UI.
import { expect, openApp, test } from './fixtures.ts';
import { setLooseLimits, setSingleStage, startRun } from './run-form.ts';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('a run within its limits passes and shows its numbers', async ({ page }) => {
  await setSingleStage(page, '1s');
  await setLooseLimits(page);

  await startRun(page);

  const detail = page.getByTestId('run-detail');
  await expect(page.getByTestId('run-row')).toHaveCount(1);
  await expect(detail).toHaveAttribute('data-status', 'passed');
  await expect(page.getByTestId('toast-run-passed')).toBeVisible();
  await expect(page.getByTestId('run-summary')).toBeVisible();
  await expect(page.getByTestId('run-row')).toHaveAttribute('data-status', 'passed');
});

test('a run with a random wait after a step passes', async ({ page }) => {
  await page.getByTestId('panel-tab-flow').click();
  await page.getByTestId('step-wait-min').fill('.1');
  await page.getByTestId('step-wait-max').fill('0,3');
  await setSingleStage(page, '1s');
  await setLooseLimits(page);
  const post = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/api/v1/runs'),
  );

  await startRun(page);

  const body = (await post).postDataJSON() as { flow: { wait?: unknown }[] };
  expect(body.flow[0]?.wait).toEqual({ minSeconds: 0.1, maxSeconds: 0.3 });
  await expect(page.getByTestId('run-detail')).toHaveAttribute('data-status', 'passed');
});

test('a rate run sends its rate and VU cap and passes', async ({ page }) => {
  await setSingleStage(page, '2s');
  await page.getByTestId('load-mode-rate').click();
  await page.getByTestId('max-virtual-users').fill('2');
  await setLooseLimits(page);
  const post = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/api/v1/runs'),
  );

  await startRun(page);

  const body = (await post).postDataJSON() as { mode: string; maxVirtualUsers: number };
  expect(body).toMatchObject({ mode: 'rate', maxVirtualUsers: 2 });
  await expect(page.getByTestId('run-detail')).toHaveAttribute('data-status', 'passed');
  await expect(page.getByTestId('run-rate-cap')).toBeVisible();
  await expect(page.getByTestId('run-peak')).toHaveText('1/s');
});

test('a rate run that cannot keep its rate fails and shows the dropped runs', async ({ page }) => {
  await setSingleStage(page, '2s');
  await page.getByTestId('stage-0-target').fill('20');
  await page.getByTestId('load-mode-rate').click();
  await page.getByTestId('max-virtual-users').fill('1');
  await setLooseLimits(page);
  await page.getByTestId('think-time').fill('1');

  await startRun(page);

  await expect(page.getByTestId('run-detail')).toHaveAttribute('data-status', 'failed');
  await expect(page.getByTestId('run-dropped')).toBeVisible();
  await page.getByTestId('chart-tab-load').click();
  const chart = page.getByTestId('rate-chart');
  await expect(chart).toContainText('Planned');
  await expect(chart).toContainText('Dropped');
});

test('refuses a VU cap below 1 without starting a run', async ({ page }) => {
  await page.getByTestId('panel-tab-shape').click();
  await page.getByTestId('load-mode-rate').click();
  await page.getByTestId('max-virtual-users').fill('0');

  await page.getByTestId('start-run').click();

  await expect(page.getByTestId('max-virtual-users-error')).toBeVisible();
  await expect(page.getByTestId('run-row')).toHaveCount(0);
});

test('a failed run shows a sample of the failed responses', async ({ page }) => {
  await page.getByTestId('panel-tab-flow').click();
  await page.getByTestId('step-expected-status').fill('418');
  await setSingleStage(page, '1s');
  await setLooseLimits(page);

  await startRun(page);

  await expect(page.getByTestId('run-detail')).toHaveAttribute('data-status', 'failed');
  await expect(page.getByTestId('run-failure')).toHaveCount(1);
  await expect(page.getByTestId('run-failure')).toContainText('status 200, expected 418');
});

test('a run sends the grace period from the Limits tab', async ({ page }) => {
  await setSingleStage(page, '1s');
  await setLooseLimits(page);
  await page.getByTestId('grace-period').fill('5');
  const post = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/api/v1/runs'),
  );

  await startRun(page);

  const body = (await post).postDataJSON() as { gracePeriodSeconds: number };
  expect(body.gracePeriodSeconds).toBe(5);
  await expect(page.getByTestId('run-detail')).toHaveAttribute('data-status', 'passed');
});

test('refuses an empty grace period without starting a run', async ({ page }) => {
  await page.getByTestId('panel-tab-limits').click();
  await page.getByTestId('grace-period').fill('');

  await page.getByTestId('start-run').click();

  await expect(page.getByTestId('grace-period-error')).toBeVisible();
  await expect(page.getByTestId('run-row')).toHaveCount(0);
});

test('a run in progress can be stopped after a confirm', async ({ page }) => {
  await setSingleStage(page, '1m');
  await setLooseLimits(page);
  await startRun(page);
  const detail = page.getByTestId('run-detail');
  await expect(detail).toHaveAttribute('data-status', /queued|running/);

  await page.getByTestId('run-stop').click();
  await page.getByTestId('run-action-confirm').click();

  await expect(detail).toHaveAttribute('data-status', 'stopped');
  await expect(page.getByTestId('toast-run-stopped')).toBeVisible();
  await expect(page.getByTestId('run-delete')).toBeVisible();
});
