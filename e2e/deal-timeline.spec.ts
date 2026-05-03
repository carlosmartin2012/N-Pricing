import { expect, test } from '@playwright/test';
import { registerApiMocks } from './mockApi.ts';

/**
 * Deal Timeline E2E (Ola 7 Bloque A.7).
 *
 * Validates the user flow that ties together the entire Bloque A:
 *   1. Login + open Blotter
 *   2. Click the "View timeline" icon on a deal row
 *   3. Land on /deals/<id>/timeline with KPIs + 3 synthetic events
 *   4. Filter chips toggle visibility
 *   5. Replay button navigates to /snapshots?focus=<snapshotId>
 *
 * The mockApi response for /deals/:id/timeline returns a deterministic
 * 3-event payload (created + repriced + L1 escalation) — enough to
 * exercise the filters without needing real DB fixtures.
 */

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
  await expect(page.getByRole('table', { name: 'Deal blotter' })).toBeVisible({ timeout: 5_000 });
}

test.beforeEach(async ({ page }) => {
  await loginToDemoWorkspace(page);
  await openBlotter(page);
});

test.describe('Deal Timeline', () => {
  test('opens from the Blotter row action and renders KPIs + events', async ({ page }) => {
    await page.getByRole('button', { name: /View timeline for deal TRD-HYPER-001/i }).click();

    await expect(page).toHaveURL(/\/deals\/TRD-HYPER-001\/timeline$/);
    // Header: deal id + status
    await expect(page.getByRole('heading', { name: 'TRD-HYPER-001' })).toBeVisible();
    // KPI tiles
    await expect(page.getByText('Repricings')).toBeVisible();
    await expect(page.getByText('Escalations')).toBeVisible();
    await expect(page.locator('#main-content').getByText('Dossiers')).toBeVisible();
    // 3 event cards rendered
    await expect(page.locator('article[data-event-kind]')).toHaveCount(3);
  });

  test('filters timeline events by kind via toggle chips', async ({ page }) => {
    await page.getByRole('button', { name: /View timeline for deal TRD-HYPER-001/i }).click();
    await expect(page.locator('article[data-event-kind]')).toHaveCount(3);

    // Toggle off the "escalation opened" chip — count drops from 3 to 2
    await page.getByRole('button', { name: /Escalation opened/i }).click();
    await expect(page.locator('article[data-event-kind="escalation_opened"]')).toHaveCount(0);
    await expect(page.locator('article[data-event-kind]')).toHaveCount(2);

    // Use bulk None — empty state copy appears
    await page.getByRole('button', { name: 'None', exact: true }).click();
    await expect(page.getByText(/all event kinds are filtered out/i)).toBeVisible();

    // Restore via All
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expect(page.locator('article[data-event-kind]')).toHaveCount(3);
  });

  test('Replay button navigates to /snapshots?focus=<snapshotId>', async ({ page }) => {
    await page.getByRole('button', { name: /View timeline for deal TRD-HYPER-001/i }).click();

    // Two snapshot events have Replay buttons (deal_created + deal_repriced).
    const replayButtons = page.getByRole('button', { name: /Replay snapshot/i });
    await expect(replayButtons).toHaveCount(2);

    await replayButtons.first().click();
    await expect(page).toHaveURL(/\/snapshots\?focus=TRD-HYPER-001-S0$/);
  });
});
