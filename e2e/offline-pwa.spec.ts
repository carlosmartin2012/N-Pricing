import { expect, test } from '@playwright/test';
import { registerApiMocks } from './mockApi.ts';

async function loginToDemoWorkspace(page: import('@playwright/test').Page) {
  await registerApiMocks(page);
  await page.goto('/');
  await page.evaluate(async () => {
    const deleteDb = (name: string) =>
      new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
      });
    await Promise.all([deleteDb('n-pricing-mutations'), deleteDb('n-pricing-drafts')]);
  });
  await page.reload();
  await expect(page.getByTestId('login-page')).toBeVisible({ timeout: 10_000 });

  await page.getByTestId('demo-username').fill('demo');
  await page.getByTestId('demo-password').fill('demo');
  await page.getByTestId('demo-login-btn').click();
  await expect(page.getByTestId('deal-input-panel')).toBeVisible({ timeout: 10_000 });
}

test('queues a new deal while offline and auto-syncs it when connectivity returns', async ({ page, context }) => {
  await loginToDemoWorkspace(page);

  await page.getByTestId('nav-BLOTTER').click();
  await expect(page.getByRole('table', { name: 'Deal blotter' })).toBeVisible();
  await page.waitForFunction(() => (window as Window & { __dealBlotterDrawersPreloaded?: boolean }).__dealBlotterDrawersPreloaded === true);

  const rows = page.getByRole('table', { name: 'Deal blotter' }).locator('tbody tr');
  const initialCount = await rows.count();

  await context.setOffline(true);
  await expect(page.getByText('You are offline. Changes are saved locally.')).toBeVisible({ timeout: 5_000 });

  await page.getByRole('button', { name: 'New Deal' }).click();
  await expect(page.getByRole('heading', { name: 'Create New Transaction' })).toBeVisible();
  await page.getByRole('button', { name: 'Create Deal' }).click();

  await expect(rows).toHaveCount(initialCount + 1);
  await expect(page.getByTestId('offline-badge')).toBeVisible();
  await expect(page.getByTestId('offline-badge')).toContainText('pending');

  await context.setOffline(false);
  await expect(page.getByText('Connection restored. Data will sync automatically.')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('offline-badge')).toBeHidden({ timeout: 30_000 });
  await expect(rows).toHaveCount(initialCount + 1);
});
