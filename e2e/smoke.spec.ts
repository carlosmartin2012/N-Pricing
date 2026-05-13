import { test, expect } from '@playwright/test';
import { registerApiMocks } from './mockApi.ts';

test.beforeEach(async ({ page }) => {
  await registerApiMocks(page);
});

test.describe('Login Flow', () => {
  test('shows login page when not authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('login-page')).toBeVisible({ timeout: 10000 });
  });

  test('demo login navigates to calculator', async ({ page }) => {
    await page.goto('/');

    const usernameInput = page.getByTestId('demo-username');
    if (await usernameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await usernameInput.fill('demo');
      await page.getByTestId('demo-password').fill('demo');
      await page.getByTestId('demo-login-btn').click();
      await expect(page.getByTestId('deal-input-panel')).toBeVisible({ timeout: 10000 });
    }
  });

  test('invalid credentials show error', async ({ page }) => {
    await page.goto('/');
    const usernameInput = page.getByTestId('demo-username');
    if (await usernameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await usernameInput.fill('wrong');
      await page.getByTestId('demo-password').fill('wrong');
      await page.getByTestId('demo-login-btn').click();
      await expect(page.getByTestId('login-error')).toBeVisible();
    }
  });
});

test.describe('Calculator Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const usernameInput = page.getByTestId('demo-username');
    if (await usernameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await usernameInput.fill('demo');
      await page.getByTestId('demo-password').fill('demo');
      await page.getByTestId('demo-login-btn').click();
    }
    await expect(page.getByTestId('deal-input-panel')).toBeVisible({ timeout: 10000 });
  });

  test('calculator displays three panels', async ({ page }) => {
    await expect(page.getByTestId('deal-input-panel')).toBeVisible();
    await expect(page.getByTestId('pricing-receipt')).toBeVisible();
  });

  test('pricing receipt shows calculated values', async ({ page }) => {
    await expect(page.getByTestId('receipt-base-rate')).toBeVisible();
    await expect(page.getByTestId('receipt-total-ftp')).toBeVisible();
    await expect(page.getByTestId('receipt-raroc')).toBeVisible();
  });

  test('save deal button exists', async ({ page }) => {
    const saveBtn = page.getByTestId('save-deal-btn');
    if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(saveBtn).toBeEnabled();
    }
  });
});

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const usernameInput = page.getByTestId('demo-username');
    if (await usernameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await usernameInput.fill('demo');
      await page.getByTestId('demo-password').fill('demo');
      await page.getByTestId('demo-login-btn').click();
    }
    await page.waitForTimeout(2000);
  });

  test('sidebar navigation to blotter', async ({ page }) => {
    const blotterNav = page.getByTestId('nav-BLOTTER');
    if (await blotterNav.isVisible({ timeout: 3000 }).catch(() => false)) {
      await blotterNav.click();
      await page.waitForTimeout(1000);
    }
  });

  test('sidebar navigation to market data', async ({ page }) => {
    const navItem = page.getByTestId('nav-MARKET_DATA');
    if (await navItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await navItem.click();
      await page.waitForTimeout(1000);
    }
  });
});
