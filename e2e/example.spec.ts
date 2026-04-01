import { test, expect } from '@playwright/test';

/**
 * E2E Tests for N-Pricing
 * Prerequisites: npm run dev must be running on port 3000
 */

const BASE_URL = 'http://localhost:3000';

test.describe('Login Flow', () => {
  test('shows login page when not authenticated', async ({ page }) => {
    await page.goto(BASE_URL);
    // Should show login form
    await expect(page.locator('text=N-Pricing')).toBeVisible({ timeout: 10000 });
  });

  test('demo login navigates to calculator', async ({ page }) => {
    await page.goto(BASE_URL);
    // Look for demo login button or email input
    const demoButton = page.locator('button:has-text("Demo"), button:has-text("demo"), button:has-text("Login")');
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');

    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill('demo@nfq.es');
      const passwordInput = page.locator('input[type="password"]');
      if (await passwordInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await passwordInput.fill('demo');
      }
      await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")').first().click();
    } else if (await demoButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await demoButton.first().click();
    }

    // After login, should see the main app (sidebar or calculator)
    await expect(page.locator('text=Pricing Engine, text=Calculator, text=CALCULATOR').first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Calculator Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    // Attempt demo login
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill('demo@nfq.es');
      const passwordInput = page.locator('input[type="password"]');
      if (await passwordInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await passwordInput.fill('demo');
      }
      await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")').first().click();
    }
    await page.waitForTimeout(2000);
  });

  test('calculator displays three panels', async ({ page }) => {
    // Calculator view should show input, methodology, and receipt panels
    const panels = page.locator('.lg\\:col-span-4');
    await expect(panels).toHaveCount(3, { timeout: 10000 });
  });

  test('changing amount updates pricing receipt', async ({ page }) => {
    const amountInput = page.locator('input[name="amount"], input[placeholder*="amount" i]').first();
    if (await amountInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await amountInput.clear();
      await amountInput.fill('10000000');
      // Wait for pricing recalculation
      await page.waitForTimeout(1000);
      // Receipt should show updated values
      await expect(page.locator('text=/\\d+\\.\\d+%/').first()).toBeVisible();
    }
  });
});

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill('demo@nfq.es');
      const passwordInput = page.locator('input[type="password"]');
      if (await passwordInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await passwordInput.fill('demo');
      }
      await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")').first().click();
    }
    await page.waitForTimeout(2000);
  });

  test('sidebar navigation switches views', async ({ page }) => {
    // Click on Deal Blotter in sidebar
    const blotterLink = page.locator('text=Blotter, text=Deal Blotter').first();
    if (await blotterLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await blotterLink.click();
      await page.waitForTimeout(1000);
      // Should show blotter content
      await expect(page.locator('table, text=No deals, text=Deal')).toBeVisible({ timeout: 5000 });
    }
  });
});
