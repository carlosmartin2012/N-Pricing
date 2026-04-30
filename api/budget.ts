/**
 * Ola 9 Bloque C — Budget API client (ALQUID wrapper read-only).
 */

import { apiGet } from '../utils/apiFetch';
import type { AdapterHealth } from '../integrations/types';
import type {
  BudgetVarianceItem,
  BudgetVarianceSummary,
} from '../utils/budget/budgetReconciler';

export interface BudgetHealthResponse {
  kind: 'budget';
  name: string;
  health: AdapterHealth;
}

export interface BudgetComparisonResponse {
  period: string;
  rateToleranceBps: number;
  volumeTolerancePct: number;
  summary: BudgetVarianceSummary;
  items: BudgetVarianceItem[];
}

export async function getBudgetHealth(): Promise<BudgetHealthResponse> {
  return apiGet<BudgetHealthResponse>('/budget/health');
}

export async function getBudgetComparison(params: {
  period?: string;
  rateToleranceBps?: number;
  volumeTolerancePct?: number;
} = {}): Promise<BudgetComparisonResponse> {
  const qs = new URLSearchParams();
  if (params.period)                                  qs.set('period', params.period);
  if (typeof params.rateToleranceBps === 'number')    qs.set('rate_tolerance_bps', String(params.rateToleranceBps));
  if (typeof params.volumeTolerancePct === 'number')  qs.set('volume_tolerance_pct', String(params.volumeTolerancePct));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiGet<BudgetComparisonResponse>(`/budget/comparison${suffix}`);
}
