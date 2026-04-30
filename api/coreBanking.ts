/**
 * Ola 9 Bloque B — Core Banking API client (HOST reconciliation).
 */

import { apiGet } from '../utils/apiFetch';
import type { AdapterHealth } from '../integrations/types';
import type {
  ReconciliationOutcome,
  ReconciliationSummary,
} from '../utils/coreBanking/hostReconciliationMatcher';

export interface CoreBankingHealthResponse {
  kind: 'core_banking';
  name: string;
  health: AdapterHealth;
}

export interface CoreBankingReconciliationResponse {
  asOfDate: string;
  toleranceBps: number;
  summary: ReconciliationSummary;
  outcomes: ReconciliationOutcome[];
}

export async function getCoreBankingHealth(): Promise<CoreBankingHealthResponse> {
  return apiGet<CoreBankingHealthResponse>('/core-banking/health');
}

export async function getCoreBankingReconciliation(params: {
  asOfDate?: string;
  toleranceBps?: number;
} = {}): Promise<CoreBankingReconciliationResponse> {
  const qs = new URLSearchParams();
  if (params.asOfDate)                          qs.set('as_of', params.asOfDate);
  if (typeof params.toleranceBps === 'number')  qs.set('tolerance_bps', String(params.toleranceBps));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiGet<CoreBankingReconciliationResponse>(`/core-banking/reconciliation${suffix}`);
}
