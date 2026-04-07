import type { FTPResult, Transaction } from '../../types';
import type { PricingShocks } from '../../utils/pricingEngine';

export interface PricingScenario {
  id: string;
  name: string;
  shocks: PricingShocks;
  overrides: Partial<Transaction>;
}

export type MetricFormat = 'pct' | 'approval';

export interface MetricRow {
  label: string;
  key: keyof FTPResult | 'esgTotal' | 'approvalLevel';
  format: MetricFormat;
  higherIsBetter?: boolean;
}

export const MAX_COMPARISON_SCENARIOS = 3;

export const DEFAULT_PRICING_SCENARIOS: PricingScenario[] = [
  { id: 'base', name: 'Base Case', shocks: { interestRate: 0, liquiditySpread: 0 }, overrides: {} },
  { id: 'stress-up', name: 'Rates +100bps', shocks: { interestRate: 100, liquiditySpread: 0 }, overrides: {} },
  { id: 'stress-down', name: 'Rates -50bps', shocks: { interestRate: -50, liquiditySpread: 0 }, overrides: {} },
];

export const COMPARISON_METRIC_ROWS: MetricRow[] = [
  { label: 'Base Rate', key: 'baseRate', format: 'pct' },
  { label: 'Liquidity Premium', key: 'liquiditySpread', format: 'pct' },
  { label: 'LCR Charge', key: 'lcrCost', format: 'pct' },
  { label: 'NSFR Charge', key: 'nsfrCost', format: 'pct' },
  { label: 'Capital Charge', key: 'capitalCharge', format: 'pct' },
  { label: 'ESG Adjustment', key: 'esgTotal', format: 'pct' },
  { label: 'Total FTP', key: 'totalFTP', format: 'pct' },
  { label: 'Final Client Rate', key: 'finalClientRate', format: 'pct' },
  { label: 'RAROC', key: 'raroc', format: 'pct', higherIsBetter: true },
  { label: 'Approval Level', key: 'approvalLevel', format: 'approval' },
];

export const COLLATERAL_OPTIONS: Transaction['collateralType'][] = [
  'None',
  'Sovereign',
  'Corporate',
  'Cash',
  'Real_Estate',
];

function approvalRank(level: string): number {
  const ranks: Record<string, number> = {
    Auto: 0,
    L1_Manager: 1,
    L2_Committee: 2,
    Rejected: 3,
  };

  return ranks[level] ?? 99;
}

export function getMetricValue(
  result: FTPResult,
  key: MetricRow['key'],
): number | string {
  if (key === 'esgTotal') {
    return (result.esgTransitionCharge || 0) + (result.esgPhysicalCharge || 0) + (result.esgGreeniumAdj || 0);
  }

  if (key === 'approvalLevel') {
    return result.approvalLevel;
  }

  const value = result[key];
  return typeof value === 'number' || typeof value === 'string' ? value : 0;
}

export function formatMetricValue(
  value: number | string,
  format: MetricFormat,
): string {
  if (format === 'approval') {
    return String(value);
  }

  return typeof value === 'number' ? `${value.toFixed(4)}%` : String(value);
}

export function getMetricDeltaState(
  row: MetricRow,
  value: number | string,
  baseValue: number | string,
): 'positive' | 'negative' | 'neutral' {
  if (typeof value !== 'number' || typeof baseValue !== 'number') {
    if (row.format === 'approval') {
      const diff = approvalRank(String(value)) - approvalRank(String(baseValue));
      if (diff < 0) return 'positive';
      if (diff > 0) return 'negative';
    }

    return 'neutral';
  }

  const diff = value - baseValue;
  if (Math.abs(diff) < 0.0001) {
    return 'neutral';
  }

  const improved = row.higherIsBetter ? diff > 0 : diff < 0;
  return improved ? 'positive' : 'negative';
}

export function formatMetricDelta(
  value: number | string,
  baseValue: number | string,
  format: MetricFormat,
): string {
  if (format === 'approval') {
    return String(value);
  }

  if (typeof value === 'number' && typeof baseValue === 'number') {
    const diff = value - baseValue;
    if (Math.abs(diff) < 0.0001) {
      return '-';
    }

    const sign = diff > 0 ? '+' : '';
    return `${sign}${diff.toFixed(4)}%`;
  }

  return '-';
}
