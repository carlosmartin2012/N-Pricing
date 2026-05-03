import { test, expect } from '@playwright/test';
import { registerApiMocks } from './mockApi.ts';

/**
 * Navigation E2E Tests
 *
 * Validates that all main sidebar navigation items work correctly,
 * switching between views loads the expected content, and the header
 * reflects the active view label.
 */

test.beforeEach(async ({ page }) => {
  await registerApiMocks(page);
});

// Shared login helper — runs before each test
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('login-page')).toBeVisible({ timeout: 10_000 });

  await page.getByTestId('demo-username').fill('demo');
  await page.getByTestId('demo-password').fill('demo');
  await page.getByTestId('demo-login-btn').click();

  // Wait for the default Calculator view to load
  await expect(page.getByTestId('deal-input-panel')).toBeVisible({ timeout: 10_000 });

  // Ensure the sidebar is expanded so nav items are clickable.
  // Post-Option B (2026-04) el label es "Calculator" — antes "Pricing Engine".
  const sidebarHasLabels = await page
    .getByTestId('sidebar')
    .getByText('Calculator')
    .isVisible()
    .catch(() => false);

  if (!sidebarHasLabels) {
    await page.getByTestId('menu-toggle').click();
    await expect(page.getByTestId('sidebar').getByText('Calculator')).toBeVisible({ timeout: 3_000 });
  }
});

test.describe('Main Navigation Items', () => {
  // Labels actualizados a Option B (2026-04) + density pass (Ola 10.7).
  // ACCOUNTING demoted a AUX (⌘K only) en 2026-04-22 — fuera del sidebar.
  const mainNavItems = [
    { testId: 'nav-CALCULATOR', label: 'Calculator' },
    { testId: 'nav-RAROC', label: 'RAROC' },
    { testId: 'nav-SHOCKS', label: 'Stress Test' },
    { testId: 'nav-BLOTTER', label: 'Deal Blotter' },
    { testId: 'nav-REPORTING', label: 'Analytics' },
    { testId: 'nav-MARKET_DATA', label: 'Yield Curves' },
    { testId: 'nav-METHODOLOGY', label: 'Methodology' },
    { testId: 'nav-BEHAVIOURAL', label: 'Behavioural Models' },
    { testId: 'nav-AI_LAB', label: 'AI Assistant' },
  ];

  for (const navItem of mainNavItems) {
    test(`nav item "${navItem.label}" is visible and clickable`, async ({ page }) => {
      const button = page.getByTestId(navItem.testId);
      await expect(button).toBeVisible();
      await expect(button).toBeEnabled();
    });
  }
});

test.describe('Bottom Navigation Items', () => {
  const bottomNavItems = [
    { testId: 'nav-USER_CONFIG', label: 'User Configuration' },
    { testId: 'nav-USER_MGMT', label: 'User Management' },
    { testId: 'nav-AUDIT_LOG', label: 'System Audit' },
    { testId: 'nav-MANUAL', label: 'User Manual' },
  ];

  // The utility items now live inside a collapsible "More" group in the
  // sidebar — expand it before each assertion.
  test.beforeEach(async ({ page }) => {
    const moreToggle = page.getByTestId('sidebar-more-toggle');
    await expect(moreToggle).toBeVisible();
    if ((await moreToggle.getAttribute('aria-expanded')) !== 'true') {
      await moreToggle.click();
    }
  });

  for (const navItem of bottomNavItems) {
    test(`bottom nav item "${navItem.label}" is visible`, async ({ page }) => {
      const button = page.getByTestId(navItem.testId);
      await expect(button).toBeVisible();
      await expect(button).toBeEnabled();
    });
  }
});

test.describe('View Switching', () => {
  test('navigating to Deal Blotter loads the blotter view', async ({ page }) => {
    await page.getByTestId('nav-BLOTTER').click();

    // Header should reflect the new view label
    const header = page.getByTestId('header');
    await expect(header.getByText('Deal Blotter')).toBeVisible({ timeout: 5_000 });
  });

  test('navigating to FTP Analytics loads the reporting dashboard', async ({ page }) => {
    await page.getByTestId('nav-REPORTING').click();

    const header = page.getByTestId('header');
    await expect(header.getByText('Analytics')).toBeVisible({ timeout: 5_000 });
  });

  test('navigating to Yield Curves loads the market data view', async ({ page }) => {
    await page.getByTestId('nav-MARKET_DATA').click();

    const header = page.getByTestId('header');
    await expect(header.getByText('Yield Curves')).toBeVisible({ timeout: 5_000 });
  });

  test('navigating to Rules & Config loads the methodology config', async ({ page }) => {
    await page.getByTestId('nav-METHODOLOGY').click();

    const header = page.getByTestId('header');
    await expect(header.getByText('Methodology')).toBeVisible({ timeout: 5_000 });
  });

  test('navigating to RAROC Terminal loads the RAROC calculator', async ({ page }) => {
    await page.getByTestId('nav-RAROC').click();

    const header = page.getByTestId('header');
    await expect(header.getByText('RAROC')).toBeVisible({ timeout: 5_000 });
  });

  test('navigating to User Management loads admin view', async ({ page }) => {
    // Utility items are behind the "More" group in the sidebar
    await page.getByTestId('sidebar-more-toggle').click();
    await page.getByTestId('nav-USER_MGMT').click();

    const header = page.getByTestId('header');
    await expect(header.getByText('User Management')).toBeVisible({ timeout: 5_000 });
  });

  test('navigating to System Audit loads audit log', async ({ page }) => {
    await page.getByTestId('sidebar-more-toggle').click();
    await page.getByTestId('nav-AUDIT_LOG').click();

    const header = page.getByTestId('header');
    await expect(header.getByText('System Audit')).toBeVisible({ timeout: 5_000 });
  });

  test('navigating back to Calculator restores the pricing workspace', async ({ page }) => {
    // Navigate away first
    await page.getByTestId('nav-BLOTTER').click();
    await expect(page.getByTestId('header').getByText('Deal Blotter')).toBeVisible({ timeout: 5_000 });

    // Navigate back
    await page.getByTestId('nav-CALCULATOR').click();
    await expect(page.getByTestId('deal-input-panel')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('pricing-receipt')).toBeVisible();
  });
});

test.describe('Header Controls', () => {
  test('sidebar toggle button works', async ({ page }) => {
    const menuToggle = page.getByTestId('menu-toggle');
    await expect(menuToggle).toBeVisible();

    // Toggle should be clickable without errors
    await menuToggle.click();
    // After toggling, the sidebar labels may disappear (collapsed state)
    // Toggle again to restore
    await menuToggle.click();
  });

  test('theme toggle button is present', async ({ page }) => {
    // The theme button has a title attribute "Theme"
    const themeButton = page.getByRole('button', { name: /Theme/i });
    await expect(themeButton).toBeVisible();
  });

  test('notifications button is present', async ({ page }) => {
    const notificationsButton = page.getByRole('button', { name: /Notifications/i });
    await expect(notificationsButton).toBeVisible();
  });

  test('import data button is present', async ({ page }) => {
    const importButton = page.getByRole('button', { name: /Import Data/i });
    await expect(importButton).toBeVisible();
  });
});
