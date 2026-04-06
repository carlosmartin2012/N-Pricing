import { describe, expect, it } from 'vitest';
import {
  MOCK_BEHAVIOURAL_MODELS,
  MOCK_BUSINESS_UNITS,
  MOCK_CLIENTS,
  MOCK_DEALS,
  MOCK_FTP_RATE_CARDS,
  MOCK_LIQUIDITY_CURVES,
  MOCK_PHYSICAL_GRID,
  MOCK_PRODUCT_DEFS,
  MOCK_RULES,
  MOCK_TRANSITION_GRID,
  MOCK_YIELD_CURVE,
} from '../../constants';
import type { ApprovalMatrixConfig, FTPResult, GeneralRule, Transaction } from '../../types';
import { buildPricingContext } from '../pricingContext';
import {
  applyMethodologyChangeRequestToRules,
  applyMethodologyChangeRequestToCollection,
  buildApprovalTaskForMethodologyChange,
  buildApprovalTaskForPricingDossier,
  buildConfigChangeOperation,
  buildMethodologyChangeRequest,
  buildPortfolioSnapshot,
  buildPricingDossier,
  canReviewMethodologyChangeRequest,
  createMethodologyVersionSnapshot,
  mergeApprovalTask,
  mergePricingDossier,
  reviewMethodologyChangeRequest,
  rollbackMethodologyChangeRequestToCollection,
  rollbackMethodologyChangeRequestToRules,
  updateDealApprovalTasks,
  updateMethodologyApprovalTasks,
  updatePricingDossierStatus,
} from '../governanceWorkflows';

const approvalMatrix: ApprovalMatrixConfig = {
  autoApprovalThreshold: 15,
  l1Threshold: 10,
  l2Threshold: 5,
};

const baseRule: GeneralRule = {
  id: 1,
  businessUnit: 'Commercial Banking',
  product: 'Commercial Loan',
  segment: 'Corporate',
  tenor: 'Any',
  baseMethod: 'Matched Maturity',
  baseReference: 'USD-SOFR',
  spreadMethod: 'Curve Lookup',
  liquidityReference: 'USD-LIQ',
  strategicSpread: 10,
};

const baseRateCard = {
  id: 'RC-LIQ-USD',
  name: 'USD Liquidity Standard',
  type: 'Liquidity' as const,
  currency: 'USD',
  points: [{ tenor: '1Y', rate: 0.45 }],
};

const transitionEntry = {
  id: 10,
  classification: 'Neutral' as const,
  sector: 'Utilities',
  adjustmentBps: 3,
  description: 'Baseline transition premium',
};

const baseDeal: Transaction = {
  id: 'TRD-100',
  status: 'Pending_Approval',
  clientId: 'CL-1001',
  clientType: 'Corporate',
  businessUnit: 'Commercial Banking',
  fundingBusinessUnit: 'Treasury',
  businessLine: 'Corporate',
  productType: 'LOAN_COMM',
  category: 'Asset',
  currency: 'USD',
  amount: 5_000_000,
  startDate: '2026-04-02',
  durationMonths: 24,
  amortization: 'Bullet',
  repricingFreq: 'Fixed',
  marginTarget: 2.2,
  riskWeight: 100,
  capitalRatio: 11.5,
  targetROE: 15,
  operationalCostBps: 40,
  transitionRisk: 'Neutral',
  physicalRisk: 'Low',
};

const pendingApprovalResult: FTPResult = {
  baseRate: 3.5,
  liquiditySpread: 0.4,
  _liquidityPremiumDetails: 0.25,
  _clcChargeDetails: 0.15,
  strategicSpread: 0.1,
  optionCost: 0,
  regulatoryCost: 0.2,
  operationalCost: 0.4,
  capitalCharge: 1.1,
  esgTransitionCharge: 0,
  esgPhysicalCharge: 0,
  floorPrice: 5.2,
  technicalPrice: 5.8,
  targetPrice: 6.1,
  totalFTP: 4.2,
  finalClientRate: 6.4,
  raroc: 9.8,
  economicProfit: 120000,
  approvalLevel: 'L1_Manager',
  accountingEntry: {
    source: 'FTP',
    dest: 'Pool',
    amountDebit: 5_000_000,
    amountCredit: 5_000_000,
  },
  matchedMethodology: 'MatchedMaturity',
  matchReason: 'Matched against commercial banking rule',
  formulaUsed: 'Base + LP + capital',
};

describe('governanceWorkflows', () => {
  it('creates a methodology change request and checker task for rule updates', () => {
    const updatedRule: GeneralRule = {
      ...baseRule,
      strategicSpread: 15,
    };

    const request = buildMethodologyChangeRequest({
      action: 'UPDATE',
      reason: 'Increase spread for corporate loans',
      userEmail: 'maker@example.com',
      userName: 'Maker User',
      currentRule: baseRule,
      proposedRule: updatedRule,
    });
    const task = buildApprovalTaskForMethodologyChange(request);

    expect(request.status).toBe('Pending_Review');
    expect(request.operations).toHaveLength(1);
    expect(request.operations[0].summary).toContain('UPDATE');
    expect(task.scope).toBe('METHODOLOGY_CHANGE');
    expect(task.requiredRole).toBe('Risk_Manager');
    expect(task.subject.id).toBe(request.id);
  });

  it('supports review, apply, versioning and rollback for methodology changes', () => {
    const updatedRule: GeneralRule = {
      ...baseRule,
      strategicSpread: 20,
    };

    const request = buildMethodologyChangeRequest({
      action: 'UPDATE',
      reason: 'Increase spread for stressed sector',
      userEmail: 'maker@example.com',
      userName: 'Maker User',
      currentRule: baseRule,
      proposedRule: updatedRule,
    });

    expect(canReviewMethodologyChangeRequest(request, 'maker@example.com', 'Risk_Manager')).toBe(false);
    expect(canReviewMethodologyChangeRequest(request, 'checker@example.com', 'Risk_Manager')).toBe(true);

    const reviewed = reviewMethodologyChangeRequest(request, {
      actorEmail: 'checker@example.com',
      actorName: 'Checker User',
      decision: 'Approved',
    });
    const applied = applyMethodologyChangeRequestToRules(reviewed, [baseRule], {
      actorEmail: 'checker@example.com',
      actorName: 'Checker User',
    });
    const version = createMethodologyVersionSnapshot({
      rules: applied.rules,
      previousVersions: [],
      actorEmail: 'checker@example.com',
      actorName: 'Checker User',
      reason: 'Applied change request',
      sourceChangeRequestId: request.id,
    });
    const rolledBack = rollbackMethodologyChangeRequestToRules(applied.request, applied.rules, {
      actorEmail: 'checker@example.com',
      actorName: 'Checker User',
    });

    expect(reviewed.status).toBe('Approved');
    expect(applied.request.status).toBe('Applied');
    expect(applied.rules[0].strategicSpread).toBe(20);
    expect(version.sourceChangeRequestId).toBe(request.id);
    expect(rolledBack.request.status).toBe('Rolled_Back');
    expect(rolledBack.rules[0].strategicSpread).toBe(baseRule.strategicSpread);
  });

  it('creates pricing dossier and approval task and preserves ids on merge', () => {
    const dossier = buildPricingDossier({
      deal: baseDeal,
      result: pendingApprovalResult,
      approvalMatrix,
      rules: [baseRule],
      methodologyVersions: [],
      currentUser: {
        email: 'trader@example.com',
        name: 'Trader User',
      },
      yieldCurveCount: 2,
      liquidityCurveCount: 1,
      status: 'Pending_Approval',
    });
    const task = buildApprovalTaskForPricingDossier(dossier);

    expect(dossier.status).toBe('Pending_Approval');
    expect(dossier.methodologyVersionId).toContain('LIVE-');
    expect(dossier.evidence.some((evidence) => evidence.type === 'PRICING_RECEIPT')).toBe(true);
    expect(task?.scope).toBe('DEAL_PRICING');
    expect(task?.status).toBe('Pending');

    const mergedDossier = mergePricingDossier(dossier, {
      ...dossier,
      id: 'DOS-NEW',
      updatedAt: '2026-04-03T10:00:00.000Z',
    });
    const mergedTask = mergeApprovalTask(task || undefined, task ? { ...task, id: 'ATK-NEW' } : null);

    expect(mergedDossier.id).toBe(dossier.id);
    expect(mergedTask?.id).toBe(task?.id);
  });

  it('builds a repriced portfolio snapshot from governed market and methodology state', () => {
    const pricingContext = buildPricingContext(
      {
        yieldCurves: MOCK_YIELD_CURVE,
        liquidityCurves: MOCK_LIQUIDITY_CURVES,
        rules: MOCK_RULES,
        ftpRateCards: MOCK_FTP_RATE_CARDS,
        transitionGrid: MOCK_TRANSITION_GRID,
        physicalGrid: MOCK_PHYSICAL_GRID,
        behaviouralModels: MOCK_BEHAVIOURAL_MODELS,
      },
      {
        clients: MOCK_CLIENTS,
        products: MOCK_PRODUCT_DEFS,
        businessUnits: MOCK_BUSINESS_UNITS,
      }
    );

    const snapshot = buildPortfolioSnapshot({
      name: 'Quarterly Governance Snapshot',
      scenario: {
        id: 'SCN-001',
        name: 'Base',
        description: 'Live market data',
        shocks: {
          interestRate: 10,
          liquiditySpread: 5,
        },
        createdAt: '2026-04-02T10:00:00.000Z',
        createdByEmail: 'risk@example.com',
        createdByName: 'Risk User',
      },
      deals: MOCK_DEALS.slice(0, 3),
      approvalMatrix,
      pricingContext,
      createdByEmail: 'risk@example.com',
      createdByName: 'Risk User',
    });

    expect(snapshot.id).toContain('PORT-');
    expect(snapshot.results).toHaveLength(3);
    expect(snapshot.totals.exposure).toBeGreaterThan(0);
    expect(Number.isFinite(snapshot.totals.averageRaroc)).toBe(true);
    expect(snapshot.scenario.shocks.interestRate).toBe(10);
  });

  it('updates dossier and approval task statuses along the workflow', () => {
    const dossier = buildPricingDossier({
      deal: baseDeal,
      result: pendingApprovalResult,
      approvalMatrix,
      rules: [baseRule],
      methodologyVersions: [],
      currentUser: {
        email: 'trader@example.com',
        name: 'Trader User',
      },
      yieldCurveCount: 1,
      liquidityCurveCount: 1,
      status: 'Pending_Approval',
    });
    const task = buildApprovalTaskForPricingDossier(dossier);

    const approvedDossiers = updatePricingDossierStatus([dossier], baseDeal.id!, 'Approved');
    const approvedTasks = updateDealApprovalTasks(
      [task as NonNullable<typeof task>],
      baseDeal.id!,
      'Approved',
      'checker@example.com',
      'Checker User'
    );
    const closedMethodTasks = updateMethodologyApprovalTasks(
      [
        buildApprovalTaskForMethodologyChange(
          buildMethodologyChangeRequest({
            action: 'UPDATE',
            reason: 'Tighten spread floor',
            userEmail: 'maker@example.com',
            userName: 'Maker User',
            currentRule: baseRule,
            proposedRule: { ...baseRule, strategicSpread: 12 },
          })
        ),
      ],
      'missing-id',
      'Completed',
      'checker@example.com',
      'Checker User'
    );

    expect(approvedDossiers[0].status).toBe('Approved');
    expect(approvedTasks[0].status).toBe('Approved');
    expect(approvedTasks[0].decidedByEmail).toBe('checker@example.com');
    expect(closedMethodTasks[0].status).toBe('Pending');
  });

  it('cancels stale deal approval tasks on rework and creates a fresh task on resubmission', () => {
    const dossier = buildPricingDossier({
      deal: baseDeal,
      result: pendingApprovalResult,
      approvalMatrix,
      rules: [baseRule],
      methodologyVersions: [],
      currentUser: {
        email: 'trader@example.com',
        name: 'Trader User',
      },
      yieldCurveCount: 1,
      liquidityCurveCount: 1,
      status: 'Pending_Approval',
    });
    const pendingTask = buildApprovalTaskForPricingDossier(dossier);
    const rejectedTasks = updateDealApprovalTasks(
      [pendingTask as NonNullable<typeof pendingTask>],
      baseDeal.id!,
      'Rejected',
      'checker@example.com',
      'Checker User'
    );
    const reworkedTasks = updateDealApprovalTasks(
      rejectedTasks,
      baseDeal.id!,
      'Draft',
      'trader@example.com',
      'Trader User'
    );
    const resubmittedTask = mergeApprovalTask(
      reworkedTasks[0],
      buildApprovalTaskForPricingDossier({
        ...dossier,
        status: 'Pending_Approval',
      })
    );

    expect(reworkedTasks[0].status).toBe('Cancelled');
    expect(reworkedTasks[0].decidedAt).toBeUndefined();
    expect(resubmittedTask?.id).not.toBe(reworkedTasks[0].id);
  });

  it('applies and rolls back governed collection changes for rate cards and ESG grids', () => {
    const updatedRateCard = {
      ...baseRateCard,
      points: [{ tenor: '1Y', rate: 0.65 }],
    };
    const updatedTransitionEntry = {
      ...transitionEntry,
      adjustmentBps: 8,
    };

    const rateCardRequest = buildMethodologyChangeRequest({
      title: 'Update USD liquidity curve',
      reason: 'Reprice USD liquidity add-on',
      action: 'UPDATE',
      userEmail: 'maker@example.com',
      userName: 'Maker User',
      operations: [
        buildConfigChangeOperation('RATE_CARD', 'UPDATE', {
          currentItem: baseRateCard,
          proposedItem: updatedRateCard,
          summary: 'UPDATE rate card USD Liquidity Standard',
        }),
      ],
    });
    const transitionRequest = buildMethodologyChangeRequest({
      title: 'Update transition grid',
      reason: 'Raise utilities transition premium',
      action: 'UPDATE',
      userEmail: 'maker@example.com',
      userName: 'Maker User',
      operations: [
        buildConfigChangeOperation('TRANSITION_GRID', 'UPDATE', {
          currentItem: transitionEntry,
          proposedItem: updatedTransitionEntry,
          summary: 'UPDATE transition grid utilities',
        }),
      ],
    });

    const appliedRateCards = applyMethodologyChangeRequestToCollection(rateCardRequest, [baseRateCard], {
      actorEmail: 'checker@example.com',
      actorName: 'Checker User',
    });
    const rolledBackRateCards = rollbackMethodologyChangeRequestToCollection(
      appliedRateCards.request,
      appliedRateCards.items,
      {
        actorEmail: 'checker@example.com',
        actorName: 'Checker User',
      }
    );
    const appliedTransitionGrid = applyMethodologyChangeRequestToCollection(transitionRequest, [transitionEntry], {
      actorEmail: 'checker@example.com',
      actorName: 'Checker User',
    });

    expect(appliedRateCards.items[0].points[0].rate).toBe(0.65);
    expect(rolledBackRateCards.items[0].points[0].rate).toBe(0.45);
    expect(appliedTransitionGrid.items[0].adjustmentBps).toBe(8);

    const baselineVersion = createMethodologyVersionSnapshot({
      rules: [baseRule],
      previousVersions: [],
      actorEmail: 'checker@example.com',
      actorName: 'Checker User',
      reason: 'Baseline',
      configSeed: { ftpRateCards: [baseRateCard], transitionGrid: [transitionEntry] },
    });
    const changedVersion = createMethodologyVersionSnapshot({
      rules: [baseRule],
      previousVersions: [baselineVersion],
      actorEmail: 'checker@example.com',
      actorName: 'Checker User',
      reason: 'Applied config change',
      configSeed: { ftpRateCards: [updatedRateCard], transitionGrid: [updatedTransitionEntry] },
    });

    expect(changedVersion.fingerprint).not.toBe(baselineVersion.fingerprint);
  });
});
