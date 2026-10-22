import { expect, openApp, test } from './fixtures.ts';

test('switches the language and keeps it after a reload', async ({ page }) => {
  await openApp(page);
  await expect(page.getByTestId('start-run')).toHaveText('Start load test');

  await expect(page.getByTestId('language')).toHaveAccessibleName(
    'Language: EN ES — change to Spanish',
  );
  // A click on either side of the switch moves to the other language.
  await page.getByTestId('language-es').click();
  // Text built at render follows the switch at once, without a reload.
  await expect(page.getByTestId('start-run')).toHaveText('Iniciar prueba de carga');
  await expect(page.getByTestId('pagination-range')).toHaveText('Sin ejecuciones');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');

  await page.reload();
  await expect(page.getByTestId('start-run')).toHaveText('Iniciar prueba de carga');
  await expect(page.getByTestId('language')).toHaveAttribute('data-language', 'es');
  await expect(page.getByTestId('language')).toHaveAccessibleName(
    'Idioma: EN ES — cambiar a inglés',
  );

  // The highlighted side flips too.
  await page.getByTestId('language-es').click();
  await expect(page.getByTestId('start-run')).toHaveText('Start load test');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.reload();
  await expect(page.getByTestId('language')).toHaveAttribute('data-language', 'en');
  await page.getByTestId('language-en').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
});

test('opens a Learn drawer and closes it', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('panel-tab-setup').click();
  await page.getByTestId('learn-shape').click();
  const drawer = page.getByTestId('learn-shape-drawer');
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('heading')).toHaveText('How users and stages work');
  await page.getByTestId('learn-shape-close').click();
  await expect(drawer).toHaveCount(0);
});
