import { describe, it, expect } from 'vitest';
import {
  reconcileBudgetVsRealized,
  summarizeBudgetVariance,
  type RealizedAggregate,
} from '../budget/budgetReconciler';
import type { BudgetAssumption } from '../../integrations/types';

const assumption = (over: Partial<BudgetAssumption>): BudgetAssumption => ({
  period:               '2026-04',
  segment:              'SME',
  productType:          'loan',
  currency:             'EUR',
  budgetedRateBps:      500,
  budgetedVolumeEur:    1_000_000,
  budgetedRarocPp:      14,
  externalAssumptionId: 'ALQ-1',
  fixedAt:              '2026-01-15T08:00:00Z',
  notes:                null,
  ...over,
});

const realized = (over: Partial<RealizedAggregate>): RealizedAggregate => ({
  period:               '2026-04',
  segment:              'SME',
  productType:          'loan',
  currency:             'EUR',
  realizedRateBps:      500,
  realizedVolumeEur:    1_000_000,
  realizedRarocPp:      14,
  dealCount:            10,
  ...over,
});

describe('budgetReconciler · reconcileBudgetVsRealized', () => {
  it('on_track cuando rate y volumen están dentro de tolerancias por defecto', () => {
    const items = reconcileBudgetVsRealized([assumption({})], [realized({})]);
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('on_track');
    expect(items[0].diffRateBps).toBe(0);
  });

  it('over_budget_rate cuando realized supera la tolerancia', () => {
    const items = reconcileBudgetVsRealized(
      [assumption({})],
      [realized({ realizedRateBps: 510 })],   // +10 bps > 5
    );
    expect(items[0].status).toBe('over_budget_rate');
    expect(items[0].diffRateBps).toBe(10);
  });

  it('under_budget_rate cuando realized cae bajo la tolerancia', () => {
    const items = reconcileBudgetVsRealized(
      [assumption({})],
      [realized({ realizedRateBps: 490 })],   // -10 bps < -5
    );
    expect(items[0].status).toBe('under_budget_rate');
  });

  it('over_budget_volume cuando volume supera tolerance pct (default 10%)', () => {
    const items = reconcileBudgetVsRealized(
      [assumption({})],
      [realized({ realizedVolumeEur: 1_200_000 })],  // +20%
    );
    expect(items[0].status).toBe('over_budget_volume');
    expect(items[0].diffVolumePct).toBe(0.2);
  });

  it('budget_only cuando hay assumption pero no realized', () => {
    const items = reconcileBudgetVsRealized([assumption({})], []);
    expect(items[0].status).toBe('budget_only');
    expect(items[0].realizedRateBps).toBeNull();
    expect(items[0].dealCount).toBe(0);
  });

  it('realized_only cuando hay realized pero no assumption', () => {
    const items = reconcileBudgetVsRealized([], [realized({})]);
    expect(items[0].status).toBe('realized_only');
    expect(items[0].budgetedRateBps).toBeNull();
  });

  it('respeta rateToleranceBps custom', () => {
    const items = reconcileBudgetVsRealized(
      [assumption({})],
      [realized({ realizedRateBps: 510 })],
      { rateToleranceBps: 15 },
    );
    expect(items[0].status).toBe('on_track');
  });

  it('respeta volumeTolerancePct custom', () => {
    const items = reconcileBudgetVsRealized(
      [assumption({})],
      [realized({ realizedVolumeEur: 1_500_000 })],   // +50%
      { volumeTolerancePct: 0.6 },
    );
    expect(items[0].status).toBe('on_track');
  });

  it('items se ordenan por segment > productType > currency', () => {
    const items = reconcileBudgetVsRealized(
      [
        assumption({ segment: 'Corporate', productType: 'loan' }),
        assumption({ segment: 'SME',       productType: 'loan' }),
        assumption({ segment: 'Corporate', productType: 'mortgage' }),
      ],
      [],
    );
    expect(items.map((i) => `${i.segment}|${i.productType}`)).toEqual([
      'Corporate|loan', 'Corporate|mortgage', 'SME|loan',
    ]);
  });

  it('rate prioriza sobre volume al clasificar', () => {
    // Tanto rate como volume superan tolerancia → status refleja rate.
    const items = reconcileBudgetVsRealized(
      [assumption({})],
      [realized({ realizedRateBps: 510, realizedVolumeEur: 1_300_000 })],
    );
    expect(items[0].status).toBe('over_budget_rate');
  });
});

describe('budgetReconciler · summarizeBudgetVariance', () => {
  it('cuenta correctamente cada estado y calcula weighted avg drift', () => {
    const items = reconcileBudgetVsRealized(
      [
        assumption({ segment: 'A', budgetedRateBps: 500, budgetedVolumeEur: 1_000_000 }),
        assumption({ segment: 'B', budgetedRateBps: 500, budgetedVolumeEur: 2_000_000 }),
      ],
      [
        realized({ segment: 'A', realizedRateBps: 510, realizedVolumeEur: 1_000_000 }),
        realized({ segment: 'B', realizedRateBps: 490, realizedVolumeEur: 2_000_000 }),
      ],
    );
    const summary = summarizeBudgetVariance(items);
    expect(summary.total).toBe(2);
    expect(summary.overRate).toBe(1);
    expect(summary.underRate).toBe(1);
    // weighted: ((+10)*1M + (-10)*2M) / 3M = -10/3 ≈ -3.33
    expect(summary.weightedAvgDiffRateBps).toBeCloseTo(-3.333, 2);
    expect(summary.totalBudgetedVolumeEur).toBe(3_000_000);
    expect(summary.totalRealizedVolumeEur).toBe(3_000_000);
  });

  it('lista vacía → todo 0', () => {
    const s = summarizeBudgetVariance([]);
    expect(s.total).toBe(0);
    expect(s.weightedAvgDiffRateBps).toBe(0);
  });
});
