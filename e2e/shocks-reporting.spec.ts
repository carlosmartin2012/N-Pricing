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

async function openStressTesting(page: Page) {
  await page.getByTestId('nav-SHOCKS').click();
  await expect(page.getByTestId('header').getByText('Stress Testing')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText('Escenarios de stress EBA')).toBeVisible();
  await expect(page.getByText('Impact Analysis')).toBeVisible();
}

async function openReporting(page: Page) {
  await page.getByTestId('nav-REPORTING').click();
  await expect(page.getByTestId('header').getByText('FTP Analytics')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole('heading', { name: 'FTP Analytics' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await loginToDemoWorkspace(page);
});

test.describe('Shocks And Reporting', () => {
  test('applies a macro stress scenario and records the action in the audit trail', async ({ page }) => {
    await openStressTesting(page);

    await page.getByRole('button', { name: /Rate shock \+200bp/i }).click();

    await expect(page.getByText('Impact Analysis')).toBeVisible();

    await page.getByTestId('sidebar-more-toggle').click();
    await page.getByTestId('nav-AUDIT_LOG').click();
    await expect(page.getByTestId('header').getByText('System Audit')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('APPLY_SHOCK')).toBeVisible();
    await expect(page.getByText(/Rate shock \+200bp|Applied macro scenario RATE_SHOCK_UP/i).first()).toBeVisible();
  });

  test('creates a stressed scenario repricing snapshot from reporting', async ({ page }) => {
    await openReporting(page);
    await page.getByRole('button', { name: 'Scenario Repricing' }).click();

    await expect(page.getByPlaceholder('Portfolio Snapshot 2026-04-02')).toBeVisible();
    await expect(page.getByText(/0 snapshots/i)).toBeVisible();

    const snapshotName = `Stress Snapshot ${Date.now()}`;
    await page.getByPlaceholder('Portfolio Snapshot 2026-04-02').fill(snapshotName);
    await page.locator('select').filter({ has: page.locator('option[value="COMBINED_STRESS"]') }).selectOption('COMBINED_STRESS');
    await page.getByRole('button', { name: 'Create Snapshot' }).click();

    await expect(page.getByRole('button', { name: new RegExp(snapshotName) }).first()).toBeVisible();
    await expect(page.getByText(/IR \+25 \/ LP\+20|IR \+25 bps/i).first()).toBeVisible();

    await page.getByTestId('sidebar-more-toggle').click();
    await page.getByTestId('nav-AUDIT_LOG').click();
    await expect(page.getByText('CREATE_PORTFOLIO_SNAPSHOT')).toBeVisible();
    await expect(page.getByText(snapshotName).first()).toBeVisible();
  });
});
