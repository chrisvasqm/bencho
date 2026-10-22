import { expect, openApp, test } from './fixtures.ts';

test('switches the language and keeps it after a reload', async ({ page }) => {
  await openApp(page);
  await expect(page.getByTestId('start-run')).toHaveText('Start load test');

  await page.getByTestId('language-es').click();
  // Text built at render follows the switch at once, without a reload.
  await expect(page.getByTestId('start-run')).toHaveText('Iniciar prueba de carga');
  await expect(page.getByTestId('pagination-range')).toHaveText('Sin ejecuciones');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');

  await page.reload();
  await expect(page.getByTestId('start-run')).toHaveText('Iniciar prueba de carga');
  await expect(page.getByTestId('language-es')).toHaveAttribute('aria-checked', 'true');

  // A click on the current language also flips to the other one.
  await page.getByTestId('language-es').click();
  await expect(page.getByTestId('start-run')).toHaveText('Start load test');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByTestId('language-en')).toHaveAttribute('aria-checked', 'true');
});

test.describe('basic mode', () => {
  test.use({ detail: 'basic' });

  test('hides the advanced settings until Advanced is on', async ({ page }) => {
    await openApp(page);
    await expect(page.getByTestId('detail-basic')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('load-mode-rate')).toHaveCount(0);

    await page.getByTestId('panel-tab-limits').click();
    await expect(page.getByTestId('limit-p95')).toBeVisible();
    await expect(page.getByTestId('limit-p50')).toHaveCount(0);
    await expect(page.getByTestId('grace-period')).toHaveCount(0);

    await page.getByTestId('panel-tab-flow').click();
    await expect(page.getByTestId('step-body')).toBeVisible();
    await expect(page.getByTestId('step-headers')).toHaveCount(0);
    await expect(page.getByTestId('step-saves')).toHaveCount(0);

    await page.getByTestId('detail-advanced').click();
    await expect(page.getByTestId('step-headers')).toBeVisible();
    await expect(page.getByTestId('step-saves')).toBeVisible();
    await page.getByTestId('panel-tab-limits').click();
    await expect(page.getByTestId('limit-p50')).toBeVisible();
    await expect(page.getByTestId('grace-period')).toBeVisible();
    await page.getByTestId('panel-tab-setup').click();
    await expect(page.getByTestId('load-mode-rate')).toBeVisible();
  });
});
