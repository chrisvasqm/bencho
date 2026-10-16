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
});

test.describe('backend not reachable', () => {
  test.use({ allowedConsoleErrors: [/ERR_CONNECTION_REFUSED.*\/api\/v1\//] });

  test('tells the user to start the stack', async ({ page }) => {
    await page.route('**/api/v1/**', (route) => route.abort('connectionrefused'));

    await page.goto('/');

    await expect(page.getByTestId('toast-backend-down')).toBeVisible();
    await expect(page.getByTestId('runs-error')).toBeVisible();
  });
});

test.describe('theme', () => {
  test('switches to dark and light and keeps the choice after a reload', async ({ page }) => {
    await openApp(page);
    const html = page.locator('html');

    await page.getByTestId('theme-dark').click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByTestId('theme-dark')).toHaveAttribute('aria-checked', 'true');

    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');

    await page.getByTestId('theme-light').click();
    await expect(html).toHaveAttribute('data-theme', 'light');

    await page.getByTestId('theme-system').click();
    await expect(html).not.toHaveAttribute('data-theme', /.+/);
  });
});
