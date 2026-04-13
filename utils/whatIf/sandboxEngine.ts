/**
 * Sandbox Engine — applies sandbox methodology changes to compute
 * a "what-if" target grid and portfolio impact without persisting.
 *
 * The sandbox engine:
 *   1. Clones the current methodology state
 *   2. Applies diffs (parameter changes)
 *   3. Recomputes the target grid with modified params
 *   4. Compares against the current grid + portfolio for impact analysis
 */

import type {
  SandboxMethodology,
  SandboxDiff,
  ImpactReport,
  ImpactSummary,
  CellImpact,
  PortfolioImpact,
} from '../../types/whatIf';
import type { TargetGridCell } from '../../types/targetGrid';
import type { PricingContext, PricingShocks } from '../pricingEngine';
import type { ApprovalMatrixConfig, Transaction, FTPResult } from '../../types';
import { calculatePricing } from '../pricingEngine';
import { computeTargetGrid } from '../targetGrid/gridCompute';
import type { DimensionConfig } from '../targetGrid/synthesizer';
import type { CanonicalDealTemplate } from '../../types/targetGrid';

// ---------------------------------------------------------------------------
// Apply sandbox diffs to pricing context
// ---------------------------------------------------------------------------

/**
 * Creates a modified PricingContext by applying sandbox diffs.
 * Does NOT mutate the original context.
 */
export function applySandboxDiffs(
  baseContext: PricingContext,
  diffs: SandboxDiff[],
): PricingContext {
  // Deep clone to avoid mutation
  const modified = structuredClone(baseContext);

  for (const diff of diffs) {
    applyDiff(modified, diff);
  }

  return modified;
}

function applyDiff(context: PricingContext, diff: SandboxDiff): void {
  const path = diff.parameterPath;
  const value = diff.proposedValue;

  switch (diff.changeType) {
    case 'rule': {
      // Apply to matching rule by ID (path format: "rules.<id>")
      const ruleParts = path.split('.');
      const ruleId = ruleParts[1] ?? '';
      const rule = context.rules.find((r) => String(r.id) === ruleId);
      if (rule && typeof value === 'object' && value !== null) {
        Object.assign(rule, value);
      }
      break;
    }
    case 'spread': {
      // Apply strategic spread change
      const parts = path.split('.');
      if (parts[0] === 'rules') {
        const rule = context.rules.find((r) => String(r.id) === parts[1]);
        if (rule && parts[2] === 'strategicSpread') {
          rule.strategicSpread = Number(value);
        }
      }
      break;
    }
    case 'capital': {
      // No direct capital params in PricingContext; these affect RAROC inputs
      // handled at deal level
      break;
    }
    case 'esg': {
      // Apply ESG grid changes — modify transitionGrid/physicalGrid/greeniumGrid
      if (path.startsWith('transitionGrid') && Array.isArray(value)) {
        context.transitionGrid = value as PricingContext['transitionGrid'];
      } else if (path.startsWith('physicalGrid') && Array.isArray(value)) {
        context.physicalGrid = value as PricingContext['physicalGrid'];
      } else if (path.startsWith('greeniumGrid') && Array.isArray(value)) {
        context.greeniumGrid = value as PricingContext['greeniumGrid'];
      }
      break;
    }
    case 'curve': {
      // Apply curve modifications
      if (path.startsWith('yieldCurve') && Array.isArray(value)) {
        context.yieldCurve = value as PricingContext['yieldCurve'];
      } else if (path.startsWith('liquidityCurves') && Array.isArray(value)) {
        context.liquidityCurves = value as PricingContext['liquidityCurves'];
      }
      break;
    }
    case 'threshold': {
      // Apply config thresholds (SDR, LR)
      if (path.startsWith('sdrConfig') && typeof value === 'object' && value !== null) {
        context.sdrConfig = { ...context.sdrConfig, ...value as Record<string, unknown> } as NonNullable<PricingContext['sdrConfig']>;
      } else if (path.startsWith('lrConfig') && typeof value === 'object' && value !== null) {
        context.lrConfig = { ...context.lrConfig, ...value as Record<string, unknown> } as NonNullable<PricingContext['lrConfig']>;
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Compute sandbox impact
// ---------------------------------------------------------------------------

export interface SandboxComputeParams {
  sandbox: SandboxMethodology;
  baseContext: PricingContext;
  baseGrid: TargetGridCell[];
  dimensionConfig: DimensionConfig;
  templates: CanonicalDealTemplate[];
  approvalMatrix: ApprovalMatrixConfig;
  portfolio?: { deal: Transaction; result: FTPResult }[];
  shocks?: PricingShocks;
}

/**
 * Computes the full impact report for a sandbox methodology.
 */
export async function computeSandboxImpact(
  params: SandboxComputeParams,
): Promise<ImpactReport> {
  const { sandbox, baseContext, baseGrid, dimensionConfig, templates, approvalMatrix, portfolio, shocks } = params;

  // Apply diffs to get modified context
  const modifiedContext = applySandboxDiffs(baseContext, sandbox.diffs);

  // Compute new grid with modified context
  const { cells: newCells } = await computeTargetGrid({
    config: dimensionConfig,
    templates,
    pricingContext: modifiedContext,
    approvalMatrix,
    shocks,
    options: { snapshotId: `sandbox-${sandbox.id}` },
  });

  // Compare cells
  const cellImpacts = computeCellImpacts(baseGrid, newCells);
  const summary = computeImpactSummary(cellImpacts, portfolio);
  const portfolioImpact = computePortfolioImpact(
    portfolio ?? [],
    modifiedContext,
    approvalMatrix,
    shocks,
  );

  return {
    sandboxId: sandbox.id,
    baseSnapshotId: sandbox.baseSnapshotId,
    computedAt: new Date().toISOString(),
    summary,
    cellImpacts,
    portfolioImpact,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function computeCellImpacts(
  baseCells: TargetGridCell[],
  newCells: Omit<TargetGridCell, 'id' | 'computedAt'>[],
): CellImpact[] {
  const baseIndex = new Map<string, TargetGridCell>();
  for (const c of baseCells) {
    baseIndex.set(cellKey(c), c);
  }

  const impacts: CellImpact[] = [];

  for (const nc of newCells) {
    const key = cellKey(nc);
    const base = baseIndex.get(key);
    if (!base) continue;

    impacts.push({
      product: nc.product,
      segment: nc.segment,
      tenorBucket: nc.tenorBucket,
      currency: nc.currency,
      currentCell: base,
      proposedCell: nc,
      ftpDeltaBps: (nc.ftp - base.ftp) * 10_000,
      rarocDeltaPp: (nc.targetRaroc - base.targetRaroc) * 100,
      clientRateDeltaBps: (nc.targetClientRate - base.targetClientRate) * 10_000,
    });
  }

  return impacts;
}

function computeImpactSummary(
  cellImpacts: CellImpact[],
  _portfolio?: { deal: Transaction; result: FTPResult }[],
): ImpactSummary {
  const affected = cellImpacts.filter(
    (c) => Math.abs(c.ftpDeltaBps) > 1 || Math.abs(c.rarocDeltaPp) > 0.1,
  );

  const avgFtpChange = cellImpacts.length > 0
    ? cellImpacts.reduce((s, c) => s + c.ftpDeltaBps, 0) / cellImpacts.length
    : 0;
  const avgRarocChange = cellImpacts.length > 0
    ? cellImpacts.reduce((s, c) => s + c.rarocDeltaPp, 0) / cellImpacts.length
    : 0;

  return {
    totalCellsAffected: affected.length,
    avgFtpChangeBps: avgFtpChange,
    avgRarocChangePp: avgRarocChange,
    estimatedNiiDelta: 0, // Requires elasticity model for accurate estimate
    estimatedNiiDeltaPct: 0,
    volumeAtRisk: 0,
    volumeAtRiskPct: 0,
  };
}

function computePortfolioImpact(
  portfolio: { deal: Transaction; result: FTPResult }[],
  modifiedContext: PricingContext,
  approvalMatrix: ApprovalMatrixConfig,
  shocks?: PricingShocks,
): PortfolioImpact {
  if (portfolio.length === 0) {
    return {
      currentNii: 0, projectedNii: 0, niiDelta: 0,
      currentAvgRaroc: 0, projectedAvgRaroc: 0, rarocDelta: 0,
      dealCount: 0, affectedDealCount: 0,
    };
  }

  let currentNii = 0;
  let projectedNii = 0;
  let currentRarocSum = 0;
  let projectedRarocSum = 0;
  let affectedCount = 0;

  for (const { deal, result } of portfolio) {
    const currentMargin = result.finalClientRate - result.totalFTP;
    currentNii += currentMargin * deal.amount * (deal.durationMonths / 12);
    currentRarocSum += result.raroc;

    // Reprice with modified context
    const newResult = calculatePricing(deal, approvalMatrix, modifiedContext, shocks);
    const newMargin = newResult.finalClientRate - newResult.totalFTP;
    projectedNii += newMargin * deal.amount * (deal.durationMonths / 12);
    projectedRarocSum += newResult.raroc;

    if (Math.abs(newResult.totalFTP - result.totalFTP) > 0.0001) {
      affectedCount++;
    }
  }

  return {
    currentNii,
    projectedNii,
    niiDelta: projectedNii - currentNii,
    currentAvgRaroc: currentRarocSum / portfolio.length,
    projectedAvgRaroc: projectedRarocSum / portfolio.length,
    rarocDelta: ((projectedRarocSum - currentRarocSum) / portfolio.length) * 100,
    dealCount: portfolio.length,
    affectedDealCount: affectedCount,
  };
}

function cellKey(c: { product: string; segment: string; tenorBucket: string; currency: string; entityId?: string }): string {
  return `${c.product}|${c.segment}|${c.tenorBucket}|${c.currency}|${c.entityId ?? ''}`;
}
