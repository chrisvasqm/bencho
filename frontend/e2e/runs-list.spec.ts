import { expect, openApp, test, type Page } from './fixtures.ts';

/**
 * Opens the app with the newest run shown in full. The charts load as a separate chunk; a
 * delete before they arrive makes them fetch the points of a run that is already gone.
 */
async function openRuns(page: Page): Promise<void> {
  await openApp(page);
  await expect(page.getByTestId('run-charts')).toBeVisible();
}

test.describe('runs list', () => {
  test('shows only the runs of the selected type, newest first', async ({ page, api }) => {
    const [olderLoad, newerLoad] = await api.seedFinishedMany(2, 'load');
    const [stress] = await api.seedFinishedMany(1, 'stress');
    await openRuns(page);

    const rows = page.getByTestId('run-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toHaveAttribute('data-run-id', newerLoad!.id);
    await expect(rows.nth(1)).toHaveAttribute('data-run-id', olderLoad!.id);

    await page.getByTestId('type-tab-stress').click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAttribute('data-run-id', stress!.id);

    await page.getByTestId('type-tab-spike').click();
    await expect(page.getByTestId('runs-empty')).toBeVisible();
  });

  test('shows the newest run by default and the run the user selects', async ({ page, api }) => {
    const [older, newer] = await api.seedFinishedMany(2);
    await openRuns(page);
    const detail = page.getByTestId('run-detail');
    await expect(detail).toHaveAttribute('data-run-id', newer!.id);

    await page.getByTestId('run-row').nth(1).click();

    await expect(detail).toHaveAttribute('data-run-id', older!.id);
    await expect(page.getByTestId('run-row').nth(1)).toHaveAttribute('aria-selected', 'true');
  });

  test('pages through more runs than fit on one page', async ({ page, api }) => {
    const seeded = await api.seedFinishedMany(9);
    await openRuns(page);
    const rows = page.getByTestId('run-row');

    await expect(rows).toHaveCount(8);
    await expect(page.getByTestId('pagination-range')).toHaveText('1–8 of 9');
    await expect(page.getByTestId('pagination-previous')).toBeDisabled();

    await page.getByTestId('pagination-next').click();

    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAttribute('data-run-id', seeded[0]!.id);
    await expect(page.getByTestId('pagination-page')).toHaveText('Page 2 of 2');
    await expect(page.getByTestId('pagination-next')).toBeDisabled();

    await page.getByTestId('pagination-previous').click();
    await expect(rows).toHaveCount(8);
  });
});

test.describe('delete one run', () => {
  test('deletes the run after a confirm', async ({ page, api }) => {
    await api.seedFinished();
    await openRuns(page);

    await page.getByTestId('run-delete').click();
    await page.getByTestId('run-action-confirm').click();

    await expect(page.getByTestId('toast-run-deleted')).toBeVisible();
    await expect(page.getByTestId('runs-empty')).toBeVisible();
    expect(await api.list()).toEqual([]);
  });
});

test.describe('bulk delete', () => {
  test('deletes the ticked runs after a confirm', async ({ page, api }) => {
    const [kept, ...rest] = await api.seedFinishedMany(3);
    await openRuns(page);
    const rows = page.getByTestId('run-row');
    await expect(rows).toHaveCount(3);

    await rows.nth(0).getByTestId('run-row-checkbox').check();
    await rows.nth(1).getByTestId('run-row-checkbox').check();
    await expect(page.getByTestId('bulk-count')).toHaveText('2 selected');
    await page.getByTestId('bulk-delete').click();
    await page.getByTestId('bulk-delete-confirm').click();

    await expect(page.getByTestId('toast-runs-deleted')).toBeVisible();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAttribute('data-run-id', kept!.id);
    expect((await api.list()).map((run) => run.id)).toEqual([kept!.id]);
    expect(rest).toHaveLength(2);
  });

  test('ticks every finished run on the page at once and deletes them all', async ({
    page,
    api,
  }) => {
    await api.seedFinishedMany(3);
    await openRuns(page);

    await page.getByTestId('select-all-runs').check();
    await expect(page.getByTestId('bulk-count')).toHaveText('3 selected');
    for (const checkbox of await page.getByTestId('run-row-checkbox').all()) {
      await expect(checkbox).toBeChecked();
    }
    await page.getByTestId('bulk-delete').click();
    await page.getByTestId('bulk-delete-confirm').click();

    await expect(page.getByTestId('toast-runs-deleted')).toBeVisible();
    await expect(page.getByTestId('runs-empty')).toBeVisible();
    expect(await api.list()).toEqual([]);
  });
});
