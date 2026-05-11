import { test, expect } from '@playwright/test';
import { registerApiMocks } from './mockApi.ts';

test.beforeEach(async ({ page }) => {
  await registerApiMocks(page);
  await page.goto('/');
  await expect(page.getByTestId('login-page')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('demo-username').fill('demo');
  await page.getByTestId('demo-password').fill('demo');
  await page.getByTestId('demo-login-btn').click();
  await expect(page.getByTestId('deal-input-panel')).toBeVisible({ timeout: 10_000 });
});

test('What-If workspace exposes sandbox, elasticity, backtesting, and benchmark consoles', async ({ page }) => {
  await page.getByRole('button', { name: /What-If/i }).click();

  await expect(page.getByRole('button', { name: /Sandbox Lab/i })).toBeVisible();
  await expect(page.getByText('Sandboxes', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /Elasticity/i }).click();
  await expect(page.getByRole('heading', { name: 'Elasticity Models' })).toBeVisible();

  await page.getByRole('button', { name: /Backtesting/i }).click();
  await expect(page.getByText('New Backtest')).toBeVisible();
  await expect(page.getByText('Past Runs')).toBeVisible();

  await page.getByRole('button', { name: /Benchmarks/i }).click();
  await expect(page.getByText('Snapshot Comparison')).toBeVisible();
  await expect(page.getByPlaceholder('Paste methodology snapshot ID')).toBeVisible();
});
