import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { test, Page, type TestInfo } from '@playwright/test';
import { registerApiMocks } from './mockApi.ts';

test.beforeEach(async ({ page }) => {
  await registerApiMocks(page);
});

/**
 * Capture brochure-quality screenshots of the new Phase 1 + Phase 2
 * panels for the N-Pricing marketing brochure.
 *
 * Saves PNG files to Playwright output instead of the repo tree so
 * Vite watch mode does not trigger HMR reloads mid-suite.
 */

async function login(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Demo login — fill username + password + submit
  const usernameInput = page.getByTestId('demo-username');
  await usernameInput.waitFor({ state: 'visible', timeout: 10000 });
  await usernameInput.fill('demo');

  const passwordInput = page.getByTestId('demo-password');
  await passwordInput.fill('demo');

  await page.getByTestId('demo-login-btn').click();

  // Wait for login to transition — the login page should disappear
  await page.getByTestId('demo-login-btn').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  // Let the SPA hydrate and lazy components render
  await page.waitForTimeout(3000);
}

async function gotoView(page: Page, viewId: string) {
  const navButton = page.getByTestId(`nav-${viewId}`);
  await navButton.waitFor({ state: 'visible', timeout: 10000 });
  await navButton.click();
  await page.waitForTimeout(2500);
}

function screenshotPath(testInfo: TestInfo, fileName: string): string {
  const dir = testInfo.outputPath('brochure');
  mkdirSync(dir, { recursive: true });
  return path.join(dir, fileName);
}

test.describe('Brochure screenshots', () => {
  test.setTimeout(90000);

  test.use({
    viewport: { width: 1920, height: 1200 },
  });

  test('01 Calculator workspace with new panels', async ({ page }, testInfo) => {
    await login(page);

    // Capture the full calculator workspace which now contains all the new panels
    await page.screenshot({
      path: screenshotPath(testInfo, 'v3-calculator-full.png'),
      fullPage: true,
    });

    // Scroll to IFRS9/CrossBonuses row and capture
    const ifrs9Panel = page.locator('text=IFRS 9').first();
    if (await ifrs9Panel.isVisible().catch(() => false)) {
      await ifrs9Panel.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: screenshotPath(testInfo, 'v3-calculator-ifrs9-bonuses.png'),
        fullPage: false,
      });
    }

    // Scroll to InverseOptimizer and capture
    const inverseOptimizer = page.locator('text=/Optimización inversa|Inverse Optimizer/i').first();
    if (await inverseOptimizer.isVisible().catch(() => false)) {
      await inverseOptimizer.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: screenshotPath(testInfo, 'v3-calculator-optimizer-delegation.png'),
        fullPage: false,
      });
    }

    // Scroll to WaterfallExplainer
    const waterfall = page.locator('text=/Explicación del waterfall/i').first();
    if (await waterfall.isVisible().catch(() => false)) {
      await waterfall.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: screenshotPath(testInfo, 'v3-calculator-waterfall-explainer.png'),
        fullPage: false,
      });
    }

    // Scroll to Lineage panel
    const lineage = page.locator('text=/Linaje de parámetros/i').first();
    if (await lineage.isVisible().catch(() => false)) {
      await lineage.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: screenshotPath(testInfo, 'v3-calculator-lineage.png'),
        fullPage: false,
      });
    }
  });

  test('02 Stress testing with macro scenarios', async ({ page }, testInfo) => {
    await login(page);
    await gotoView(page, 'SHOCKS');

    // Wait for the macro scenario picker to render
    await page.waitForSelector('text=/Escenarios de stress EBA|Macro Scenarios/i', {
      timeout: 10000,
    }).catch(() => {});
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: screenshotPath(testInfo, 'v3-stress-macro-scenarios.png'),
      fullPage: true,
    });
  });

  test('03 Reporting — AI Portfolio Review tab', async ({ page }, testInfo) => {
    await login(page);
    await gotoView(page, 'REPORTING');

    // Click the AI Portfolio Review tab
    const reviewTab = page.getByRole('button', { name: /AI Portfolio Review/i }).first();
    if (await reviewTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await reviewTab.click();
      await page.waitForTimeout(2000);
    }

    await page.screenshot({
      path: screenshotPath(testInfo, 'v3-reporting-portfolio-review.png'),
      fullPage: true,
    });
  });

  test('04 Methodology Config — Model Inventory MRM tab', async ({ page }, testInfo) => {
    await login(page);
    await gotoView(page, 'METHODOLOGY');

    // Click the Model Inventory tab
    const mrmTab = page.getByRole('button', { name: /Model Inventory|Inventario de Modelos/i }).first();
    if (await mrmTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await mrmTab.click();
      await page.waitForTimeout(2000);
    }

    await page.screenshot({
      path: screenshotPath(testInfo, 'v3-config-mrm-inventory.png'),
      fullPage: true,
    });
  });
});
