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

test('renders live health metrics and alert rules from the observability API', async ({ page }) => {
  await loginToDemoWorkspace(page);

  await page.getByTestId('sidebar-more-toggle').click();
  await page.getByTestId('nav-HEALTH').click();

  await expect(page.getByTestId('header').getByText('System Health')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText('Pricing Latency P50')).toBeVisible();
  await expect(page.getByText('58ms')).toBeVisible();
  await expect(page.getByText('Pricing Latency P95')).toBeVisible();
  await expect(page.getByText('192ms')).toBeVisible();
  await expect(page.getByText('Error Events (24h)')).toBeVisible();
  await expect(page.getByText('Latency Guardrail')).toBeVisible();
  await expect(page.getByText('pricing_latency_ms')).toBeVisible();
});
