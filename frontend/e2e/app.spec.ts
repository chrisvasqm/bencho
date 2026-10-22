import { expect, openApp, test } from './fixtures.ts';
import { openNewRun, openTab } from './run-form.ts';

test.describe('first load', () => {
  test('shows an empty runs list and opens the form with the backend defaults', async ({
    page,
    api,
  }) => {
    const defaults = await api.defaults();

    await openApp(page);

    await expect(page.getByTestId('runs-empty')).toBeVisible();
    await expect(page.getByTestId('pagination-range')).toHaveText('No runs');
    await expect(page.getByTestId('pagination-previous')).toBeDisabled();
    await expect(page.getByTestId('pagination-next')).toBeDisabled();
    await expect(page.getByTestId('run-detail')).toHaveCount(0);
    await expect(page.getByTestId('run-form-drawer')).toHaveCount(0);

    await openNewRun(page);

    await expect(page.getByTestId('base-url')).toHaveValue(defaults.baseUrl);
    await expect(page.getByTestId('run-type')).toHaveValue('load');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('run-form-drawer')).toHaveCount(0);
  });

  test.describe('base URL validation', () => {
    for (const [label, value] of [
      ['a scheme other than http(s)', 'ftp://quickpizza'],
      ['credentials in the URL', 'http://user:secret@quickpizza'],
    ] as const) {
      test(`refuses ${label} without calling the backend`, async ({ page, api }) => {
        await openApp(page);
        await openNewRun(page);
        await page.getByTestId('base-url').fill(value);
        await page.getByTestId('start-run').click();

        await expect(page.getByTestId('base-url-error')).toBeVisible();
        expect(await api.list()).toEqual([]);
      });
    }
  });

  test('shows the default stages of each test type', async ({ page, api }) => {
    const defaults = await api.defaults();
    await openApp(page);
    await openNewRun(page);

    for (const type of ['load', 'stress', 'spike'] as const) {
      await page.getByTestId('run-type').selectOption(type);
      const count = defaults.stages[type].length;
      await expect(page.getByTestId(`stage-${count - 1}-duration`)).toBeVisible();
      await expect(page.getByTestId(`stage-${count}-duration`)).toHaveCount(0);
    }
  });

  test('shows a rough VU estimate and warns when the stages go above it', async ({ page }) => {
    await openApp(page);
    await openNewRun(page);

    await expect(page.getByTestId('capacity-estimate')).toContainText('Rough estimate');
    await page.getByTestId('learn-capacity').click();
    await expect(page.getByTestId('learn-capacity-drawer')).toContainText('Docker Desktop');
    await page.getByTestId('learn-capacity-close').click();
    await expect(page.getByTestId('learn-capacity-drawer')).toHaveCount(0);
    await expect(page.getByTestId('capacity-warning')).toBeEmpty();

    // 1 billion VUs needs petabytes of memory at 5 MB each, so it is above any estimate.
    await page.getByTestId('stage-0-target').fill('1000000000');
    await expect(page.getByTestId('capacity-warning')).toContainText('more than the estimate');
    await expect(page.getByTestId('stages-error')).toHaveCount(0);

    await page.getByTestId('stage-0-target').fill('1');
    await expect(page.getByTestId('capacity-warning')).toBeEmpty();
  });
});

test.describe('stage errors', () => {
  test('brings a stage error into view after the form was scrolled away', async ({ page }) => {
    await openApp(page);
    await openNewRun(page);
    await page.getByTestId('stage-0-duration').fill('abc');
    await openTab(page, 'limits');
    await page.getByTestId('limit-p99').scrollIntoViewIfNeeded();

    await page.getByTestId('start-run').click();

    await expect(page.getByTestId('stages-error')).toBeInViewport();
    await expect(page.getByTestId('run-row')).toHaveCount(0);
  });
});

test.describe('load shape chart', () => {
  test('puts time ticks on round steps that fit the stages', async ({ page }) => {
    await openApp(page);
    await openNewRun(page);
    await page.getByTestId('stage-0-duration').fill('2m');
    await page.getByTestId('stage-1-duration').fill('13m');
    await page.getByTestId('stage-2-duration').fill('1m30s');

    // 16m30s in total: ticks every 5 minutes, not Recharts' own 4m10s steps.
    const chart = page.getByTestId('load-shape-chart');
    await expect(chart).toContainText('10m');
    await expect(chart).toContainText('15m');
    await expect(chart).not.toContainText('4m10s');

    await page.getByTestId('stage-1-duration').fill('30s');
    // 4m in total: ticks every minute.
    await expect(chart).toContainText('3m');
    await expect(chart).not.toContainText('5m');
  });
});
