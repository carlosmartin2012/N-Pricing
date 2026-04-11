import type {
  ApprovalMatrixConfig,
  ApprovalTask,
  ApprovalTaskRole,
  ApprovalTaskStatus,
  FTPResult,
  GeneralRule,
  MarketDataSource,
  MethodologyVersion,
  PortfolioSnapshot,
  PricingDossier,
  PricingDossierStatus,
  PricingRunContext,
  Transaction,
} from '../../types';
import { buildDossierGroundedContext } from '../aiGrounding';
import {
  batchReprice,
  DEFAULT_PRICING_SHOCKS,
  type PricingContext,
  type PricingShocks,
} from '../pricingEngine';
import {
  buildCorrelation,
  buildTaskDecisionFields,
  createGovernanceId,
  nowIso,
} from './common';
import { getLiveMethodologyVersionId } from './methodology';

export function buildPricingRunContext({
  rules,
  methodologyVersions,
  result,
  approvalMatrix,
  shocks = DEFAULT_PRICING_SHOCKS,
  yieldCurveCount,
  liquidityCurveCount,
}: {
  rules: GeneralRule[];
  methodologyVersions: MethodologyVersion[];
  result: FTPResult;
  approvalMatrix: ApprovalMatrixConfig;
  shocks?: PricingShocks;
  yieldCurveCount: number;
  liquidityCurveCount: number;
}): PricingRunContext {
  return {
    methodologyVersionId: methodologyVersions[0]?.id || getLiveMethodologyVersionId(rules),
    matchedMethodology: result.matchedMethodology,
    marketDataAsOf: nowIso().split('T')[0],
    approvalMatrix,
    shocksApplied: {
      interestRate: shocks.interestRate,
      liquiditySpread: shocks.liquiditySpread,
    },
    curveCounts: {
      yield: yieldCurveCount,
      liquidity: liquidityCurveCount,
    },
    ruleCount: rules.length,
  };
}

function buildPricingEvidence(
  deal: Transaction,
  result: FTPResult,
  actorEmail: string,
  actorName: string
): PricingDossier['evidence'] {
  const createdAt = nowIso();
  return [
    {
      id: createGovernanceId('EVD'),
      type: 'PRICING_RECEIPT',
      label: `Pricing receipt for ${deal.id || 'new deal'}`,
      format: 'pdf',
      createdAt,
      createdByEmail: actorEmail,
      createdByName: actorName,
      status: 'Pending_Generation',
      metadata: {
        approvalLevel: result.approvalLevel,
      },
    },
    {
      id: createGovernanceId('EVD'),
      type: 'AUDIT_TRACE',
      label: `Pricing trace ${deal.id || 'new deal'}`,
      format: 'json',
      createdAt,
      createdByEmail: actorEmail,
      createdByName: actorName,
      status: 'Generated',
      metadata: {
        matchedMethodology: result.matchedMethodology,
        formulaUsed: result.formulaUsed || null,
      },
    },
  ];
}

export function buildPricingDossier({
  deal,
  result,
  approvalMatrix,
  shocks,
  rules,
  methodologyVersions,
  currentUser,
  yieldCurveCount,
  liquidityCurveCount,
  marketDataSources = [],
  portfolioSnapshots = [],
  status,
}: {
  deal: Transaction;
  result: FTPResult;
  approvalMatrix: ApprovalMatrixConfig;
  shocks?: PricingShocks;
  rules: GeneralRule[];
  methodologyVersions: MethodologyVersion[];
  currentUser: {
    email: string;
    name: string;
  };
  yieldCurveCount: number;
  liquidityCurveCount: number;
  marketDataSources?: MarketDataSource[];
  portfolioSnapshots?: PortfolioSnapshot[];
  status?: PricingDossierStatus;
}): PricingDossier {
  const id = createGovernanceId('DOS');
  const correlation = buildCorrelation({
    dealId: deal.id,
    dossierId: id,
  });
  const runContext = buildPricingRunContext({
    rules,
    methodologyVersions,
    result,
    approvalMatrix,
    shocks,
    yieldCurveCount,
    liquidityCurveCount,
  });
  const dossierStatus = status || (result.approvalLevel === 'Auto' ? 'Approved' : 'Pending_Approval');
  const timestamp = nowIso();
  const evidence = buildPricingEvidence(deal, result, currentUser.email, currentUser.name);
  const draftDossier: PricingDossier = {
    id,
    dealId: deal.id || createGovernanceId('DEAL'),
    status: dossierStatus,
    title: `Pricing dossier ${deal.id || 'NEW'}`,
    clientId: deal.clientId,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdByEmail: currentUser.email,
    createdByName: currentUser.name,
    methodologyVersionId: runContext.methodologyVersionId,
    approvalLevel: result.approvalLevel,
    dealSnapshot: JSON.parse(JSON.stringify(deal)) as Transaction,
    pricingResult: JSON.parse(JSON.stringify(result)) as FTPResult,
    runContext,
    evidence,
    correlation,
  };
  const groundedContext = buildDossierGroundedContext({
    dossier: draftDossier,
    methodologyVersions,
    marketDataSources,
    portfolioSnapshots,
  });

  return {
    ...draftDossier,
    groundedContext,
    aiResponseTraces: [],
  };
}

export function upsertPricingDossier(dossiers: PricingDossier[], dossier: PricingDossier): PricingDossier[] {
  const exists = dossiers.some((item) => item.dealId === dossier.dealId);
  if (exists) {
    return dossiers.map((item) => (item.dealId === dossier.dealId ? dossier : item));
  }

  return [dossier, ...dossiers];
}

export function mergePricingDossier(existing: PricingDossier | undefined, next: PricingDossier): PricingDossier {
  if (!existing) return next;

  return {
    ...next,
    id: existing.id,
    createdAt: existing.createdAt,
    createdByEmail: existing.createdByEmail,
    createdByName: existing.createdByName,
    correlation: existing.correlation,
    groundedContext: next.groundedContext || existing.groundedContext,
    aiResponseTraces: next.aiResponseTraces?.length ? next.aiResponseTraces : existing.aiResponseTraces,
  };
}

export function buildApprovalTaskForPricingDossier(dossier: PricingDossier): ApprovalTask | null {
  if (dossier.status !== 'Pending_Approval') return null;

  const id = createGovernanceId('ATK');
  const requiredRole: ApprovalTaskRole = dossier.approvalLevel === 'L2_Committee' ? 'Admin' : 'Risk_Manager';

  return {
    id,
    scope: 'DEAL_PRICING',
    status: 'Pending',
    title: `Review ${dossier.dealId}`,
    description: `${dossier.title} requires ${dossier.approvalLevel} review`,
    requiredRole,
    submittedByEmail: dossier.createdByEmail,
    submittedByName: dossier.createdByName,
    submittedAt: dossier.createdAt,
    subject: {
      type: 'DEAL',
      id: dossier.dealId,
      label: dossier.title,
    },
    correlation: buildCorrelation({
      ...dossier.correlation,
      approvalTaskId: id,
    }),
  };
}

export function mergeApprovalTask(existing: ApprovalTask | undefined, next: ApprovalTask | null): ApprovalTask | null {
  if (!next) return null;
  if (!existing) return next;
  if (existing.status !== 'Pending') return next;

  return {
    ...next,
    id: existing.id,
    submittedAt: existing.submittedAt,
    correlation: {
      ...next.correlation,
      approvalTaskId: existing.id,
    },
  };
}

export function updatePricingDossierStatus(
  dossiers: PricingDossier[],
  dealId: string,
  status: PricingDossierStatus
): PricingDossier[] {
  return dossiers.map((dossier) =>
    dossier.dealId === dealId
      ? {
          ...dossier,
          status,
          updatedAt: nowIso(),
        }
      : dossier
  );
}

export function updateDealApprovalTasks(
  tasks: ApprovalTask[],
  dealId: string,
  status: PricingDossierStatus,
  actorEmail: string,
  actorName: string
): ApprovalTask[] {
  return tasks.map((task) => {
    if (task.scope !== 'DEAL_PRICING' || task.subject.id !== dealId) {
      return task;
    }

    let nextStatus: ApprovalTaskStatus = task.status;
    if (status === 'Approved') nextStatus = 'Approved';
    if (status === 'Rejected') nextStatus = 'Rejected';
    if (status === 'Booked') nextStatus = 'Completed';
    if (status === 'Draft') nextStatus = 'Cancelled';

    return {
      ...task,
      status: nextStatus,
      ...(status === 'Draft'
        ? {
            decidedByEmail: undefined,
            decidedByName: undefined,
            decidedAt: undefined,
          }
        : buildTaskDecisionFields(actorEmail, actorName)),
    };
  });
}

function buildPortfolioResult(deal: Transaction, result: FTPResult) {
  return {
    dealId: deal.id || createGovernanceId('DEAL'),
    currency: deal.currency,
    amount: deal.amount,
    raroc: result.raroc,
    finalClientRate: result.finalClientRate,
    approvalLevel: result.approvalLevel,
  };
}

export function buildPortfolioSnapshot({
  name,
  scenario,
  deals,
  approvalMatrix,
  pricingContext,
  createdByEmail,
  createdByName,
}: {
  name: string;
  scenario: import('../../types').PortfolioScenario;
  deals: Transaction[];
  approvalMatrix: ApprovalMatrixConfig;
  pricingContext: PricingContext;
  createdByEmail: string;
  createdByName: string;
}): import('../../types').PortfolioSnapshot {
  const repriced = batchReprice(deals, approvalMatrix, pricingContext, scenario.shocks);
  const results = deals
    .filter((deal) => deal.id && repriced.has(deal.id))
    .map((deal) => buildPortfolioResult(deal, repriced.get(deal.id!) as FTPResult));
  const exposure = results.reduce((total, item) => total + item.amount, 0);
  const averageRaroc = results.length ? results.reduce((total, item) => total + item.raroc, 0) / results.length : 0;
  const averageFinalRate = results.length
    ? results.reduce((total, item) => total + item.finalClientRate, 0) / results.length
    : 0;

  return {
    id: createGovernanceId('PORT'),
    name,
    scenario,
    createdAt: nowIso(),
    createdByEmail,
    createdByName,
    dealIds: results.map((item) => item.dealId),
    totals: {
      exposure,
      averageRaroc,
      averageFinalRate,
      approved: results.filter((item) => item.approvalLevel === 'Auto').length,
      pendingApproval: results.filter((item) => ['L1_Manager', 'L2_Committee'].includes(item.approvalLevel)).length,
      rejected: results.filter((item) => item.approvalLevel === 'Rejected').length,
    },
    results,
  };
}
