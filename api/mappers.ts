/**
 * Shared DB ↔ TS mapping functions for the API layer.
 *
 * These re-export the canonical mappers from utils/supabase/mappers.ts
 * so the API modules have a single import point, and we can add
 * API-specific transformations here if needed in the future.
 */

export {
  // Deals
  mapDealFromDB,
  mapDealToDB,

  // Audit
  mapAuditFromDB,
  mapAuditToDB,

  // Rules
  mapRuleFromDB,
  mapRuleToDB,
  mapRuleVersionFromDB,

  // Market data / behavioural models
  mapModelFromDB,
  mapModelToDB,

  // Master data
  mapClientFromDB,
  mapBUFromDB,
  mapProductFromDB,

  // Misc
  mapDealCommentFromDB,
  mapNotificationFromDB,
  mapRateCardsFromDB,

  // Entities
  mapGroupFromDB,
  mapGroupToDB,
  mapEntityFromDB,
  mapEntityToDB,
  mapEntityUserFromDB,

  // Report Schedules
  mapReportScheduleFromDB,
  mapReportScheduleToDB,
  mapReportRunFromDB,
} from '../utils/supabase/mappers';

// ---------------------------------------------------------------------------
// API-layer helpers for liquidity curve mapping (not in the original mappers)
// ---------------------------------------------------------------------------

import type { DualLiquidityCurve } from '../types';

/** Map a raw DB row from `liquidity_curves` to the TS type. */
export const mapLiquidityCurveFromDB = (row: Record<string, unknown>): DualLiquidityCurve => ({
  currency: (row.currency as string) ?? 'EUR',
  curveType: (row.curve_type as DualLiquidityCurve['curveType']) ?? undefined,
  lastUpdate: (row.last_update as string) ?? '',
  points: Array.isArray(row.points) ? (row.points as DualLiquidityCurve['points']) : [],
});

// ---------------------------------------------------------------------------
// Yield curve snapshot mapping
// ---------------------------------------------------------------------------

import type { YieldCurvePoint } from '../types';

export interface YieldCurveSnapshot {
  id?: number;
  currency: string;
  asOfDate: string;
  gridData: YieldCurvePoint[];
}

/** Map a raw DB row from `yield_curves` to a typed snapshot. */
export const mapYieldCurveSnapshotFromDB = (row: Record<string, unknown>): YieldCurveSnapshot => ({
  id: row.id as number | undefined,
  currency: (row.currency as string) ?? 'EUR',
  asOfDate: (row.as_of_date as string) ?? '',
  gridData: Array.isArray(row.grid_data) ? (row.grid_data as YieldCurvePoint[]) : [],
});
