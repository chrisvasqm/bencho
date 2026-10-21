import { expect, openApp, test } from './fixtures.ts';

test.describe('first load', () => {
  test('shows the run form with the backend defaults and an empty runs list', async ({
    page,
    api,
  }) => {
    const defaults = await api.defaults();

    await openApp(page);

    await expect(page.getByTestId('base-url')).toHaveValue(defaults.baseUrl);
    await expect(page.getByTestId('panel-tab-target')).toHaveAttribute('aria-selected', 'true');
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
    await page.getByTestId('panel-tab-shape').click();

    for (const type of ['load', 'stress', 'spike'] as const) {
      await page.getByTestId(`type-tab-${type}`).click();
      const count = defaults.stages[type].length;
      await expect(page.getByTestId(`stage-${count - 1}-duration`)).toBeVisible();
      await expect(page.getByTestId(`stage-${count}-duration`)).toHaveCount(0);
    }
  });

  test('shows a rough VU estimate and warns when the stages go above it', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('panel-tab-shape').click();

    await expect(page.getByTestId('capacity-estimate')).toContainText('Rough estimate');
    await expect(page.getByTestId('capacity-warning')).toHaveCount(0);

    // 1 billion VUs needs petabytes of memory at 5 MB each, so it is above any estimate.
    await page.getByTestId('stage-0-target').fill('1000000000');
    await expect(page.getByTestId('capacity-warning')).toBeVisible();

    await page.getByTestId('stage-0-target').fill('1');
    await expect(page.getByTestId('capacity-warning')).toHaveCount(0);
  });
});

test.describe('theme', () => {
  test('switches to dark and light and keeps the choice after a reload', async ({ page }) => {
    await openApp(page);
    // The theme lives on <html>, which has no test id: read it, do not select it.
    const theme = () => page.evaluate(() => document.documentElement.dataset.theme ?? 'system');

    await page.getByTestId('theme-dark').click();
    await expect.poll(theme).toBe('dark');
    await expect(page.getByTestId('theme-dark')).toHaveAttribute('aria-checked', 'true');

    await page.reload();
    await expect.poll(theme).toBe('dark');

    await page.getByTestId('theme-light').click();
    await expect.poll(theme).toBe('light');

    await page.getByTestId('theme-system').click();
    await expect.poll(theme).toBe('system');
  });
});
