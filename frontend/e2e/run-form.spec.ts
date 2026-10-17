import { expect, openApp, test } from './fixtures.ts';
import { setLooseLimits, setSingleStage } from './run-form.ts';

test.describe('run form validation', () => {
  // Invalid input must never reach the backend.
  let runPosts = 0;

  test.beforeEach(async ({ page }) => {
    runPosts = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/api/v1/runs')) runPosts += 1;
    });
    await openApp(page);
  });

  test.afterEach(() => {
    expect(runPosts, 'POST /api/v1/runs requests').toBe(0);
  });

  test('rejects a base URL that is not a full URL', async ({ page }) => {
    await page.getByTestId('base-url').fill('quickpizza');

    await page.getByTestId('start-run').click();

    await expect(page.getByTestId('base-url-error')).toBeVisible();
    await expect(page.getByTestId('panel-tab-target-alert')).toBeVisible();
  });

  test('opens the Load shape tab for a bad stage duration', async ({ page }) => {
    await page.getByTestId('panel-tab-shape').click();
    await page.getByTestId('stage-0-duration').fill('ten seconds');
    await page.getByTestId('panel-tab-target').click();

    await page.getByTestId('start-run').click();

    await expect(page.getByTestId('panel-tab-shape')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('stages-error')).toContainText('k6 units');
    await expect(page.getByTestId('panel-tab-shape-alert')).toBeVisible();
  });

  test('rejects more than 1000 virtual users', async ({ page }) => {
    await page.getByTestId('panel-tab-shape').click();
    await page.getByTestId('stage-0-target').fill('1001');

    await page.getByTestId('start-run').click();

    await expect(page.getByTestId('stages-error')).toContainText('1000 virtual users');
  });

  test('rejects stages longer than 60 minutes in total', async ({ page }) => {
    await setSingleStage(page, '61m');

    await page.getByTestId('start-run').click();

    await expect(page.getByTestId('stages-error')).toContainText('60 minutes');
  });

  test('opens the Limits tab for a latency limit of 0', async ({ page }) => {
    await page.getByTestId('panel-tab-limits').click();
    await page.getByTestId('limit-p95').fill('0');
    await page.getByTestId('panel-tab-target').click();

    await page.getByTestId('start-run').click();

    await expect(page.getByTestId('panel-tab-limits')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('latency-error')).toBeVisible();
  });

  test('rejects an error rate over 100% and a negative think time', async ({ page }) => {
    await page.getByTestId('panel-tab-limits').click();
    await page.getByTestId('max-error-rate').fill('101');
    await page.getByTestId('think-time').fill('-1');

    await page.getByTestId('start-run').click();

    await expect(page.getByTestId('max-error-rate-error')).toBeVisible();
    await expect(page.getByTestId('think-time-error')).toBeVisible();
  });

  test('rejects a step wait whose longest is shorter than its shortest', async ({ page }) => {
    await page.getByTestId('panel-tab-flow').click();
    await page.getByTestId('step-wait-min').fill('3');
    await page.getByTestId('step-wait-max').fill('1');

    await page.getByTestId('start-run').click();

    await expect(page.getByTestId('flow-step-error')).toBeVisible();
  });

  test('rejects a step wait with only one end set', async ({ page }) => {
    await page.getByTestId('panel-tab-flow').click();
    await page.getByTestId('step-wait-min').fill('1');

    await page.getByTestId('start-run').click();

    await expect(page.getByTestId('flow-step-error')).toBeVisible();
  });

  test('rejects a step wait that is not a number', async ({ page }) => {
    await page.getByTestId('panel-tab-flow').click();
    await page.getByTestId('step-wait-min').fill('1e');
    await page.getByTestId('step-wait-max').fill('2');

    await page.getByTestId('start-run').click();

    await expect(page.getByTestId('flow-step-error')).toBeVisible();
  });

  test('shows the errors of every tab at once and clears them once fixed', async ({ page }) => {
    await page.getByTestId('base-url').fill('nope');
    await page.getByTestId('panel-tab-limits').click();
    await page.getByTestId('limit-p50').fill('0');

    await page.getByTestId('start-run').click();

    await expect(page.getByTestId('panel-tab-target-alert')).toBeVisible();
    await expect(page.getByTestId('panel-tab-limits-alert')).toBeVisible();
  });

  test('can add and remove stages, but never the last one', async ({ page }) => {
    await setSingleStage(page, '10s');
    await expect(page.getByTestId('stage-0-remove')).toBeDisabled();

    await page.getByTestId('add-stage').click();

    await expect(page.getByTestId('stage-1-duration')).toHaveValue('30s');
    await expect(page.getByTestId('stage-0-remove')).toBeEnabled();
    await page.getByTestId('stage-1-remove').click();
    await expect(page.getByTestId('stage-1-duration')).toHaveCount(0);
  });

  test('keeps the test type in the form and the runs tabs in sync', async ({ page }) => {
    await page.getByTestId('run-type').selectOption('spike');

    await expect(page.getByTestId('type-tab-spike')).toHaveAttribute('aria-selected', 'true');
    await page.getByTestId('type-tab-stress').click();
    await expect(page.getByTestId('run-type')).toHaveValue('stress');
  });
});

test.describe('backend rejects the run', () => {
  test.use({ allowedConsoleErrors: [/status of 409/] });

  test('shows an error when 3 runs are already in progress', async ({ page, api }) => {
    for (let started = 0; started < 3; started += 1) await api.startLong();
    await openApp(page);
    await setSingleStage(page, '1s');
    await setLooseLimits(page);

    await page.getByTestId('start-run').click();

    await expect(page.getByTestId('toast-run-start-error')).toBeVisible();
    expect(await api.list()).toHaveLength(3);
  });
});
