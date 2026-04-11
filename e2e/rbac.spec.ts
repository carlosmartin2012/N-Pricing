import { expect, test, type Page } from '@playwright/test';
import type { Transaction, UserProfile } from '../types';
import { INITIAL_DEAL, MOCK_USERS } from '../utils/seedData';
import { registerApiMocks } from './mockApi.ts';

const pendingApprovalDeal: Transaction = {
  ...INITIAL_DEAL,
  id: 'DL-RBAC-001',
  status: 'Pending_Approval',
  description: 'Pending approval RBAC fixture',
};

const reviewDeal: Transaction = {
  ...INITIAL_DEAL,
  id: 'DL-RBAC-002',
  status: 'Review',
  description: 'Review RBAC fixture',
};

function getUserByEmail(email: string): UserProfile {
  const user = MOCK_USERS.find((item) => item.email === email);
  if (!user) {
    throw new Error(`Missing seeded user for ${email}`);
  }
  return user;
}

async function seedAuthenticatedSession(page: Page, email: string) {
  await registerApiMocks(page, { deals: [pendingApprovalDeal, reviewDeal] });

  const user = getUserByEmail(email);
  await page.addInitScript((seededUser: UserProfile) => {
    localStorage.setItem('n_pricing_current_user', JSON.stringify(seededUser));
    localStorage.setItem('n_pricing_auth_token', 'demo-token');
    localStorage.setItem('n_pricing_session_expires', JSON.stringify(Date.now() + 60 * 60 * 1000));
  }, user);

  await page.goto('/');
  await expect(page.getByTestId('deal-input-panel')).toBeVisible({ timeout: 10_000 });
}

async function openBlotter(page: Page) {
  await page.getByTestId('nav-BLOTTER').click();
  await expect(page.getByRole('table', { name: 'Deal blotter' })).toBeVisible();
}

test('traders cannot approve pending approval deals', async ({ page }) => {
  await seedAuthenticatedSession(page, 'alejandro.lloveras@nfq.es');
  await openBlotter(page);

  const row = page
    .getByRole('table', { name: 'Deal blotter' })
    .locator('tbody tr')
    .filter({ has: page.getByText('DL-RBAC-001') })
    .first();

  await expect(row).toContainText('Pending Approval');
  await expect(row.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  await expect(row).toContainText('No actions');
});

test('risk managers can approve pending approval deals', async ({ page }) => {
  await seedAuthenticatedSession(page, 'gregorio.gonzalo@nfq.es');
  await openBlotter(page);

  const row = page
    .getByRole('table', { name: 'Deal blotter' })
    .locator('tbody tr')
    .filter({ has: page.getByText('DL-RBAC-001') })
    .first();

  await row.getByRole('button', { name: 'Approve' }).click();

  await expect(row).toContainText('Approved');
  await expect(row.getByRole('button', { name: 'Book Deal' })).toBeVisible();
});

test('auditors remain read-only in the blotter workflow', async ({ page }) => {
  await seedAuthenticatedSession(page, 'roberto.flores@nfq.es');
  await openBlotter(page);

  await expect(page.getByRole('button', { name: 'New Deal' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Batch Reprice' })).toBeDisabled();

  const row = page
    .getByRole('table', { name: 'Deal blotter' })
    .locator('tbody tr')
    .filter({ has: page.getByText('DL-RBAC-002') })
    .first();

  await expect(row).toContainText('No actions');
  await expect(row.getByRole('button', { name: /Edit disabled for deal DL-RBAC-002/i })).toBeDisabled();
  await expect(row.getByRole('button', { name: /Delete disabled for deal DL-RBAC-002/i })).toBeDisabled();
  await expect(row.getByRole('button', { name: /Clone disabled for deal DL-RBAC-002/i })).toBeDisabled();
});
