import { test, expect } from '@playwright/test';
import { registerApiMocks } from './mockApi.ts';

/**
 * /pipeline — firmwide NBA feed E2E.
 *
 * Uses the same mock stubs as the CLV spec (/clv/nba with 3 demo rows).
 * Covers the commercial headline features:
 *   - Navigation from sidebar loads the view.
 *   - Filter bar narrows the feed (product + confidence band).
 *   - Status tabs swap the request (open / consumed / all).
 *   - Bulk selection + bulk consume.
 *   - Auto-refresh toggle flips state.
 */

test.beforeEach(async ({ page }) => {
  await registerApiMocks(page);
});

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('login-page')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('demo-username').fill('demo');
  await page.getByTestId('demo-password').fill('demo');
  await page.getByTestId('demo-login-btn').click();
  await expect(page.getByTestId('deal-input-panel')).toBeVisible({ timeout: 10_000 });

  const sidebarHasLabels = await page
    .getByTestId('sidebar')
    .getByText('Pricing Engine')
    .isVisible()
    .catch(() => false);
  if (!sidebarHasLabels) {
    await page.getByTestId('menu-toggle').click();
    await expect(page.getByTestId('sidebar').getByText('Pricing Engine')).toBeVisible({ timeout: 3_000 });
  }
});

test.describe('Pipeline — navigation + feed', () => {
  test('opens /pipeline from the sidebar', async ({ page }) => {
    await page.getByTestId('nav-PIPELINE').click();
    await expect(page).toHaveURL(/\/pipeline/);
    await expect(page.getByRole('heading', { name: /Pipeline/i })).toBeVisible({ timeout: 5_000 });
  });

  test('renders the 4 KPI tiles + feed with demo rows', async ({ page }) => {
    await page.getByTestId('nav-PIPELINE').click();
    await expect(page.getByText('Recommendations')).toBeVisible();
    await expect(page.getByText('Clients covered')).toBeVisible();
    await expect(page.getByText(/Total expected ΔCLV/i)).toBeVisible();
    await expect(page.getByText('Avg confidence')).toBeVisible();

    // Two open demo rows: Acme Industrial + Beta Solar.
    await expect(page.getByText('Acme Industrial SA')).toBeVisible();
    await expect(page.getByText('Beta Solar Energy SL')).toBeVisible();
  });

  test('status tabs swap the feed (open → consumed)', async ({ page }) => {
    await page.getByTestId('nav-PIPELINE').click();
    await expect(page.getByText('Acme Industrial SA')).toBeVisible();
    await page.getByTestId('pipeline-status-consumed').click();
    await expect(page.getByText('Gamma Healthcare Group')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Acme Industrial SA')).not.toBeVisible();
  });
});

test.describe('Pipeline — bulk actions + export', () => {
  test('select-all enables the bulk bar with the visible count', async ({ page }) => {
    await page.getByTestId('nav-PIPELINE').click();
    await expect(page.getByText('Acme Industrial SA')).toBeVisible();
    await page.getByTestId('pipeline-select-all').check();
    await expect(page.getByTestId('pipeline-bulk-bar')).toBeVisible();
    await expect(page.getByText(/2 selected/i)).toBeVisible();
  });

  test('bulk consume fires and empties the selection', async ({ page }) => {
    await page.getByTestId('nav-PIPELINE').click();
    await expect(page.getByText('Acme Industrial SA')).toBeVisible();
    await page.getByTestId('pipeline-select-all').check();
    await page.getByTestId('pipeline-bulk-consume').click();
    // Bulk bar should disappear after the mutation completes + selection clears.
    await expect(page.getByTestId('pipeline-bulk-bar')).not.toBeVisible({ timeout: 5_000 });
  });

  test('Auto-refresh toggle flips aria-pressed', async ({ page }) => {
    await page.getByTestId('nav-PIPELINE').click();
    const toggle = page.getByTestId('pipeline-auto-refresh');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  test('Export CSV button is enabled once feed has rows', async ({ page }) => {
    await page.getByTestId('nav-PIPELINE').click();
    await expect(page.getByText('Acme Industrial SA')).toBeVisible();
    const exportBtn = page.getByTestId('pipeline-export-csv');
    await expect(exportBtn).toBeEnabled();
  });
});

test.describe('Pipeline — filters', () => {
  test('product filter narrows the feed', async ({ page }) => {
    await page.getByTestId('nav-PIPELINE').click();
    await expect(page.getByText('Acme Industrial SA')).toBeVisible();
    await page.getByTestId('pipeline-filter-product').selectOption('FX_Hedging');
    await expect(page.getByText('Acme Industrial SA')).toBeVisible();
    await expect(page.getByText('Beta Solar Energy SL')).not.toBeVisible();
  });

  test('confidence band filter narrows to high confidence (>=80%)', async ({ page }) => {
    await page.getByTestId('nav-PIPELINE').click();
    await expect(page.getByText('Acme Industrial SA')).toBeVisible();
    await page.getByTestId('pipeline-filter-confidence').selectOption('high');
    // Acme (0.82) remains; Beta (0.75) filtered out.
    await expect(page.getByText('Acme Industrial SA')).toBeVisible();
    await expect(page.getByText('Beta Solar Energy SL')).not.toBeVisible();
  });
});
