import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import {
  buildApprovalTaskForMethodologyChange,
  buildConfigChangeOperation,
  buildMethodologyChangeRequest,
} from '../utils/governanceWorkflows';
import { MOCK_GREENIUM_GRID } from '../utils/seedData';
import { registerApiMocks } from './mockApi.ts';

function buildSeededEsgGovernanceState() {
  const currentItem = MOCK_GREENIUM_GRID.find((item) => item.greenFormat === 'Green_Loan') ?? MOCK_GREENIUM_GRID[1];
  const proposedItem = {
    ...currentItem,
    adjustmentBps: -35,
    description: 'Green Loan Principles (LMA) — strengthened incentive for governed regression coverage',
  };

  const request = buildMethodologyChangeRequest({
    title: 'Increase Green Loan ESG discount',
    reason: 'Tighten Green Loan incentive to validate governed ESG repricing',
    action: 'UPDATE',
    userEmail: 'carlos.martin@nfq.es',
    userName: 'Carlos Martín',
    operations: [
      buildConfigChangeOperation('GREENIUM_GRID', 'UPDATE', {
        currentItem,
        proposedItem,
        summary: `UPDATE greenium entry ${currentItem.id}`,
      }),
    ],
  });

  return {
    request,
    task: buildApprovalTaskForMethodologyChange(request, 'Admin'),
  };
}

async function loginToDemoWorkspace(page: Page, mockOptions?: Parameters<typeof registerApiMocks>[1]) {
  await registerApiMocks(page, mockOptions);
  await page.goto('/');
  await expect(page.getByTestId('login-page')).toBeVisible({ timeout: 10_000 });

  await page.getByTestId('demo-username').fill('demo');
  await page.getByTestId('demo-password').fill('demo');
  await page.getByTestId('demo-login-btn').click();
  await expect(page.getByTestId('deal-input-panel')).toBeVisible({ timeout: 10_000 });
}

async function openRulesAndConfig(page: Page) {
  await page.getByTestId('nav-METHODOLOGY').click();
  await expect(page.getByTestId('header').getByText('Rules & Config')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole('heading', { name: /System Configuration & Master Data/i })).toBeVisible();
}

test.describe('ESG Governance Pricing', () => {
  test('applies a governed greenium change and reflects it in calculator pricing', async ({ page }) => {
    const seeded = buildSeededEsgGovernanceState();

    await loginToDemoWorkspace(page, {
      systemConfigOverrides: {
        methodology_change_requests: [seeded.request],
        approval_tasks: [seeded.task],
      },
    });

    await openRulesAndConfig(page);
    await page.getByRole('button', { name: /ESG Rate Cards/i }).click();
    await page.getByRole('button', { name: /Greenium \/ Movilización/i }).click();
    await expect(page.getByText(/ESG request waiting in governance/i)).toBeVisible();

    const closeDrawer = page.getByRole('button', { name: 'Close drawer' });
    if (await closeDrawer.isVisible()) {
      await page.keyboard.press('Escape');
    }

    await page.getByRole('button', { name: /Governance/i }).click();
    await expect(page.getByText('Methodology Governance Queue')).toBeVisible();
    await expect(page.getByRole('heading', { name: seeded.request.title })).toBeVisible();

    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText(/Reviewed by Demo User/i)).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /Apply Change/i }).click();
    await expect(page.getByRole('button', { name: /Rollback/i })).toBeVisible();

    await page.getByTestId('nav-CALCULATOR').click();
    await expect(page.getByTestId('deal-input-panel')).toBeVisible({ timeout: 5_000 });

    await page.getByText('Deal Configuration & Assumptions').click();
    const greenFormatSelect = page
      .getByTestId('deal-input-panel')
      .getByText('Green Format', { exact: true })
      .locator('xpath=following::select[1]');
    await greenFormatSelect.selectOption('Green_Loan');
    await expect(greenFormatSelect).toHaveValue('Green_Loan');

    await expect(page.getByText('Greenium / Movilización')).toBeVisible();
    await expect(page.getByText('-0.350%')).toBeVisible();
  });
});
