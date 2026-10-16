import { expect, openApp, test } from './fixtures.ts';

test.describe('runs list', () => {
  test('shows only the runs of the selected type, newest first', async ({ page, api }) => {
    const [olderLoad, newerLoad] = await api.seedFinishedMany(2, 'load');
    const [stress] = await api.seedFinishedMany(1, 'stress');
    await openApp(page);

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
    await openApp(page);
    const detail = page.getByTestId('run-detail');
    await expect(detail).toHaveAttribute('data-run-id', newer!.id);

    await page.getByTestId('run-row').nth(1).click();

    await expect(detail).toHaveAttribute('data-run-id', older!.id);
    await expect(page.getByTestId('run-row').nth(1)).toHaveAttribute('aria-selected', 'true');
  });

  test('pages through more runs than fit on one page', async ({ page, api }) => {
    const seeded = await api.seedFinishedMany(9);
    await openApp(page);
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

  test('goes back a page when the last run of the last page is deleted', async ({ page, api }) => {
    await api.seedFinishedMany(9);
    await openApp(page);
    await page.getByTestId('pagination-next').click();
    await expect(page.getByTestId('run-row')).toHaveCount(1);

    await page.getByTestId('run-delete').click();
    await page.getByTestId('run-action-confirm').click();

    await expect(page.getByTestId('pagination-page')).toHaveText('Page 1 of 1');
    await expect(page.getByTestId('run-row')).toHaveCount(8);
  });
});

test.describe('delete one run', () => {
  test('deletes the run after a confirm', async ({ page, api }) => {
    await api.seedFinished();
    await openApp(page);

    await page.getByTestId('run-delete').click();
    await page.getByTestId('run-action-confirm').click();

    await expect(page.getByTestId('toast-run-deleted')).toBeVisible();
    await expect(page.getByTestId('runs-empty')).toBeVisible();
    expect(await api.list()).toEqual([]);
  });

  test('keeps the run when the user cancels', async ({ page, api }) => {
    const run = await api.seedFinished();
    await openApp(page);

    await page.getByTestId('run-delete').click();
    await page.getByTestId('run-action-keep').click();

    await expect(page.getByTestId('run-action-confirm')).toHaveCount(0);
    await expect(page.getByTestId('run-detail')).toHaveAttribute('data-run-id', run.id);
    expect(await api.list()).toHaveLength(1);
  });
});

test.describe('bulk delete', () => {
  test('deletes the ticked runs after a confirm', async ({ page, api }) => {
    const [kept, ...rest] = await api.seedFinishedMany(3);
    await openApp(page);
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

  test('ticks every finished run on the page at once', async ({ page, api }) => {
    await api.seedFinishedMany(3);
    await openApp(page);

    await page.getByTestId('select-all-runs').check();

    await expect(page.getByTestId('bulk-count')).toHaveText('3 selected');
    for (const checkbox of await page.getByTestId('run-row-checkbox').all()) {
      await expect(checkbox).toBeChecked();
    }
  });

  test('clears the selection without deleting', async ({ page, api }) => {
    await api.seedFinishedMany(2);
    await openApp(page);

    await page.getByTestId('select-all-runs').check();
    await page.getByTestId('bulk-clear').click();

    await expect(page.getByTestId('bulk-count')).toHaveCount(0);
    expect(await api.list()).toHaveLength(2);
  });

  test('clears the selection when the type changes', async ({ page, api }) => {
    await api.seedFinishedMany(1);
    await openApp(page);

    await page.getByTestId('select-all-runs').check();
    await page.getByTestId('type-tab-stress').click();

    await expect(page.getByTestId('bulk-count')).toHaveCount(0);
  });
});
