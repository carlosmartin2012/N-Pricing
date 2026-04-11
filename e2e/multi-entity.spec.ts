import { expect, test } from '@playwright/test';
import type { Transaction } from '../types';
import { INITIAL_DEAL } from '../utils/seedData';
import { DEFAULT_ENTITY_ID, DEMO_ENTITY_2_ID } from '../utils/seedData.entities';
import { registerApiMocks } from './mockApi.ts';

const spainDeal: Transaction = {
  ...INITIAL_DEAL,
  id: 'DL-ES-BOOK-001',
  entityId: DEFAULT_ENTITY_ID,
  status: 'Approved',
  description: 'Spain entity book',
};

const portugalDeal: Transaction = {
  ...INITIAL_DEAL,
  id: 'DL-PT-BOOK-001',
  entityId: DEMO_ENTITY_2_ID,
  clientId: 'CL-2001',
  businessUnit: 'Corporate',
  fundingBusinessUnit: 'Treasury',
  status: 'Review',
  description: 'Portugal entity book',
};

async function loginToDemoWorkspace(page: import('@playwright/test').Page) {
  await registerApiMocks(page, { deals: [spainDeal, portugalDeal] });
  await page.goto('/');
  await expect(page.getByTestId('login-page')).toBeVisible({ timeout: 10_000 });

  await page.getByTestId('demo-username').fill('demo');
  await page.getByTestId('demo-password').fill('demo');
  await page.getByTestId('demo-login-btn').click();
  await expect(page.getByTestId('deal-input-panel')).toBeVisible({ timeout: 10_000 });
}

async function openBlotter(page: import('@playwright/test').Page) {
  await page.getByTestId('nav-BLOTTER').click();
  await expect(page.getByRole('table', { name: 'Deal blotter' })).toBeVisible();
}

async function openEntitySwitcher(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Switch Entity' }).click();
}

test('scopes blotter data to the active entity and supports consolidated group view', async ({ page }) => {
  await loginToDemoWorkspace(page);
  await openBlotter(page);

  const table = page.getByRole('table', { name: 'Deal blotter' });
  const switcher = page.getByRole('button', { name: 'Switch Entity' });

  await expect(switcher).toContainText('NFQES');
  await expect(table.getByText('DL-ES-BOOK-001')).toBeVisible();
  await expect(table.getByText('DL-PT-BOOK-001')).not.toBeVisible();

  await openEntitySwitcher(page);
  await page.getByRole('button', { name: 'NFQ Bank Portugal' }).click();

  await expect(switcher).toContainText('NFQPT');
  await expect(table.getByText('DL-PT-BOOK-001')).toBeVisible();
  await expect(table.getByText('DL-ES-BOOK-001')).not.toBeVisible();

  await openEntitySwitcher(page);
  await page.getByRole('button', { name: 'Group View (Consolidated)' }).click();

  await expect(switcher).toContainText('All Entities');
  await expect(table.getByText('DL-ES-BOOK-001')).toBeVisible();
  await expect(table.getByText('DL-PT-BOOK-001')).toBeVisible();
});
