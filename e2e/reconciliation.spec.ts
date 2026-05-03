import { test, expect } from '@playwright/test';
import { registerApiMocks } from './mockApi.ts';

/**
 * /reconciliation — FTP Reconciliation E2E (Phase 6.9).
 *
 * Uses the stub registered in e2e/mockApi.ts under `/reconciliation/summary`.
 * That stub returns 3 coherent demo rows (1 matched + 1 amount_mismatch +
 * 1 bu_only) so the filter chips + KPIs have something to exercise.
 *
 * Covers the controller-grade features:
 *   - Navigation from sidebar (Governance bucket).
 *   - 4 KPI tiles populate from the summary response.
 *   - Filter chips narrow the visible rows.
 *   - Period selector updates the URL-independent input value.
 *   - Export CSV enabled when feed has rows.
 *   - Per-row deep-link to /blotter with dealId query param.
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

  await expect(page.getByTestId('nav-RECONCILIATION')).toBeVisible();
});

test.describe('Reconciliation — navigation + KPIs', () => {
  test('opens /reconciliation from the sidebar Governance bucket', async ({ page }) => {
    await page.getByTestId('nav-RECONCILIATION').click();
    await expect(page).toHaveURL(/\/reconciliation/);
    await expect(page.getByRole('heading', { name: /FTP Reconciliation/i, level: 1 })).toBeVisible({ timeout: 5_000 });
  });

  test('renders the 4 KPI tiles populated from the mock', async ({ page }) => {
    await page.getByTestId('nav-RECONCILIATION').click();
    await expect(page.getByText('Matched').first()).toBeVisible();
    await expect(page.getByText('Unmatched').first()).toBeVisible();
    await expect(page.getByText('Total amount delta')).toBeVisible();
    await expect(page.getByText('Max single delta')).toBeVisible();
    // Mock: 1 matched / 2 unmatched ⇒ 33.3% matched ratio shown under KPI.
    await expect(page.getByText(/33\.3%/)).toBeVisible({ timeout: 5_000 });
  });

  test('renders 3 rows (matched + amount_mismatch + bu_only)', async ({ page }) => {
    await page.getByTestId('nav-RECONCILIATION').click();
    await expect(page.getByTestId('reconciliation-table')).toBeVisible();
    await expect(page.getByText('Acme Industrial SA')).toBeVisible();
    await expect(page.getByText('Beta Solar Energy SL')).toBeVisible();
    await expect(page.getByText('Gamma Healthcare Group')).toBeVisible();
  });
});

test.describe('Reconciliation — filters + export', () => {
  test('amount_mismatch chip narrows table to the single mismatch row', async ({ page }) => {
    await page.getByTestId('nav-RECONCILIATION').click();
    await expect(page.getByText('Acme Industrial SA')).toBeVisible();
    await page.getByTestId('reconciliation-filter-amount_mismatch').click();
    await expect(page.getByText('Beta Solar Energy SL')).toBeVisible();
    await expect(page.getByText('Acme Industrial SA')).not.toBeVisible();
    await expect(page.getByText('Gamma Healthcare Group')).not.toBeVisible();
  });

  test('bu_only chip narrows to the missing-treasury row', async ({ page }) => {
    await page.getByTestId('nav-RECONCILIATION').click();
    await expect(page.getByText('Gamma Healthcare Group')).toBeVisible();
    await page.getByTestId('reconciliation-filter-bu_only').click();
    await expect(page.getByText('Gamma Healthcare Group')).toBeVisible();
    await expect(page.getByText('Acme Industrial SA')).not.toBeVisible();
  });

  test('matched chip narrows to the healthy row', async ({ page }) => {
    await page.getByTestId('nav-RECONCILIATION').click();
    await page.getByTestId('reconciliation-filter-matched').click();
    await expect(page.getByText('Acme Industrial SA')).toBeVisible();
    await expect(page.getByText('Beta Solar Energy SL')).not.toBeVisible();
  });

  test('empty state appears when an unused status filter is selected', async ({ page }) => {
    await page.getByTestId('nav-RECONCILIATION').click();
    await expect(page.getByTestId('reconciliation-table')).toBeVisible();
    await page.getByTestId('reconciliation-filter-currency_mismatch').click();
    await expect(page.getByTestId('reconciliation-empty')).toBeVisible();
    await expect(page.getByTestId('reconciliation-table')).not.toBeVisible();
  });

  test('Export CSV button enables once feed has rows', async ({ page }) => {
    await page.getByTestId('nav-RECONCILIATION').click();
    await expect(page.getByText('Acme Industrial SA')).toBeVisible();
    await expect(page.getByTestId('reconciliation-export-csv')).toBeEnabled();
  });

  test('Export CSV button disables when filter produces empty set', async ({ page }) => {
    await page.getByTestId('nav-RECONCILIATION').click();
    await page.getByTestId('reconciliation-filter-currency_mismatch').click();
    await expect(page.getByTestId('reconciliation-export-csv')).toBeDisabled();
  });
});

test.describe('Reconciliation — row drill-down', () => {
  test('row Open link deep-links to /blotter with dealId query param', async ({ page }) => {
    await page.getByTestId('nav-RECONCILIATION').click();
    await expect(page.getByTestId('reconciliation-table')).toBeVisible();
    const openLink = page.getByTestId('reconciliation-row-open-D-AMT-002');
    await expect(openLink).toBeVisible();
    await expect(openLink).toHaveAttribute('href', /dealId=D-AMT-002/);
  });
});

test.describe('Reconciliation — period selector', () => {
  test('period input accepts a new value without crashing the page', async ({ page }) => {
    await page.getByTestId('nav-RECONCILIATION').click();
    await expect(page.getByTestId('reconciliation-period')).toBeVisible();
    await page.getByTestId('reconciliation-period').fill('2026-03');
    // The feed stays on-screen (mock returns the same rows regardless of
    // period — we're testing the control wiring, not business logic).
    await expect(page.getByTestId('reconciliation-table')).toBeVisible({ timeout: 5_000 });
  });
});
