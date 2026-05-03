import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { buildApprovalTaskForMethodologyChange, buildMethodologyChangeRequest } from '../utils/governanceWorkflows';
import { MOCK_RULES } from '../utils/seedData';
import { registerApiMocks } from './mockApi.ts';

function buildSeededGovernanceState() {
  const baseRule = MOCK_RULES[0];
  const proposedRule = {
    ...baseRule,
    strategicSpread: (baseRule.strategicSpread ?? 0) + 7,
  };

  const request = buildMethodologyChangeRequest({
    title: 'Update commercial loan spread guardrail',
    reason: 'Raise strategic spread for governance regression coverage',
    action: 'UPDATE',
    userEmail: 'carlos.martin@nfq.es',
    userName: 'Carlos Martín',
    currentRule: baseRule,
    proposedRule,
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
  await expect(page.getByTestId('header').getByText('Methodology')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole('heading', { name: /System Configuration & Master Data/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Governance/i })).toBeVisible();
}

async function openGovernanceTab(page: Page) {
  await page.getByRole('button', { name: /Governance/i }).click();
  await expect(page.getByText('Methodology Governance Queue')).toBeVisible();
}

test.describe('Rules Governance', () => {
  test('submitting a new rule creates a queued request that the submitter cannot self-approve', async ({ page }) => {
    await loginToDemoWorkspace(page);
    await openRulesAndConfig(page);

    await page.getByRole('button', { name: /Add Rule/i }).click();
    await expect(page.getByRole('heading', { name: 'New Rule' })).toBeVisible();
    await page.getByRole('button', { name: 'Submit Change' }).click();

    await expect(page.getByText(/methodology request waiting in the governance queue/i)).toBeVisible();

    await openGovernanceTab(page);

    const approveButton = page.getByRole('button', { name: 'Approve' }).first();
    await expect(approveButton).toBeDisabled();
    await expect(page.getByText(/Submitted by Demo User/i).first()).toBeVisible();
    await expect(page.getByText(/Checker role: Risk_Manager/i)).toBeVisible();
    await expect(page.getByText(/Open Approval Tasks/i)).toBeVisible();
  });

  test('a seeded governance request can be approved, applied, and audited end-to-end', async ({ page }) => {
    const seeded = buildSeededGovernanceState();

    await loginToDemoWorkspace(page, {
      systemConfigOverrides: {
        methodology_change_requests: [seeded.request],
        approval_tasks: [seeded.task],
      },
    });
    await openRulesAndConfig(page);
    await openGovernanceTab(page);

    await expect(page.getByRole('heading', { name: seeded.request.title })).toBeVisible();
    await expect(page.getByText(seeded.request.reason).first()).toBeVisible();

    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText(/Reviewed by Demo User/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Apply to Live Rules/i })).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /Apply to Live Rules/i }).click();

    await expect(page.getByRole('button', { name: /Rollback/i })).toBeVisible();
    await expect(page.getByText('Methodology 0001').first()).toBeVisible();
    await expect(page.getByText(/\d+ active rules/i).first()).toBeVisible();

    await page.getByTestId('sidebar-more-toggle').click();
    await page.getByTestId('nav-AUDIT_LOG').click();
    await expect(page.getByTestId('header').getByText('System Audit')).toBeVisible({ timeout: 5_000 });

    await expect(page.getByText('APPROVE_METHOD_CHANGE')).toBeVisible();
    await expect(page.getByText('APPLY_METHOD_CHANGE')).toBeVisible();
    await expect(page.getByText(new RegExp(seeded.request.id)).first()).toBeVisible();
  });
});
