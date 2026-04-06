import { describe, expect, it } from 'vitest';
import type { PortfolioSnapshot } from '../../types';
import {
  buildPortfolioSnapshotCsv,
  buildPortfolioSnapshotDelta,
  createPortfolioScenario,
} from '../../components/Reporting/portfolioSnapshotsUtils';

const currentSnapshot: PortfolioSnapshot = {
  id: 'PORT-1',
  name: 'Current Snapshot',
  scenario: {
    id: 'SCN-1',
    name: 'Base',
    description: 'Live portfolio',
    shocks: { interestRate: 0, liquiditySpread: 0 },
    createdAt: '2026-04-02T10:00:00.000Z',
    createdByEmail: 'ana@nfq.es',
    createdByName: 'Ana',
  },
  createdAt: '2026-04-02T10:00:00.000Z',
  createdByEmail: 'ana@nfq.es',
  createdByName: 'Ana',
  dealIds: ['TRD-1', 'TRD-2'],
  totals: {
    exposure: 12_000_000,
    averageRaroc: 13.4,
    averageFinalRate: 5.62,
    approved: 1,
    pendingApproval: 1,
    rejected: 0,
  },
  results: [
    {
      dealId: 'TRD-1',
      currency: 'USD',
      amount: 5_000_000,
      raroc: 12.1,
      finalClientRate: 5.1,
      approvalLevel: 'Auto',
    },
    {
      dealId: 'TRD-2',
      currency: 'EUR',
      amount: 7_000_000,
      raroc: 14.7,
      finalClientRate: 6.14,
      approvalLevel: 'L1_Manager',
    },
  ],
};

describe('portfolioSnapshotsUtils', () => {
  it('creates a portfolio scenario from a preset with embedded shocks', () => {
    const scenario = createPortfolioScenario({
      preset: 'COMBINED_STRESS',
      name: 'Combined Stress 2026-04-02',
      createdByEmail: 'risk@nfq.es',
      createdByName: 'Risk User',
    });

    expect(scenario.id).toContain('SCN-');
    expect(scenario.shocks).toEqual({ interestRate: 25, liquiditySpread: 20 });
    expect(scenario.name).toBe('Combined Stress 2026-04-02');
  });

  it('computes deltas versus a previous snapshot', () => {
    const previousSnapshot: PortfolioSnapshot = {
      ...currentSnapshot,
      id: 'PORT-0',
      name: 'Previous Snapshot',
      totals: {
        ...currentSnapshot.totals,
        exposure: 10_500_000,
        averageRaroc: 12.9,
        averageFinalRate: 5.4,
      },
    };

    const delta = buildPortfolioSnapshotDelta(currentSnapshot, previousSnapshot);

    expect(delta.exposureDelta).toBe(1_500_000);
    expect(delta.rarocDelta).toBeCloseTo(0.5, 8);
    expect(delta.finalRateDelta).toBeCloseTo(0.22, 8);
  });

  it('builds a CSV export payload for the selected snapshot', () => {
    const csv = buildPortfolioSnapshotCsv(currentSnapshot);

    expect(csv).toContain('"snapshot_id","snapshot_name","scenario_name"');
    expect(csv).toContain('"PORT-1","Current Snapshot","Base","TRD-1"');
    expect(csv.split('\n')).toHaveLength(3);
  });
});
