import { describe, it, expect } from 'vitest';
import {
  resolveCohort,
  resolveTenorBucket,
  findMatchingCell,
  isValidCohort,
} from '../discipline/cohortMatcher';
import {
  computeVariance,
  computeLeakage,
  aggregateLeakage,
  averageVarianceMetrics,
} from '../discipline/varianceCalculator';
import {
  resolveToleranceBand,
  isOutOfBand,
  applyBandToVariance,
} from '../discipline/bandResolver';
import {
  aggregateByDimension,
  computeKpis,
  topOutliers,
} from '../discipline/leakageAggregator';
import type { Transaction, FTPResult } from '../../types';
import type { TargetGridCell } from '../../types/targetGrid';
import type { ToleranceBand, DealVariance, Cohort } from '../../types/discipline';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_DEAL: Transaction = {
  clientId: 'CL-001',
  clientType: 'Corporate',
  businessUnit: 'CIB',
  fundingBusinessUnit: 'CIB',
  businessLine: 'Commercial',
  productType: 'Commercial Loan',
  category: 'Asset',
  currency: 'EUR',
  amount: 1_000_000,
  startDate: '2026-01-15',
  durationMonths: 48,
  amortization: 'Bullet',
  repricingFreq: 'Fixed',
  marginTarget: 0,
  riskWeight: 0.75,
  capitalRatio: 0.08,
  targetROE: 0.12,
  operationalCostBps: 25,
  transitionRisk: 'Neutral',
  physicalRisk: 'Low',
};

const MOCK_RESULT: FTPResult = {
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
  finalClientRate: 0.072,
  raroc: 0.115,
  economicProfit: 5000,
  approvalLevel: 'Auto',
  accountingEntry: { source: 'pool', dest: 'desk', amountDebit: 1000, amountCredit: 1000 },
  matchedMethodology: 'matched',
  matchReason: 'test',
};

const MOCK_CELL: TargetGridCell = {
  id: 'cell-1',
  snapshotId: 'snap-1',
  product: 'Commercial Loan',
  segment: 'Corporate',
  tenorBucket: '3-5Y',
  currency: 'EUR',
  canonicalDealInput: {},
  ftp: 0.050,
  liquidityPremium: 0.005,
  capitalCharge: 0.015,
  esgAdjustment: 0,
  targetMargin: 0.020,
  targetClientRate: 0.070,
  targetRaroc: 0.12,
  components: MOCK_RESULT,
  computedAt: '2026-01-01',
};

const MOCK_BAND: ToleranceBand = {
  id: 'band-1',
  ftpBpsTolerance: 15,
  rarocPpTolerance: 1.5,
  priority: 100,
  active: true,
  effectiveFrom: '2026-01-01',
  createdAt: '2026-01-01',
};

// ---------------------------------------------------------------------------
// Cohort Matcher tests
// ---------------------------------------------------------------------------

describe('cohortMatcher', () => {
  describe('resolveTenorBucket', () => {
    it('maps short tenors to 0-1Y', () => {
      expect(resolveTenorBucket(6)).toBe('0-1Y');
      expect(resolveTenorBucket(12)).toBe('0-1Y');
    });

    it('maps 1-3Y tenors correctly', () => {
      expect(resolveTenorBucket(13)).toBe('1-3Y');
      expect(resolveTenorBucket(36)).toBe('1-3Y');
    });

    it('maps 3-5Y tenors correctly', () => {
      expect(resolveTenorBucket(48)).toBe('3-5Y');
      expect(resolveTenorBucket(60)).toBe('3-5Y');
    });

    it('maps 5-10Y tenors correctly', () => {
      expect(resolveTenorBucket(84)).toBe('5-10Y');
      expect(resolveTenorBucket(120)).toBe('5-10Y');
    });

    it('maps long tenors to 10Y+', () => {
      expect(resolveTenorBucket(180)).toBe('10Y+');
      expect(resolveTenorBucket(360)).toBe('10Y+');
    });
  });

  describe('resolveCohort', () => {
    it('resolves cohort from deal', () => {
      const cohort = resolveCohort(MOCK_DEAL);
      expect(cohort.product).toBe('Commercial Loan');
      expect(cohort.segment).toBe('Corporate');
      expect(cohort.tenorBucket).toBe('3-5Y');
      expect(cohort.currency).toBe('EUR');
    });
  });

  describe('findMatchingCell', () => {
    it('finds exact match', () => {
      const cohort: Cohort = { product: 'Commercial Loan', segment: 'Corporate', tenorBucket: '3-5Y', currency: 'EUR' };
      const match = findMatchingCell(cohort, [MOCK_CELL]);
      expect(match).not.toBeNull();
      expect(match?.id).toBe('cell-1');
    });

    it('returns null when no match', () => {
      const cohort: Cohort = { product: 'XYZ', segment: 'Corporate', tenorBucket: '3-5Y', currency: 'EUR' };
      expect(findMatchingCell(cohort, [MOCK_CELL])).toBeNull();
    });
  });

  describe('isValidCohort', () => {
    it('validates complete cohort', () => {
      expect(isValidCohort({ product: 'Loan', segment: 'Corp', tenorBucket: '0-1Y', currency: 'EUR' })).toBe(true);
    });

    it('rejects empty product', () => {
      expect(isValidCohort({ product: '', segment: 'Corp', tenorBucket: '0-1Y', currency: 'EUR' })).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Variance Calculator tests
// ---------------------------------------------------------------------------

describe('varianceCalculator', () => {
  describe('computeVariance', () => {
    it('computes variance correctly', () => {
      const cohort = resolveCohort(MOCK_DEAL);
      const variance = computeVariance(MOCK_DEAL, MOCK_RESULT, MOCK_CELL, cohort, 'snap-1');

      expect(variance.dealId).toBe(MOCK_DEAL.id ?? '');
      expect(variance.targetFtp).toBe(0.050);
      expect(variance.realizedFtp).toBe(0.055);
      expect(variance.ftpVarianceBps).toBeCloseTo(50, 0); // (0.055 - 0.050) * 10000 = 50
    });

    it('computes negative margin variance for below-target pricing', () => {
      const belowResult = { ...MOCK_RESULT, finalClientRate: 0.065, totalFTP: 0.055 };
      const cohort = resolveCohort(MOCK_DEAL);
      const variance = computeVariance(MOCK_DEAL, belowResult, MOCK_CELL, cohort, 'snap-1');

      // realized margin = 0.065 - 0.055 = 0.010, target margin = 0.020
      expect(variance.marginVarianceBps).toBeCloseTo(-100, 0); // (0.010 - 0.020) * 10000
    });
  });

  describe('computeLeakage', () => {
    it('computes positive leakage when margin exceeds target', () => {
      const leakage = computeLeakage(0.025, 0.020, 1_000_000, 48);
      expect(leakage).toBeCloseTo(20_000, 0); // 0.005 * 1M * 4y
    });

    it('computes negative leakage when margin below target', () => {
      const leakage = computeLeakage(0.015, 0.020, 1_000_000, 48);
      expect(leakage).toBeCloseTo(-20_000, 0);
    });

    it('handles zero tenor gracefully', () => {
      const leakage = computeLeakage(0.025, 0.020, 1_000_000, 0);
      expect(leakage).toBe(0);
    });
  });

  describe('aggregateLeakage', () => {
    it('sums leakage across variances', () => {
      const total = aggregateLeakage([
        { leakageEur: 10000 },
        { leakageEur: -5000 },
        { leakageEur: 3000 },
      ]);
      expect(total).toBe(8000);
    });

    it('handles null values', () => {
      const total = aggregateLeakage([{ leakageEur: null }, { leakageEur: 100 }]);
      expect(total).toBe(100);
    });
  });

  describe('averageVarianceMetrics', () => {
    it('computes averages', () => {
      const avg = averageVarianceMetrics([
        { ftpVarianceBps: 10, rarocVariancePp: 0.5, marginVarianceBps: 20 },
        { ftpVarianceBps: -10, rarocVariancePp: -0.5, marginVarianceBps: -20 },
      ]);
      expect(avg.avgFtpBps).toBe(0);
      expect(avg.avgRarocPp).toBe(0);
      expect(avg.avgMarginBps).toBe(0);
    });

    it('handles empty array', () => {
      const avg = averageVarianceMetrics([]);
      expect(avg.avgFtpBps).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Band Resolver tests
// ---------------------------------------------------------------------------

describe('bandResolver', () => {
  describe('resolveToleranceBand', () => {
    it('finds applicable band', () => {
      const cohort: Cohort = { product: 'Loan', segment: 'Corp', tenorBucket: '3-5Y', currency: 'EUR' };
      const band = resolveToleranceBand(cohort, [MOCK_BAND], new Date('2026-06-01'));
      expect(band).not.toBeNull();
      expect(band?.id).toBe('band-1');
    });

    it('respects priority ordering', () => {
      const cohort: Cohort = { product: 'Loan', segment: 'Corp', tenorBucket: '3-5Y', currency: 'EUR' };
      const bands: ToleranceBand[] = [
        { ...MOCK_BAND, id: 'band-high', priority: 200 },
        { ...MOCK_BAND, id: 'band-low', priority: 50 },
      ];
      const band = resolveToleranceBand(cohort, bands, new Date('2026-06-01'));
      expect(band?.id).toBe('band-low');
    });

    it('prefers more specific bands at same priority', () => {
      const cohort: Cohort = { product: 'Loan', segment: 'Corp', tenorBucket: '3-5Y', currency: 'EUR' };
      const bands: ToleranceBand[] = [
        { ...MOCK_BAND, id: 'generic' },
        { ...MOCK_BAND, id: 'specific', product: 'Loan' },
      ];
      const band = resolveToleranceBand(cohort, bands, new Date('2026-06-01'));
      expect(band?.id).toBe('specific');
    });

    it('excludes inactive bands', () => {
      const cohort: Cohort = { product: 'Loan', segment: 'Corp', tenorBucket: '3-5Y', currency: 'EUR' };
      const bands: ToleranceBand[] = [
        { ...MOCK_BAND, active: false },
      ];
      expect(resolveToleranceBand(cohort, bands)).toBeNull();
    });

    it('excludes bands outside effective date range', () => {
      const cohort: Cohort = { product: 'Loan', segment: 'Corp', tenorBucket: '3-5Y', currency: 'EUR' };
      const bands: ToleranceBand[] = [
        { ...MOCK_BAND, effectiveFrom: '2027-01-01' },
      ];
      expect(resolveToleranceBand(cohort, bands, new Date('2026-06-01'))).toBeNull();
    });

    it('rejects non-matching product dimension', () => {
      const cohort: Cohort = { product: 'Loan', segment: 'Corp', tenorBucket: '3-5Y', currency: 'EUR' };
      const bands: ToleranceBand[] = [
        { ...MOCK_BAND, product: 'Deposit' },
      ];
      expect(resolveToleranceBand(cohort, bands, new Date('2026-06-01'))).toBeNull();
    });
  });

  describe('isOutOfBand', () => {
    it('flags FTP out of band', () => {
      expect(isOutOfBand({ ftpVarianceBps: 20, rarocVariancePp: 0, marginVarianceBps: 0 }, MOCK_BAND)).toBe(true);
    });

    it('flags RAROC out of band', () => {
      expect(isOutOfBand({ ftpVarianceBps: 0, rarocVariancePp: 2, marginVarianceBps: 0 }, MOCK_BAND)).toBe(true);
    });

    it('passes when within tolerance', () => {
      expect(isOutOfBand({ ftpVarianceBps: 10, rarocVariancePp: 1, marginVarianceBps: 5 }, MOCK_BAND)).toBe(false);
    });
  });

  describe('applyBandToVariance', () => {
    it('enriches variance with band info', () => {
      const variance = {
        dealId: 'd-1',
        snapshotId: 'snap-1',
        cohort: { product: 'Loan', segment: 'Corp', tenorBucket: '3-5Y' as const, currency: 'EUR' },
        targetFtp: 0.05,
        realizedFtp: 0.055,
        ftpVarianceBps: 50,
        targetRaroc: 0.12,
        realizedRaroc: 0.10,
        rarocVariancePp: -2,
        targetMargin: 0.02,
        realizedMargin: 0.015,
        marginVarianceBps: -50,
        leakageEur: -20000,
      };

      const enriched = applyBandToVariance(variance, [MOCK_BAND], new Date('2026-06-01'));
      expect(enriched.outOfBand).toBe(true);
      expect(enriched.bandAppliedId).toBe('band-1');
    });
  });
});

// ---------------------------------------------------------------------------
// Leakage Aggregator tests
// ---------------------------------------------------------------------------

describe('leakageAggregator', () => {
  const VARIANCES: DealVariance[] = [
    {
      dealId: 'd-1', snapshotId: 's-1',
      cohort: { product: 'Loan', segment: 'Corp', tenorBucket: '3-5Y', currency: 'EUR' },
      targetFtp: 0.05, realizedFtp: 0.055, ftpVarianceBps: 50,
      targetRaroc: 0.12, realizedRaroc: 0.10, rarocVariancePp: -2,
      targetMargin: 0.02, realizedMargin: 0.015, marginVarianceBps: -50,
      leakageEur: -20000, outOfBand: true, computedAt: '2026-01-01',
    },
    {
      dealId: 'd-2', snapshotId: 's-1',
      cohort: { product: 'Deposit', segment: 'Retail', tenorBucket: '0-1Y', currency: 'EUR' },
      targetFtp: 0.03, realizedFtp: 0.032, ftpVarianceBps: 20,
      targetRaroc: 0.15, realizedRaroc: 0.14, rarocVariancePp: -1,
      targetMargin: 0.01, realizedMargin: 0.008, marginVarianceBps: -20,
      leakageEur: -5000, outOfBand: false, computedAt: '2026-01-01',
    },
  ];

  describe('aggregateByDimension', () => {
    it('aggregates by product', () => {
      const agg = aggregateByDimension(VARIANCES, 'product');
      expect(agg).toHaveLength(2);
      const loan = agg.find((a) => a.value === 'Loan');
      expect(loan?.dealCount).toBe(1);
      expect(loan?.totalLeakageEur).toBe(-20000);
    });

    it('sorts by absolute leakage', () => {
      const agg = aggregateByDimension(VARIANCES, 'product');
      expect(Math.abs(agg[0].totalLeakageEur)).toBeGreaterThanOrEqual(Math.abs(agg[1].totalLeakageEur));
    });
  });

  describe('computeKpis', () => {
    it('computes KPIs correctly', () => {
      const kpis = computeKpis(VARIANCES);
      expect(kpis.totalDeals).toBe(2);
      expect(kpis.inBandCount).toBe(1);
      expect(kpis.outOfBandCount).toBe(1);
      expect(kpis.inBandPct).toBe(50);
      expect(kpis.totalLeakageEur).toBe(-25000);
    });

    it('handles empty variances', () => {
      const kpis = computeKpis([]);
      expect(kpis.totalDeals).toBe(0);
      expect(kpis.inBandPct).toBe(0);
    });

    it('computes leakage trend', () => {
      const kpis = computeKpis(VARIANCES, -20000);
      expect(kpis.leakageTrend).toBeCloseTo(-25, 0); // (-25000 - (-20000)) / |-20000| * 100 = -25%
    });
  });

  describe('topOutliers', () => {
    it('returns top N outliers sorted by |leakage|', () => {
      const top = topOutliers(VARIANCES, 5);
      expect(top).toHaveLength(1); // only 1 is outOfBand
      expect(top[0].dealId).toBe('d-1');
    });
  });
});
