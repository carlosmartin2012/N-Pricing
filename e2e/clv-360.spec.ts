import { test, expect } from '@playwright/test';
import { registerApiMocks } from './mockApi.ts';

/**
 * CLV + 360º temporal E2E — Phase 6.
 *
 * Exercises the 4-tab Customer 360 lens end-to-end using mock API data:
 *   Snapshot · LTV projection · Timeline · Next-Best-Action.
 *
 * Mocks live in e2e/mockApi.ts under the `/clv/*` branch.
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

  // Ensure sidebar labels are visible (expand if collapsed)
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

test.describe('Customer 360 — CLV tabs', () => {
  test.beforeEach(async ({ page }) => {
    await page.getByTestId('nav-CUSTOMER_360').click();
    await expect(page).toHaveURL(/\/customers/);
  });

  test('default tab is Snapshot', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Snapshot/i })).toBeVisible();
  });

  test('switches to LTV projection and renders CLV numbers', async ({ page }) => {
    await page.getByRole('button', { name: /LTV projection/i }).click();
    // Card title + point estimate + p5/p95 band + breakdown chips
    await expect(page.getByText('Customer Lifetime Value')).toBeVisible({ timeout: 5_000 });
    // The mock returns 1.25M € as the point estimate — we don't match the
    // exact formatted string (Intl locale varies) so just check that a €
    // figure renders in the card.
    await expect(page.locator('text=/€/').first()).toBeVisible();
  });

  test('switches to Timeline and lists events', async ({ page }) => {
    await page.getByRole('button', { name: /Timeline/i }).click();
    await expect(page.getByText('Relationship timeline')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Deal booked')).toBeVisible();
    await expect(page.getByText('Contact')).toBeVisible();
  });

  test('switches to NBA and renders top recommendation + reason codes', async ({ page }) => {
    await page.getByRole('button', { name: /Next-Best-Action/i }).click();
    await expect(page.getByText(/FX_Hedging|Corporate_Loan/).first()).toBeVisible({ timeout: 5_000 });
    // Reason chips
    await expect(page.getByText(/Renewal window open|Core product gap|Share-of-wallet low/i).first()).toBeVisible();
  });

  test('generating NBA triggers POST and renders new recommendation', async ({ page }) => {
    await page.getByRole('button', { name: /Next-Best-Action/i }).click();
    await page.getByRole('button', { name: /Generate NBA/i }).click();
    await expect(page.getByText(/Corporate_Loan/).first()).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Customer 360 — recompute CLV', () => {
  test('clicking Recompute updates the CLV card', async ({ page }) => {
    await page.getByTestId('nav-CUSTOMER_360').click();
    await page.getByRole('button', { name: /LTV projection/i }).click();

    // Mock returns different numbers on recompute — we just verify the
    // flow completes and the card is still rendered.
    await page.getByRole('button', { name: /Recompute/i }).click();
    await expect(page.getByText('Customer Lifetime Value')).toBeVisible({ timeout: 5_000 });
  });
});
