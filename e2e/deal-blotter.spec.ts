import { expect, test } from '@playwright/test';
import { registerApiMocks } from './mockApi.ts';

async function loginToDemoWorkspace(page: import('@playwright/test').Page) {
  await registerApiMocks(page);
  await page.goto('/');
  await expect(page.getByTestId('login-page')).toBeVisible({ timeout: 10_000 });

  await page.getByTestId('demo-username').fill('demo');
  await page.getByTestId('demo-password').fill('demo');
  await page.getByTestId('demo-login-btn').click();
  await expect(page.getByTestId('deal-input-panel')).toBeVisible({ timeout: 10_000 });
}

async function openBlotter(page: import('@playwright/test').Page) {
  await page.getByTestId('nav-BLOTTER').click();
  await expect(page.getByTestId('header').getByText('Deal Blotter')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole('table', { name: 'Deal blotter' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await loginToDemoWorkspace(page);
  await openBlotter(page);
});

test.describe('Deal Blotter', () => {
  test('renders the seeded blotter grid and committee summary footer', async ({ page }) => {
    const table = page.getByRole('table', { name: 'Deal blotter' });

    await expect(table.getByText('TRD-HYPER-001')).toBeVisible();
    await expect(table.getByText('TRD-HYPER-005')).toBeVisible();
    await expect(page.getByText('COMMITTEE PENDING:')).toBeVisible();
    await expect(page.getByText('OPEN TASKS:')).toBeVisible();
  });

  test('filters deals by search term and workflow status', async ({ page }) => {
    const table = page.getByRole('table', { name: 'Deal blotter' });
    const searchInput = page.getByPlaceholder(/search/i);

    await searchInput.fill('TRD-HYPER-001');
    await expect(table.getByText('TRD-HYPER-001')).toBeVisible();
    await expect(table.getByText('TRD-HYPER-005')).not.toBeVisible();

    await searchInput.fill('');
    await expect(searchInput).toHaveValue('');
    await page.locator('select').filter({ has: page.locator('option[value="Review"]') }).selectOption('Review');
    await expect(table.getByText('TRD-HYPER-005')).toBeVisible();
    await expect(table.getByText('TRD-HYPER-001')).not.toBeVisible();
  });

  test('opens the committee dossier drawer from a blotter row', async ({ page }) => {
    await page.getByRole('button', { name: /Open committee dossier for deal TRD-HYPER-005/i }).click();

    await expect(page.getByRole('heading', { name: /Committee Dossier • TRD-HYPER-005/i })).toBeVisible();
    await expect(
      page.getByText('No governed dossier is available for this transaction yet. Submit it for approval first')
    ).toBeVisible();
  });

  test('creates a new draft deal from the blotter drawer', async ({ page }) => {
    const rows = page.getByRole('table', { name: 'Deal blotter' }).locator('tbody tr');
    const initialCount = await rows.count();

    await page.getByRole('button', { name: /New Deal/i }).click();
    await expect(page.getByRole('heading', { name: 'Create New Transaction' })).toBeVisible();

    await page.getByRole('button', { name: 'Create Deal' }).click();
    await expect(rows).toHaveCount(initialCount + 1);
  });
});
