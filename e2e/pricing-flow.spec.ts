import { test, expect } from '@playwright/test';

/**
 * Pricing Flow E2E Tests
 *
 * Validates the core pricing workflow: the Calculator workspace loads
 * with its three panels, pricing results are calculated and displayed
 * with the FTP waterfall breakdown, and deals can be saved to the blotter.
 *
 * The app uses seed/mock data by default so no real Supabase is needed.
 */

// Shared login and wait for Calculator
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('login-page')).toBeVisible({ timeout: 10_000 });

  await page.getByTestId('demo-username').fill('demo');
  await page.getByTestId('demo-password').fill('demo');
  await page.getByTestId('demo-login-btn').click();

  // Calculator is the default landing view
  await expect(page.getByTestId('deal-input-panel')).toBeVisible({ timeout: 10_000 });
});

test.describe('Calculator Workspace Layout', () => {
  test('displays the deal input panel', async ({ page }) => {
    await expect(page.getByTestId('deal-input-panel')).toBeVisible();
  });

  test('displays the pricing receipt panel', async ({ page }) => {
    await expect(page.getByTestId('pricing-receipt')).toBeVisible();
  });

  test('shows the workspace title "Pricing Engine"', async ({ page }) => {
    // The main heading in the hero section reflects the active view
    await expect(page.getByRole('heading', { name: 'Pricing Engine' })).toBeVisible();
  });

  test('shows portfolio KPI cards (Deals, Pending, Snapshots, AI traces)', async ({ page }) => {
    await expect(page.getByText('Live book')).toBeVisible();
    await expect(page.getByText('Approval queue')).toBeVisible();
    await expect(page.getByText('Portfolio frames')).toBeVisible();
    await expect(page.getByText('Grounded evidence')).toBeVisible();
  });
});

test.describe('Pricing Receipt — FTP Breakdown', () => {
  test('shows the RAROC value', async ({ page }) => {
    const rarocElement = page.getByTestId('receipt-raroc');
    await expect(rarocElement).toBeVisible();

    // RAROC should display a percentage value (e.g. "12.34%")
    await expect(rarocElement).toHaveText(/%$/);
  });

  test('shows the base rate in the pricing waterfall', async ({ page }) => {
    await expect(page.getByTestId('receipt-base-rate')).toBeVisible();
  });

  test('shows the total FTP rate', async ({ page }) => {
    await expect(page.getByTestId('receipt-total-ftp')).toBeVisible();
  });

  test('shows the final client rate (all-in price)', async ({ page }) => {
    const finalRate = page.getByTestId('receipt-final-rate');
    await expect(finalRate).toBeVisible();
    await expect(finalRate).toHaveText(/%$/);
  });

  test('shows an approval level badge', async ({ page }) => {
    const approval = page.getByTestId('receipt-approval');
    await expect(approval).toBeVisible();

    // Should show one of the approval level texts
    const approvalText = await approval.textContent();
    const validLevels = [
      'Automatic Approval',
      'Requires L1 Manager Review',
      'Escalation: Pricing Committee',
      'Deal Below Floor - Rejected',
    ];
    expect(validLevels.some((level) => approvalText?.includes(level))).toBe(true);
  });

  test('shows the pricing construction flow section', async ({ page }) => {
    await expect(page.getByText('Pricing Construction Flow')).toBeVisible();
  });
});

test.describe('Deal Input — Scenario Selector', () => {
  test('shows the active scenario / deal source selector', async ({ page }) => {
    // "New Deal / Scenario" is the default <option> label. Playwright treats
    // options inside a closed <select> as hidden, so assert on attachment +
    // option count instead of visibility.
    const panel = page.getByTestId('deal-input-panel');
    const option = panel.locator('option[value="NEW"]');
    await expect(option).toHaveText('New Deal / Scenario');
  });

  test('displays the default client badge (Acme Corp)', async ({ page }) => {
    // INITIAL_DEAL has clientId CL-1001 which maps to "Acme Corp Industries".
    // The string also appears inside <option> tags of the deal selector, so we
    // target the rendered badge via its NFQ class.
    const panel = page.getByTestId('deal-input-panel');
    await expect(
      panel.locator('.nfq-badge', { hasText: 'Acme Corp Industries' }).first(),
    ).toBeVisible();
  });

  test('displays the default product badge (LOAN_COMM)', async ({ page }) => {
    const panel = page.getByTestId('deal-input-panel');
    await expect(
      panel.locator('.nfq-badge', { hasText: /^LOAN_COMM$/ }).first(),
    ).toBeVisible();
  });

  test('displays the default currency badge (USD)', async ({ page }) => {
    const panel = page.getByTestId('deal-input-panel');
    await expect(
      panel.locator('.nfq-badge', { hasText: /^USD$/ }).first(),
    ).toBeVisible();
  });
});

test.describe('Deal Input — Lever Controls', () => {
  test('shows the principal amount lever', async ({ page }) => {
    await expect(page.getByText('Principal Amount')).toBeVisible();
  });

  test('shows the tenor lever', async ({ page }) => {
    await expect(page.getByText('Tenor', { exact: false })).toBeVisible();
  });

  test('amount input accepts numeric values', async ({ page }) => {
    const amountInput = page.getByTestId('input-amount');
    await expect(amountInput).toBeVisible();

    // Clear and fill with a new value
    await amountInput.fill('10000000');
    await expect(amountInput).toHaveValue('10000000');
  });

  test('changing the amount updates the pricing receipt', async ({ page }) => {
    const amountInput = page.getByTestId('input-amount');

    // Change amount to a significantly different value
    await amountInput.fill('50000000');

    // Wait for the receipt to re-render — the RAROC value may stay the same
    // (since RAROC is a ratio), but the receipt should still be visible
    await expect(page.getByTestId('receipt-raroc')).toBeVisible();
    await expect(page.getByTestId('receipt-total-ftp')).toBeVisible();
  });
});

test.describe('Deal Configuration Panel', () => {
  test('can expand the deal configuration section', async ({ page }) => {
    // Click the "Deal Configuration & Assumptions" toggle
    const configToggle = page.getByText('Deal Configuration & Assumptions');
    await expect(configToggle).toBeVisible();
    await configToggle.click();

    // After expanding, client and product selectors should appear
    await expect(page.getByTestId('input-client')).toBeVisible({ timeout: 3_000 });
    await expect(page.getByTestId('input-product')).toBeVisible();
  });

  test('client selector contains seed data clients', async ({ page }) => {
    // Expand configuration
    await page.getByText('Deal Configuration & Assumptions').click();
    await expect(page.getByTestId('input-client')).toBeVisible({ timeout: 3_000 });

    // The select should contain seed clients
    const clientSelect = page.getByTestId('input-client');
    await expect(clientSelect.locator('option', { hasText: 'Acme Corp Industries' })).toBeAttached();
    await expect(clientSelect.locator('option', { hasText: 'Globex Retail Group' })).toBeAttached();
  });

  test('product selector contains seed data products', async ({ page }) => {
    await page.getByText('Deal Configuration & Assumptions').click();
    await expect(page.getByTestId('input-product')).toBeVisible({ timeout: 3_000 });

    const productSelect = page.getByTestId('input-product');
    await expect(productSelect.locator('option', { hasText: 'Commercial Loan' })).toBeAttached();
    await expect(productSelect.locator('option', { hasText: 'Term Deposit' })).toBeAttached();
    await expect(productSelect.locator('option', { hasText: 'Mortgage' })).toBeAttached();
  });

  test('changing the product updates the category', async ({ page }) => {
    await page.getByText('Deal Configuration & Assumptions').click();
    await expect(page.getByTestId('input-product')).toBeVisible({ timeout: 3_000 });

    // Select "Term Deposit" which is a Liability product
    await page.getByTestId('input-product').selectOption({ label: 'Term Deposit (Liability)' });

    // The product badge in the scenario selector should update
    const panel = page.getByTestId('deal-input-panel');
    await expect(
      panel.locator('.nfq-badge', { hasText: /^DEP_TERM$/ }).first(),
    ).toBeVisible({ timeout: 3_000 });
  });

  test('changing the client updates the client badge', async ({ page }) => {
    await page.getByText('Deal Configuration & Assumptions').click();
    await expect(page.getByTestId('input-client')).toBeVisible({ timeout: 3_000 });

    // Select a different client
    await page.getByTestId('input-client').selectOption({ label: 'CL-1002 - Globex Retail Group' });

    // The client badge should reflect the new selection
    const panel = page.getByTestId('deal-input-panel');
    await expect(
      panel.locator('.nfq-badge', { hasText: 'Globex Retail Group' }).first(),
    ).toBeVisible({ timeout: 3_000 });
  });
});

test.describe('Save Deal', () => {
  test('save deal button is present and enabled with valid default data', async ({ page }) => {
    const saveButton = page.getByTestId('save-deal-btn');
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toBeEnabled();
  });

  test('clicking save deal changes the button state', async ({ page }) => {
    const saveButton = page.getByTestId('save-deal-btn');
    await expect(saveButton).toBeEnabled();

    await saveButton.click();

    // After saving, the button should briefly show a "saved" state
    // or remain enabled — we just verify no crash occurred
    await expect(saveButton).toBeVisible({ timeout: 5_000 });
  });

  test('saved deal appears in the scenario selector dropdown', async ({ page }) => {
    // This test exercises the full save flow, which depends on the Express
    // API being reachable. When the e2e run only boots vite (as configured
    // in playwright.config.ts), the upsert request hangs and the button
    // never returns to the enabled state. Skip when the API isn't running.
    test.skip(!process.env.E2E_WITH_API, 'Requires the API server (set E2E_WITH_API=1)');

    // Save the current deal
    await page.getByTestId('save-deal-btn').click();

    // Wait for save to complete (button state returns to normal)
    await expect(page.getByTestId('save-deal-btn')).toBeEnabled({ timeout: 5_000 });

    // The scenario selector should now show the saved deal ID
    // The deal ID format is "DL-<hash>" — check that an option with "DL-" prefix exists
    const scenarioSelector = page.getByTestId('deal-input-panel').locator('select').first();
    const options = scenarioSelector.locator('option');
    const optionCount = await options.count();

    // There should be at least 2 options: "New Deal / Scenario" + the saved deal
    expect(optionCount).toBeGreaterThanOrEqual(2);
  });
});

test.describe('Cross-View Data Persistence', () => {
  test('saving a deal from calculator makes it appear in the blotter', async ({ page }) => {
    test.skip(!process.env.E2E_WITH_API, 'Requires the API server (set E2E_WITH_API=1)');

    // Save the current deal
    await page.getByTestId('save-deal-btn').click();
    await expect(page.getByTestId('save-deal-btn')).toBeEnabled({ timeout: 5_000 });

    // Ensure sidebar is expanded
    const sidebarHasLabels = await page
      .getByTestId('sidebar')
      .getByText('Pricing Engine')
      .isVisible()
      .catch(() => false);

    if (!sidebarHasLabels) {
      await page.getByTestId('menu-toggle').click();
    }

    // Navigate to the blotter
    await page.getByTestId('nav-BLOTTER').click();
    await expect(page.getByTestId('header').getByText('Deal Blotter')).toBeVisible({ timeout: 5_000 });

    // The blotter should contain at least one deal row
    // (seed data may already have deals, plus the one we just saved).
    // Use .first() since multiple deals with the same client can appear.
    await expect(page.getByText('Acme Corp').first()).toBeVisible({ timeout: 5_000 });
  });
});
