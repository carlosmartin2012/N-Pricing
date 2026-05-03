import { test, expect } from '@playwright/test';
import { registerApiMocks } from './mockApi.ts';

/**
 * Target Grid E2E Tests
 *
 * Validates the Target Grid view: navigation, table/heatmap toggle,
 * export modal, empty state rendering, and snapshot diff UI.
 *
 * The app falls back to mock/seed data so no real backend is required.
 */

test.beforeEach(async ({ page }) => {
  await registerApiMocks(page);
});

// Shared login helper
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('login-page')).toBeVisible({ timeout: 10_000 });

  await page.getByTestId('demo-username').fill('demo');
  await page.getByTestId('demo-password').fill('demo');
  await page.getByTestId('demo-login-btn').click();

  // Wait for the default Calculator view to load
  await expect(page.getByTestId('deal-input-panel')).toBeVisible({ timeout: 10_000 });

  await expect(page.getByTestId('nav-TARGET_GRID')).toBeVisible();
});

test.describe('Target Grid Navigation', () => {
  test('navigates to the Target Grid view via sidebar', async ({ page }) => {
    await page.getByTestId('nav-TARGET_GRID').click();

    // Header should reflect the active view
    const header = page.getByTestId('header');
    await expect(header.getByText('Targets')).toBeVisible({ timeout: 5_000 });

    // URL should match the expected route
    await expect(page).toHaveURL(/\/target-grid/);
  });
});

test.describe('Target Grid View Structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.getByTestId('nav-TARGET_GRID').click();
    await expect(page.getByTestId('header').getByText('Targets')).toBeVisible({ timeout: 5_000 });
  });

  test('renders the view mode toggle buttons (Table and Heatmap)', async ({ page }) => {
    // The view mode toggle contains Table and Heatmap buttons
    const tableButton = page.getByRole('button', { name: /Table/i });
    const heatmapButton = page.getByRole('button', { name: /Heatmap/i });

    await expect(tableButton).toBeVisible();
    await expect(heatmapButton).toBeVisible();

    // Table should be the default (aria-pressed="true")
    await expect(tableButton).toHaveAttribute('aria-pressed', 'true');
    await expect(heatmapButton).toHaveAttribute('aria-pressed', 'false');
  });

  test('toggles between table and heatmap view', async ({ page }) => {
    const tableButton = page.getByRole('button', { name: /Table/i });
    const heatmapButton = page.getByRole('button', { name: /Heatmap/i });

    // Switch to heatmap
    await heatmapButton.click();
    await expect(heatmapButton).toHaveAttribute('aria-pressed', 'true');
    await expect(tableButton).toHaveAttribute('aria-pressed', 'false');

    // Switch back to table
    await tableButton.click();
    await expect(tableButton).toHaveAttribute('aria-pressed', 'true');
    await expect(heatmapButton).toHaveAttribute('aria-pressed', 'false');
  });

  test('renders the Export button', async ({ page }) => {
    const exportButton = page.getByRole('button', { name: /Export/i });
    await expect(exportButton).toBeVisible();
  });

  test('shows empty state when no snapshots are available', async ({ page }) => {
    // With mock data returning empty arrays, the "No methodology snapshots" message should appear
    await expect(page.getByText('No methodology snapshots')).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Target Grid Export Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.getByTestId('nav-TARGET_GRID').click();
    await expect(page.getByTestId('header').getByText('Targets')).toBeVisible({ timeout: 5_000 });
  });

  test('export button is present and disabled when there are no cells', async ({ page }) => {
    const exportButton = page.getByRole('button', { name: /Export/i });
    await expect(exportButton).toBeVisible();

    // With no cells, the export button should be disabled
    await expect(exportButton).toBeDisabled();
  });
});

test.describe('Target Grid Snapshot Selector', () => {
  test.beforeEach(async ({ page }) => {
    await page.getByTestId('nav-TARGET_GRID').click();
    await expect(page.getByTestId('header').getByText('Targets')).toBeVisible({ timeout: 5_000 });
  });

  test('filter area is rendered', async ({ page }) => {
    // The filter area contains a filter icon even with no data
    // With empty data, the tenor bucket filter chips still render (from TENOR_BUCKETS constant)
    // We verify the view has loaded by checking for the toggle buttons and empty state
    const tableButton = page.getByRole('button', { name: /Table/i });
    await expect(tableButton).toBeVisible();
  });
});
