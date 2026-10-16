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

test('a run over its error limit fails', async ({ page }) => {
  await setSingleStage(page, '1s');
  // 0% allows no errors at all: k6's threshold rate<0 can never hold.
  await setLooseLimits(page, '0');

  await startRun(page);

  await expect(page.getByTestId('run-detail')).toHaveAttribute('data-status', 'failed');
  await expect(page.getByTestId('toast-run-failed')).toBeVisible();
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

test('a run in progress cannot be ticked for bulk delete', async ({ page }) => {
  await setSingleStage(page, '1m');
  await setLooseLimits(page);
  await startRun(page);

  await expect(page.getByTestId('run-row-checkbox')).toBeDisabled();
  await expect(page.getByTestId('select-all-runs')).toBeDisabled();
});
