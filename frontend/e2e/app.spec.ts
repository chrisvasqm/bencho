import { expect, openApp, test } from './fixtures.ts';

test.describe('first load', () => {
  test('shows the run form with the backend defaults and an empty runs list', async ({
    page,
    api,
  }) => {
    const defaults = await api.defaults();

    await openApp(page);

    await expect(page.getByTestId('base-url')).toHaveValue(defaults.baseUrl);
    await expect(page.getByTestId('panel-tab-setup')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('type-tab-load')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('runs-empty')).toBeVisible();
    await expect(page.getByTestId('pagination-range')).toHaveText('No runs');
    await expect(page.getByTestId('pagination-previous')).toBeDisabled();
    await expect(page.getByTestId('pagination-next')).toBeDisabled();
    await expect(page.getByTestId('run-detail')).toHaveCount(0);
  });

  test.describe('base URL validation', () => {
    for (const [label, value] of [
      ['a scheme other than http(s)', 'ftp://quickpizza'],
      ['credentials in the URL', 'http://user:secret@quickpizza'],
    ] as const) {
      test(`refuses ${label} without calling the backend`, async ({ page, api }) => {
        await openApp(page);
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
    await page.getByTestId('panel-tab-setup').click();

    for (const type of ['load', 'stress', 'spike'] as const) {
      await page.getByTestId(`type-tab-${type}`).click();
      const count = defaults.stages[type].length;
      await expect(page.getByTestId(`stage-${count - 1}-duration`)).toBeVisible();
      await expect(page.getByTestId(`stage-${count}-duration`)).toHaveCount(0);
    }
  });

  test('shows a rough VU estimate and warns when the stages go above it', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('panel-tab-setup').click();

    await expect(page.getByTestId('capacity-estimate')).toContainText('Rough estimate');
    await expect(page.getByTestId('capacity-docker')).toBeVisible();
    await expect(page.getByTestId('capacity-warning')).toBeEmpty();

    // 1 billion VUs needs petabytes of memory at 5 MB each, so it is above any estimate.
    await page.getByTestId('stage-0-target').fill('1000000000');
    await expect(page.getByTestId('capacity-warning')).toContainText('more than the estimate');
    await expect(page.getByTestId('stages-error')).toHaveCount(0);

    await page.getByTestId('stage-0-target').fill('1');
    await expect(page.getByTestId('capacity-warning')).toBeEmpty();
  });
});

test.describe('setup tab', () => {
  test('opens Setup for a stage error and keeps edits across tabs', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('stage-0-duration').fill('abc');
    await page.getByTestId('panel-tab-flow').click();
    await page.getByTestId('panel-tab-setup').click();
    await expect(page.getByTestId('stage-0-duration')).toHaveValue('abc');
    await page.getByTestId('panel-tab-limits').click();

    await page.getByTestId('start-run').click();

    await expect(page.getByTestId('panel-tab-setup')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('stages-error')).toBeInViewport();
    await expect(page.getByTestId('run-row')).toHaveCount(0);
  });
});

test.describe('load shape chart', () => {
  test('puts time ticks on round steps that fit the stages', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('panel-tab-setup').click();
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

test.describe('theme', () => {
  test('flips between light and dark and keeps the choice after a reload', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await openApp(page);
    // The theme lives on <html>, which has no test id: read it, do not select it.
    const theme = () => page.evaluate(() => document.documentElement.dataset.theme ?? 'system');
    const toggle = page.getByTestId('theme');

    // No stored choice: the OS preference shows.
    await expect.poll(theme).toBe('system');
    await expect(toggle).toHaveAttribute('data-theme', 'light');

    await toggle.click();
    await expect.poll(theme).toBe('dark');
    await expect(toggle).toHaveAttribute('data-theme', 'dark');

    await page.reload();
    await expect.poll(theme).toBe('dark');

    // Back to the OS theme: the stored choice clears and the app follows the OS again.
    await toggle.click();
    await expect.poll(theme).toBe('system');
    await expect(toggle).toHaveAttribute('data-theme', 'light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(toggle).toHaveAttribute('data-theme', 'dark');
  });

  test('keeps the same width when the language changes', async ({ page }) => {
    await openApp(page);
    const toggle = page.getByTestId('theme');
    const before = (await toggle.boundingBox())?.width;
    await page.getByTestId('language').click();
    await expect(page.getByTestId('language')).not.toHaveAttribute('data-language', 'en');
    expect((await toggle.boundingBox())?.width).toBe(before);
  });
});
