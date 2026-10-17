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
