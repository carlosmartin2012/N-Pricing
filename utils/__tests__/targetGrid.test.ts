import { describe, it, expect } from 'vitest';
import {
  synthesizeCanonicalDeal,
  generateDimensionCombos,
} from '../targetGrid/synthesizer';
import { diffGridCells, filterSignificantDiffs, summarizeDiff } from '../targetGrid/diff';
import { extractDimensions } from '../targetGrid/gridCompute';
import type { TargetGridCell } from '../../types/targetGrid';
import type { FTPResult } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_RESULT: FTPResult = {
  baseRate: 0.03,
  liquiditySpread: 0.005,
  _liquidityPremiumDetails: 0,
  _clcChargeDetails: 0,
  strategicSpread: 0.001,
  optionCost: 0,
  regulatoryCost: 0.001,
  operationalCost: 0.0025,
  capitalCharge: 0.015,
  esgTransitionCharge: 0,
  esgPhysicalCharge: 0,
  floorPrice: 0.05,
  technicalPrice: 0.065,
  targetPrice: 0.07,
  totalFTP: 0.055,
  finalClientRate: 0.07,
  raroc: 0.12,
  economicProfit: 5000,
  approvalLevel: 'Auto',
  accountingEntry: { source: 'pool', dest: 'desk', amountDebit: 1000, amountCredit: 1000 },
  matchedMethodology: 'matched',
  matchReason: 'test',
};

function makeCell(overrides: Partial<TargetGridCell>): TargetGridCell {
  return {
    id: 'cell-1',
    snapshotId: 'snap-1',
    product: 'LOAN_COMM',
    segment: 'Corporate',
    tenorBucket: '3-5Y',
    currency: 'EUR',
    canonicalDealInput: {},
    ftp: 0.055,
    liquidityPremium: 0.005,
    capitalCharge: 0.015,
    esgAdjustment: 0,
    targetMargin: 0.015,
    targetClientRate: 0.07,
    targetRaroc: 0.12,
    components: EMPTY_RESULT,
    computedAt: '2026-04-13T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Synthesizer tests
// ---------------------------------------------------------------------------

describe('synthesizer', () => {
  it('generates a canonical deal from a dimension combo', () => {
    const deal = synthesizeCanonicalDeal({
      product: 'Commercial Loan',
      segment: 'Corporate',
      tenorBucket: '3-5Y',
      currency: 'EUR',
    });

    expect(deal.productType).toBe('Commercial Loan');
    expect(deal.currency).toBe('EUR');
    expect(deal.durationMonths).toBe(60); // DEFAULT_CANONICAL_VALUES.tenorMonths
    expect(deal.category).toBe('Asset');
    expect(deal.amount).toBe(1_000_000);
  });

  it('uses template values when provided', () => {
    const deal = synthesizeCanonicalDeal(
      {
        product: 'Commercial Loan',
        segment: 'SME',
        tenorBucket: '1-3Y',
        currency: 'USD',
        entityId: 'entity-1',
      },
      {
        id: 'tpl-1',
        product: 'Commercial Loan',
        segment: 'SME',
        tenorBucket: '1-3Y',
        currency: 'USD',
        entityId: 'entity-1',
        template: {
          amount: 500_000,
          tenorMonths: 30,
          rating: 'A',
          clientType: 'SME',
          riskWeight: 0.5,
          capitalRatio: 0.1,
          targetROE: 0.15,
          operationalCostBps: 20,
          amortization: 'French',
          repricingFreq: 'Quarterly',
          transitionRisk: 'Green',
          physicalRisk: 'Low',
          marginTarget: 0.005,
        },
        editableByRole: ['admin'],
        updatedAt: '2026-04-13',
      },
    );

    expect(deal.amount).toBe(500_000);
    expect(deal.durationMonths).toBe(30);
    expect(deal.clientType).toBe('SME');
    expect(deal.riskWeight).toBe(0.5);
    expect(deal.amortization).toBe('French');
    expect(deal.entityId).toBe('entity-1');
    expect(deal.transitionRisk).toBe('Green');
  });

  it('infers Liability category for deposits', () => {
    const deal = synthesizeCanonicalDeal({
      product: 'Term Deposit',
      segment: 'Retail',
      tenorBucket: '0-1Y',
      currency: 'EUR',
    });
    expect(deal.category).toBe('Liability');
  });

  it('generates all dimension combos', () => {
    const combos = generateDimensionCombos({
      products: ['Loan', 'Deposit'],
      segments: ['Corp', 'Retail'],
      tenorBuckets: ['0-1Y', '1-3Y'],
      currencies: ['EUR'],
    });

    expect(combos).toHaveLength(8); // 2 × 2 × 2 × 1
  });

  it('filters invalid combos', () => {
    const combos = generateDimensionCombos(
      {
        products: ['Loan', 'Deposit'],
        segments: ['Corp', 'Retail'],
        tenorBuckets: ['0-1Y', '1-3Y'],
        currencies: ['EUR'],
      },
      (c) => !(c.product === 'Deposit' && c.segment === 'Corp'),
    );

    expect(combos).toHaveLength(6); // 8 - 2 (Deposit+Corp combos)
  });
});

// ---------------------------------------------------------------------------
// Diff tests
// ---------------------------------------------------------------------------

describe('diff', () => {
  it('detects no changes for identical grids', () => {
    const cells = [makeCell({})];
    const diffs = diffGridCells(cells, cells);

    expect(diffs).toHaveLength(1);
    expect(diffs[0].isNew).toBe(false);
    expect(diffs[0].isRemoved).toBe(false);
    expect(diffs[0].isSignificant).toBe(false);
    expect(diffs[0].ftpDiffBps).toBe(0);
  });

  it('detects new cells', () => {
    const fromCells: TargetGridCell[] = [];
    const toCells = [makeCell({})];
    const diffs = diffGridCells(fromCells, toCells);

    expect(diffs).toHaveLength(1);
    expect(diffs[0].isNew).toBe(true);
    expect(diffs[0].isRemoved).toBe(false);
  });

  it('detects removed cells', () => {
    const fromCells = [makeCell({})];
    const toCells: TargetGridCell[] = [];
    const diffs = diffGridCells(fromCells, toCells);

    expect(diffs).toHaveLength(1);
    expect(diffs[0].isNew).toBe(false);
    expect(diffs[0].isRemoved).toBe(true);
  });

  it('detects significant FTP changes', () => {
    const fromCells = [makeCell({ ftp: 0.055 })];
    const toCells = [makeCell({ ftp: 0.06 })]; // +50bps
    const diffs = diffGridCells(fromCells, toCells);

    expect(diffs).toHaveLength(1);
    expect(diffs[0].isSignificant).toBe(true);
    expect(diffs[0].ftpDiffBps).toBeCloseTo(50, 0);
  });

  it('detects significant RAROC changes', () => {
    const fromCells = [makeCell({ targetRaroc: 0.12 })];
    const toCells = [makeCell({ targetRaroc: 0.10 })]; // -2pp
    const diffs = diffGridCells(fromCells, toCells);

    expect(diffs).toHaveLength(1);
    expect(diffs[0].isSignificant).toBe(true);
    expect(diffs[0].rarocDiffPp).toBeCloseTo(-2, 0);
  });

  it('ignores insignificant changes below threshold', () => {
    const fromCells = [makeCell({ ftp: 0.055 })];
    const toCells = [makeCell({ ftp: 0.05502 })]; // +0.2bps (below 5bp threshold)
    const diffs = diffGridCells(fromCells, toCells);

    expect(diffs).toHaveLength(1);
    expect(diffs[0].isSignificant).toBe(false);
  });

  it('uses custom thresholds', () => {
    const fromCells = [makeCell({ ftp: 0.055 })];
    const toCells = [makeCell({ ftp: 0.0553 })]; // +3bps
    const diffs = diffGridCells(fromCells, toCells, {
      ftpBps: 2, // threshold = 2bps
      marginBps: 5,
      clientRateBps: 5,
      rarocPp: 0.5,
    });

    expect(diffs[0].isSignificant).toBe(true);
  });

  it('filterSignificantDiffs works correctly', () => {
    const fromCells = [
      makeCell({ product: 'A', ftp: 0.055 }),
      makeCell({ product: 'B', ftp: 0.055 }),
    ];
    const toCells = [
      makeCell({ product: 'A', ftp: 0.06 }), // significant
      makeCell({ product: 'B', ftp: 0.0551 }), // not significant
    ];
    const diffs = diffGridCells(fromCells, toCells);
    const significant = filterSignificantDiffs(diffs);

    expect(significant).toHaveLength(1);
    expect(significant[0].product).toBe('A');
  });

  it('summarizeDiff provides correct counts', () => {
    const fromCells = [makeCell({ product: 'A' })];
    const toCells = [
      makeCell({ product: 'A', ftp: 0.06 }),
      makeCell({ product: 'B' }),
    ];
    const diffs = diffGridCells(fromCells, toCells);
    const summary = summarizeDiff(diffs);

    expect(summary.totalCells).toBe(2);
    expect(summary.newCount).toBe(1);
    expect(summary.changedCount).toBe(1);
    expect(summary.removedCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Grid compute helpers
// ---------------------------------------------------------------------------

describe('extractDimensions', () => {
  it('extracts unique dimensions from cells', () => {
    const cells = [
      makeCell({ product: 'Loan', segment: 'Corp', tenorBucket: '0-1Y', currency: 'EUR' }),
      makeCell({ product: 'Loan', segment: 'Retail', tenorBucket: '1-3Y', currency: 'EUR' }),
      makeCell({ product: 'Deposit', segment: 'Corp', tenorBucket: '0-1Y', currency: 'USD' }),
    ];

    const dims = extractDimensions(cells);
    expect(dims.products).toEqual(['Deposit', 'Loan']);
    expect(dims.segments).toEqual(['Corp', 'Retail']);
    expect(dims.tenorBuckets).toEqual(['0-1Y', '1-3Y']);
    expect(dims.currencies).toEqual(['EUR', 'USD']);
  });
});
