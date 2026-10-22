// Steps on the "New run" form, shared by the specs.
import { expect, type Page } from '@playwright/test';

/** Opens the run form drawer and waits for its fields. */
export async function openNewRun(page: Page): Promise<void> {
  await page.getByTestId('new-run').click();
  await expect(page.getByTestId('start-run')).toBeEnabled();
  await expect(page.getByTestId('base-url')).toBeVisible();
}

/** Leaves one stage of `duration` with 1 virtual user. */
export async function setSingleStage(page: Page, duration: string): Promise<void> {
  await expect(page.getByTestId('stage-0-duration')).toBeVisible();
  while ((await page.getByTestId('stage-1-duration').count()) > 0) {
    await page.getByTestId('stage-1-remove').click();
  }
  await page.getByTestId('stage-0-duration').fill(duration);
  await page.getByTestId('stage-0-target').fill('1');
}

/** Latency limits no local request can reach, no think time, and a 50% error limit. */
export type PanelTab = 'setup' | 'flow' | 'limits';

/** Shows one section of the run form: Setup, Steps or Pass rules. */
export async function openTab(page: Page, tab: PanelTab): Promise<void> {
  await page.getByTestId(`panel-tab-${tab}`).click();
  await expect(page.getByTestId(`panel-section-${tab}`)).toBeVisible();
}

export async function setLooseLimits(page: Page): Promise<void> {
  await openTab(page, 'limits');
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
