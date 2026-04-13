/**
 * Grid Compute — orchestrates the computation of the target pricing grid.
 *
 * For each dimension combination:
 *   1. Synthesizes a canonical deal from the template
 *   2. Invokes pricingEngine.calculatePricing()
 *   3. Collects results into TargetGridCell objects
 *
 * Parallelizes with Promise.all in batches to avoid saturation.
 */

import type { Transaction, ApprovalMatrixConfig, FTPResult } from '../../types';
import type {
  TargetGridCell,
  CanonicalDealTemplate,
  GridComputeOptions,
  GridComputeResult,
  TenorBucket,
} from '../../types/targetGrid';
import type { PricingContext, PricingShocks } from '../pricingEngine';
import { calculatePricing } from '../pricingEngine';
import {
  synthesizeCanonicalDeal,
  generateDimensionCombos,
} from './synthesizer';
import type { DimensionCombo, DimensionConfig } from './synthesizer';
import { createLogger } from '../logger';

const log = createLogger('targetGrid/gridCompute');

const DEFAULT_BATCH_SIZE = 50;

// ---------------------------------------------------------------------------
// Main compute function
// ---------------------------------------------------------------------------

export interface ComputeGridParams {
  config: DimensionConfig;
  templates: CanonicalDealTemplate[];
  pricingContext: PricingContext;
  approvalMatrix: ApprovalMatrixConfig;
  shocks?: PricingShocks;
  options?: Partial<GridComputeOptions>;
}

/**
 * Computes the full target pricing grid for all dimension combinations.
 * Returns an array of TargetGridCell objects ready for persistence.
 */
export async function computeTargetGrid(
  params: ComputeGridParams,
): Promise<{ cells: Omit<TargetGridCell, 'id' | 'computedAt'>[]; result: GridComputeResult }> {
  const start = Date.now();
  const batchSize = params.options?.batchSize ?? DEFAULT_BATCH_SIZE;
  const snapshotId = params.options?.snapshotId ?? '';

  // Generate all valid dimension combos
  const combos = generateDimensionCombos(params.config);
  const total = combos.length;
  const cells: Omit<TargetGridCell, 'id' | 'computedAt'>[] = [];
  const errors: { cohort: string; error: string }[] = [];

  // Index templates for fast lookup
  const templateIndex = buildTemplateIndex(params.templates);

  // Process in batches
  for (let i = 0; i < combos.length; i += batchSize) {
    const batch = combos.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map((combo) => computeSingleCell(
        combo,
        templateIndex,
        params.pricingContext,
        params.approvalMatrix,
        params.shocks,
        snapshotId,
      )),
    );

    for (const result of batchResults) {
      if (result.error) {
        errors.push({ cohort: result.cohortKey, error: result.error });
      } else if (result.cell) {
        cells.push(result.cell);
      }
    }

    // Report progress
    params.options?.onProgress?.(Math.min(i + batchSize, total), total);
  }

  const durationMs = Date.now() - start;
  log.info('Grid compute complete', { cellCount: cells.length, errors: errors.length, durationMs });

  return {
    cells,
    result: {
      snapshotId,
      cellCount: cells.length,
      durationMs,
      errors,
    },
  };
}

// ---------------------------------------------------------------------------
// Single cell computation
// ---------------------------------------------------------------------------

interface CellComputeResult {
  cohortKey: string;
  cell: Omit<TargetGridCell, 'id' | 'computedAt'> | null;
  error: string | null;
}

async function computeSingleCell(
  combo: DimensionCombo,
  templateIndex: Map<string, CanonicalDealTemplate>,
  context: PricingContext,
  approvalMatrix: ApprovalMatrixConfig,
  shocks?: PricingShocks,
  snapshotId?: string,
): Promise<CellComputeResult> {
  const cohortKey = buildCohortKey(combo);

  try {
    const template = templateIndex.get(cohortKey) ?? null;
    const deal: Transaction = synthesizeCanonicalDeal(combo, template);
    const result: FTPResult = calculatePricing(deal, approvalMatrix, context, shocks);

    const cell: Omit<TargetGridCell, 'id' | 'computedAt'> = {
      snapshotId: snapshotId ?? '',
      product: combo.product,
      segment: combo.segment,
      tenorBucket: combo.tenorBucket,
      currency: combo.currency,
      entityId: combo.entityId,
      canonicalDealInput: deal,
      ftp: result.totalFTP,
      liquidityPremium: result.liquiditySpread,
      capitalCharge: result.capitalCharge,
      esgAdjustment: (result.esgTransitionCharge ?? 0)
        + (result.esgPhysicalCharge ?? 0)
        + (result.esgGreeniumAdj ?? 0)
        + (result.esgDnshCapitalAdj ?? 0)
        + (result.esgPillar1Adj ?? 0),
      targetMargin: result.finalClientRate - result.totalFTP,
      targetClientRate: result.finalClientRate,
      targetRaroc: result.raroc,
      components: result,
    };

    return { cohortKey, cell, error: null };
  } catch (err) {
    log.error('computeSingleCell failed', { cohortKey }, err as Error);
    return { cohortKey, cell: null, error: String(err) };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCohortKey(combo: DimensionCombo): string {
  return `${combo.product}|${combo.segment}|${combo.tenorBucket}|${combo.currency}|${combo.entityId ?? ''}`;
}

function templateKey(t: { product: string; segment: string; tenorBucket: string; currency: string; entityId?: string }): string {
  return `${t.product}|${t.segment}|${t.tenorBucket}|${t.currency}|${t.entityId ?? ''}`;
}

function buildTemplateIndex(templates: CanonicalDealTemplate[]): Map<string, CanonicalDealTemplate> {
  const index = new Map<string, CanonicalDealTemplate>();
  for (const t of templates) {
    index.set(templateKey(t), t);
  }
  return index;
}

/**
 * Extracts unique dimension values from a set of grid cells.
 * Useful for building filter options in the UI.
 */
export function extractDimensions(cells: Pick<TargetGridCell, 'product' | 'segment' | 'tenorBucket' | 'currency'>[]): {
  products: string[];
  segments: string[];
  tenorBuckets: TenorBucket[];
  currencies: string[];
} {
  const products = new Set<string>();
  const segments = new Set<string>();
  const tenorBuckets = new Set<TenorBucket>();
  const currencies = new Set<string>();

  for (const cell of cells) {
    products.add(cell.product);
    segments.add(cell.segment);
    tenorBuckets.add(cell.tenorBucket);
    currencies.add(cell.currency);
  }

  return {
    products: [...products].sort(),
    segments: [...segments].sort(),
    tenorBuckets: [...tenorBuckets].sort(),
    currencies: [...currencies].sort(),
  };
}
