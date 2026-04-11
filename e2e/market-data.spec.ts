import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { registerApiMocks } from './mockApi.ts';

async function loginToDemoWorkspace(page: Page) {
  await registerApiMocks(page);
  await page.goto('/');
  await expect(page.getByTestId('login-page')).toBeVisible({ timeout: 10_000 });

  await page.getByTestId('demo-username').fill('demo');
  await page.getByTestId('demo-password').fill('demo');
  await page.getByTestId('demo-login-btn').click();
  await expect(page.getByTestId('deal-input-panel')).toBeVisible({ timeout: 10_000 });
}

async function openMarketData(page: Page) {
  await page.getByTestId('nav-MARKET_DATA').click();
  await expect(page.getByTestId('header').getByText('Yield Curves')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole('heading', { name: /Market Data Sources/i })).toBeVisible();
}

test.describe('Market Data Governance', () => {
  test('registers a governed source, saves a snapshot, and audits the flow end-to-end', async ({ page }) => {
    const snapshotDate = '2026-04-08';
    const sourceName = 'Bloomberg BVAL USD Curve';
    const sourceCardName = new RegExp(`${sourceName}.*Bloomberg`, 'i');

    await loginToDemoWorkspace(page);
    await openMarketData(page);

    await page.getByRole('textbox', { name: 'Source Name' }).fill(sourceName);
    await page.getByRole('textbox', { name: 'Provider' }).fill('Bloomberg');
    await page.getByRole('textbox', { name: 'Covered Currencies' }).fill('USD, EUR');
    await page.getByRole('textbox', { name: 'Notes' }).fill('Primary governed feed for treasury curve capture.');

    await page.getByRole('button', { name: 'Register Source' }).click();

    const sourceCard = page.getByRole('button', { name: sourceCardName });
    await expect(sourceCard).toBeVisible();
    await expect(page.getByText('1 governed sources')).toBeVisible();

    await page.locator('input[type="date"]').fill(snapshotDate);
    await page.locator('button[title="Save Snapshot"]').click();

    await expect(page.getByText(snapshotDate).first()).toBeVisible();
    await expect(sourceCard).not.toContainText('Pending first capture');
    await expect(sourceCard).toContainText('Ready for current curve');

    await page.getByTestId('sidebar-more-toggle').click();
    await page.getByTestId('nav-AUDIT_LOG').click();
    await expect(page.getByTestId('header').getByText('System Audit')).toBeVisible({ timeout: 5_000 });

    await expect(page.getByText('REGISTER_MARKET_DATA_SOURCE')).toBeVisible();
    await expect(page.getByText('SAVE_CURVE_SNAPSHOT')).toBeVisible();
    await expect(page.getByText(new RegExp(`Registered source ${sourceName}`, 'i')).first()).toBeVisible();
    await expect(
      page.getByText(new RegExp(`Saved USD curve snapshot for ${snapshotDate} via ${sourceName}`, 'i')).first(),
    ).toBeVisible();
  });
});
