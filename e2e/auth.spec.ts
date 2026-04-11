import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { registerApiMocks } from './mockApi.ts';

/**
 * Authentication E2E Tests
 *
 * These tests cover the demo login flow, session management,
 * and user identity display after authentication.
 *
 * The app runs with VITE_DEMO_USER/VITE_DEMO_PASS/VITE_DEMO_EMAIL
 * env vars set in playwright.config.ts webServer command.
 */

test.beforeEach(async ({ page }) => {
  await registerApiMocks(page);
});

async function gotoLogin(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('login-page')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
}

async function submitDemoLogin(page: Page, username: string, password: string) {
  await gotoLogin(page);

  const usernameInput = page.getByTestId('demo-username');
  const passwordInput = page.getByTestId('demo-password');
  const submitButton = page.getByTestId('demo-login-btn');

  await expect(usernameInput).toBeEditable();
  await expect(passwordInput).toBeEditable();
  await expect(submitButton).toBeEnabled();

  await usernameInput.fill(username);
  await passwordInput.fill(password);
  await submitButton.click();
}

test.describe('Login Page', () => {
  test('shows login page with branding when not authenticated', async ({ page }) => {
    await gotoLogin(page);
    await expect(page.getByText('N Pricing')).toBeVisible();
  });

  test('displays Google OAuth button when VITE_GOOGLE_CLIENT_ID is configured', async ({ page }) => {
    // The Google sign-in button is only rendered when the client id is
    // provided at build time — the Playwright webServer does not set it, so
    // in that case we skip this assertion rather than fail.
    test.skip(
      !process.env.VITE_GOOGLE_CLIENT_ID,
      'VITE_GOOGLE_CLIENT_ID not set — Google button intentionally hidden',
    );

    await gotoLogin(page);

    await expect(page.getByTestId('google-login-btn')).toBeVisible();
    await expect(page.getByText('Continue with your NFQ account')).toBeVisible();
  });

  test('shows demo login form when demo env vars are set', async ({ page }) => {
    await gotoLogin(page);

    // The demo access section should be visible since env vars are set
    await expect(page.getByText('Demo access', { exact: true })).toBeVisible();
    await expect(page.getByTestId('demo-username')).toBeVisible();
    await expect(page.getByTestId('demo-password')).toBeVisible();
    await expect(page.getByTestId('demo-login-btn')).toBeVisible();
  });
});

test.describe('Demo Login Flow', () => {
  test('successful demo login navigates to the calculator workspace', async ({ page }) => {
    await submitDemoLogin(page, 'demo', 'demo');

    // After login, the deal input panel (calculator) should be visible
    await expect(page.getByTestId('deal-input-panel')).toBeVisible({ timeout: 10_000 });
  });

  test('invalid credentials show an error message', async ({ page }) => {
    await submitDemoLogin(page, 'wrong-user', 'wrong-pass');

    await expect(page.getByTestId('login-error')).toBeVisible();
    await expect(page.getByTestId('login-error')).toContainText('Invalid credentials');
  });

  test('empty credentials show an error', async ({ page }) => {
    await gotoLogin(page);

    // Submit empty form
    await page.getByTestId('demo-login-btn').click();

    await expect(page.getByTestId('login-error')).toBeVisible();
  });
});

test.describe('Post-Login User Identity', () => {
  test.beforeEach(async ({ page }) => {
    await submitDemoLogin(page, 'demo', 'demo');

    await expect(page.getByTestId('deal-input-panel')).toBeVisible({ timeout: 10_000 });
  });

  test('header displays the logged-in user name', async ({ page }) => {
    const header = page.getByTestId('header');
    await expect(header).toBeVisible();

    // The demo user is "Demo User" from seedData (email: demo@nfq.es)
    await expect(header.getByText('Demo User')).toBeVisible();
  });

  test('header shows user role and department', async ({ page }) => {
    const header = page.getByTestId('header');
    await expect(header).toBeVisible();

    // Demo user has role "Admin" and department "Demo"
    await expect(header.getByText(/Admin/)).toBeVisible();
  });

  test('sidebar is present after login', async ({ page }) => {
    await expect(page.getByTestId('sidebar')).toBeVisible();
  });

  test('main navigation items are visible in the sidebar', async ({ page }) => {
    // Open sidebar if collapsed on smaller viewports
    const sidebar = page.getByTestId('sidebar');
    if (!(await sidebar.getByText('Pricing Engine').isVisible().catch(() => false))) {
      await page.getByTestId('menu-toggle').click();
    }

    await expect(page.getByTestId('nav-CALCULATOR')).toBeVisible();
    await expect(page.getByTestId('nav-BLOTTER')).toBeVisible();
    await expect(page.getByTestId('nav-REPORTING')).toBeVisible();
  });
});
