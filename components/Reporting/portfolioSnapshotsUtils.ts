import type { PortfolioScenario, PortfolioSnapshot } from '../../types';

export type PortfolioScenarioPreset = 'BASE' | 'RATES_UP_25' | 'LIQUIDITY_STRESS' | 'COMBINED_STRESS';

export const PORTFOLIO_SCENARIO_PRESETS: Record<
  PortfolioScenarioPreset,
  { label: string; description: string; shocks: PortfolioScenario['shocks'] }
> = {
  BASE: {
    label: 'Base',
    description: 'Live methodology and current market state.',
    shocks: { interestRate: 0, liquiditySpread: 0 },
  },
  RATES_UP_25: {
    label: 'Rates +25bps',
    description: 'Parallel rates shock over the live portfolio.',
    shocks: { interestRate: 25, liquiditySpread: 0 },
  },
  LIQUIDITY_STRESS: {
    label: 'Liquidity Stress',
    description: 'Funding pressure with wider liquidity spread.',
    shocks: { interestRate: 0, liquiditySpread: 20 },
  },
  COMBINED_STRESS: {
    label: 'Combined Stress',
    description: 'Rates and liquidity stress applied together.',
    shocks: { interestRate: 25, liquiditySpread: 20 },
  },
};

export function createPortfolioScenario({
  preset,
  name,
  createdByEmail,
  createdByName,
}: {
  preset: PortfolioScenarioPreset;
  name: string;
  createdByEmail: string;
  createdByName: string;
}): PortfolioScenario {
  const definition = PORTFOLIO_SCENARIO_PRESETS[preset];

  return {
    id: `SCN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    name,
    description: definition.description,
    shocks: definition.shocks,
    createdAt: new Date().toISOString(),
    createdByEmail,
    createdByName,
  };
}

export function buildPortfolioSnapshotDelta(current?: PortfolioSnapshot, previous?: PortfolioSnapshot) {
  if (!current) {
    return {
      exposureDelta: 0,
      rarocDelta: 0,
      finalRateDelta: 0,
    };
  }

  return {
    exposureDelta: current.totals.exposure - (previous?.totals.exposure ?? 0),
    rarocDelta: current.totals.averageRaroc - (previous?.totals.averageRaroc ?? 0),
    finalRateDelta: current.totals.averageFinalRate - (previous?.totals.averageFinalRate ?? 0),
  };
}

export function buildPortfolioSnapshotCsv(snapshot: PortfolioSnapshot): string {
  const header = [
    'snapshot_id',
    'snapshot_name',
    'scenario_name',
    'deal_id',
    'currency',
    'amount',
    'raroc',
    'final_client_rate',
    'approval_level',
  ];

  const rows = snapshot.results.map((result) => [
    snapshot.id,
    snapshot.name,
    snapshot.scenario.name,
    result.dealId,
    result.currency,
    result.amount.toString(),
    result.raroc.toFixed(2),
    result.finalClientRate.toFixed(4),
    result.approvalLevel,
  ]);

  return [header, ...rows]
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
    .join('\n');
}
