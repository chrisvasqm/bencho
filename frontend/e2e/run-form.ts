// Steps on the "New run" panel, shared by the specs.
import { expect, type Page } from '@playwright/test';

/** Leaves one stage of `duration` with 1 virtual user. */
export async function setSingleStage(page: Page, duration: string): Promise<void> {
  await page.getByTestId('panel-tab-shape').click();
  // The tab content animates in; wait for it before counting rows.
  await expect(page.getByTestId('stage-0-duration')).toBeVisible();
  while ((await page.getByTestId('stage-1-duration').count()) > 0) {
    await page.getByTestId('stage-1-remove').click();
  }
  await page.getByTestId('stage-0-duration').fill(duration);
  await page.getByTestId('stage-0-target').fill('1');
}

/** Latency limits no local request can reach, no think time, and a 50% error limit. */
export async function setLooseLimits(page: Page): Promise<void> {
  await page.getByTestId('panel-tab-limits').click();
  await expect(page.getByTestId('think-time')).toBeVisible();
  await page.getByTestId('think-time').fill('0');
  await page.getByTestId('max-error-rate').fill('50');
  for (const key of ['p50', 'p90', 'p95', 'p99']) {
    await page.getByTestId(`limit-${key}`).fill('10000');
  }
}

export async function startRun(page: Page): Promise<void> {
  await page.getByTestId('start-run').click();
  await expect(page.getByTestId('toast-run-started')).toBeVisible();
}
