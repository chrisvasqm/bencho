// Every run is a starting point: run it again, change it, or compare it with another.
import { expect, openApp, test } from './fixtures.ts';
import { openNewRun, openTab, setLooseLimits, setSingleStage, startRun } from './run-form.ts';

test('a passed run says that every limit held', async ({ page }) => {
  await openApp(page);
  await openNewRun(page);
  await setSingleStage(page, '1s');
  await setLooseLimits(page);

  await startRun(page);

  await expect(page.getByTestId('run-detail')).toHaveAttribute('data-status', 'passed');
  await expect(page.getByTestId('run-verdict')).toContainText('All limits held');
  await expect(page.getByTestId('run-made-with')).toContainText('errors < 50.00%');
});

test('a failed run names the limit it broke', async ({ page }) => {
  await openApp(page);
  await openNewRun(page);
  // Every request answers 200, not 418: 100% errors, above the 50% that setLooseLimits allows.
  await openTab(page, 'flow');
  await page.getByTestId('step-expected-status').fill('418');
  await setSingleStage(page, '1s');
  await setLooseLimits(page);

  await startRun(page);

  await expect(page.getByTestId('run-detail')).toHaveAttribute('data-status', 'failed');
  await expect(page.getByTestId('run-verdict')).toContainText('errors 100.00%, limit 50.00%');
});

test('Retry starts a run with the same settings after a confirm', async ({ page, api }) => {
  const seeded = await api.seedFinished('stress');
  await openApp(page);
  await expect(page.getByTestId('run-detail')).toHaveAttribute('data-run-id', seeded.id);
  const post = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/api/v1/runs'),
  );

  await page.getByTestId('run-again').click();
  await page.getByTestId('run-again-confirm').click();

  const body = (await post).postDataJSON() as { type: string; stages: unknown[] };
  expect(body).toMatchObject({ type: 'stress', stages: [{ duration: '1m', target: 1 }] });
  await expect(page.getByTestId('toast-run-started')).toBeVisible();
  const rows = page.getByTestId('run-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toHaveAttribute('data-type', 'stress');
  await expect(page.getByTestId('run-detail')).not.toHaveAttribute('data-run-id', seeded.id);
});

test('Reuse opens the form filled from the run', async ({ page, api }) => {
  const seeded = await api.seedFinished('spike');
  await openApp(page);
  await expect(page.getByTestId('run-detail')).toHaveAttribute('data-run-id', seeded.id);

  await page.getByTestId('run-change').click();

  await expect(page.getByTestId('run-type')).toHaveValue('spike');
  await expect(page.getByTestId('stage-0-duration')).toHaveValue('1m');
  await expect(page.getByTestId('stage-1-duration')).toHaveCount(0);
  await expect(page.getByTestId('run-form-card')).toContainText('Settings from the spike run');
});

test('New run starts from the newest run, not from the defaults', async ({ page, api }) => {
  await api.seedFinished('load');
  await api.seedFinished('stress');
  await openApp(page);

  await openNewRun(page);

  await expect(page.getByTestId('run-type')).toHaveValue('stress');
  await expect(page.getByTestId('stage-0-duration')).toHaveValue('1m');
});

test('ticking two runs compares them side by side', async ({ page, api }) => {
  const [older, newer] = await api.seedFinishedMany(2);
  await openApp(page);
  const rows = page.getByTestId('run-row');
  await expect(rows).toHaveCount(2);

  await rows.nth(0).getByTestId('run-row-checkbox').check();
  await rows.nth(1).getByTestId('run-row-checkbox').check();

  const compare = page.getByTestId('run-compare');
  await expect(compare).toHaveAttribute('data-older-id', older!.id);
  await expect(compare).toHaveAttribute('data-newer-id', newer!.id);
  await expect(page.getByTestId('compare-sparklines')).toBeVisible();
  await expect(compare).toContainText('p95');
  await expect(page.getByTestId('run-detail')).toHaveCount(0);

  await page.getByTestId('compare-close').click();

  await expect(compare).toHaveCount(0);
  await expect(page.getByTestId('run-detail')).toHaveAttribute('data-run-id', newer!.id);
});
