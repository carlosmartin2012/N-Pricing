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

async function openStressPricing(page: Page) {
  await page.getByTestId('nav-STRESS_PRICING').click();
  await expect(
    page.getByRole('heading', { name: 'Stress Pricing', level: 2 }),
  ).toBeVisible({ timeout: 10_000 });
}

test.beforeEach(async ({ page }) => {
  await loginToDemoWorkspace(page);
});

test.describe('Stress Pricing', () => {
  test('renders base row + 6 EBA preset scenarios with deltas', async ({ page }) => {
    await openStressPricing(page);

    // Base row (7th scenario total: 1 base + 6 EBA presets from EBA GL 2018/02).
    await expect(page.getByText('Base', { exact: false }).first()).toBeVisible();

    // The 6 canonical EBA shocks — at least the two parallels and the two
    // short-rate shocks must be labelled. Steepener / flattener match too.
    const scenarioRows = page.locator('table tbody tr');
    await expect(scenarioRows).toHaveCount(7);

    // Header row has the delta columns; base row shows em-dashes for deltas
    // because it is the anchor. Any non-base row has a signed bp formatted
    // delta for FTP — the regex tolerates + / - and the `bp` unit.
    await expect(page.locator('table tbody tr').nth(1)).toContainText(/[+-]\d+\.\d+\s?bp/);
  });

  test('surfaces the curve-shift flag chip in the header', async ({ page }) => {
    await openStressPricing(page);

    // The chip reflects VITE_PRICING_APPLY_CURVE_SHIFT. Either copy is
    // acceptable — the spec only enforces that one of them is visible so
    // the canary remains discoverable regardless of env.
    await expect(
      page.getByText(/CURVE SHIFT · (ON|OFF \(uniform\))/i),
    ).toBeVisible();
  });

  test('includes the IRRBB disclaimer so users do not confuse it with regulatory EVE/NII', async ({ page }) => {
    await openStressPricing(page);

    await expect(
      page.getByText(/does not replace the regulatory IRRBB calculation/i),
    ).toBeVisible();
    await expect(page.getByText(/ALM engine/i)).toBeVisible();
  });

  test('exports the 7×7 matrix as CSV when the user clicks Export', async ({ page }) => {
    await openStressPricing(page);

    const exportButton = page.getByRole('button', { name: /Export CSV/i });
    await expect(exportButton).toBeEnabled();

    const downloadPromise = page.waitForEvent('download');
    await exportButton.click();
    const download = await downloadPromise;

    // Filename pattern: stress-pricing-<dealId>.csv.
    expect(download.suggestedFilename()).toMatch(/^stress-pricing-.+\.csv$/);
  });
});
