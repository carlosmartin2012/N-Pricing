/**
 * Shared mock state types for E2E Playwright fixtures.
 *
 * Extracted from `e2e/mockApi.ts` (2026-05-14) so handlers and helpers can
 * reference the same shape without circular imports. The mockApi dispatcher
 * imports these along with the helper functions from `./helpers.ts`.
 */

import type { Transaction } from '../../types';
import type { AttributionDecision } from '../../types/attributions';
import type { mapDealToDB } from '../../utils/supabase/mappers';

export type MockDealRow = ReturnType<typeof mapDealToDB> & {
  created_at: string;
  updated_at: string;
};

export interface MockState {
  audit: Array<Record<string, unknown>>;
  alertRules: Array<Record<string, unknown>>;
  attributionDecisions: AttributionDecision[];
  deals: MockDealRow[];
  recentMetrics: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
  systemConfig: Record<string, unknown>;
}

export interface MockApiOptions {
  audit?: Array<Record<string, unknown>>;
  alertRules?: Array<Record<string, unknown>>;
  attributionDecisions?: AttributionDecision[];
  deals?: Transaction[];
  recentMetrics?: Array<Record<string, unknown>>;
  notifications?: Array<Record<string, unknown>>;
  systemConfigOverrides?: Record<string, unknown>;
}
