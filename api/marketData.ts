/**
 * API layer — Market Data
 *
 * Wraps Supabase calls for yield curves, liquidity curves,
 * and behavioural models with typed inputs/outputs.
 */

import type { BehaviouralModel, DualLiquidityCurve, YieldCurvePoint } from '../types';
import { safeSupabaseCall } from '../utils/validation';
import { supabase } from '../utils/supabase/shared';
import {
  mapModelFromDB,
  mapModelToDB,
  mapLiquidityCurveFromDB,
  mapYieldCurveSnapshotFromDB,
  type YieldCurveSnapshot,
} from './mappers';

// ---------------------------------------------------------------------------
// Yield Curves
// ---------------------------------------------------------------------------

/** Fetch all yield curve snapshots, most-recent first. */
export async function listYieldCurves(): Promise<YieldCurveSnapshot[]> {
  const { data } = await safeSupabaseCall(
    async () =>
      supabase
        .from('yield_curves')
        .select('*')
        .order('as_of_date', { ascending: false }),
    [],
    'listYieldCurves',
  );
  return (data as Record<string, unknown>[]).map(mapYieldCurveSnapshotFromDB);
}

/** Insert a new yield curve snapshot for a given currency and date. */
export async function upsertYieldCurves(
  currency: string,
  date: string,
  points: YieldCurvePoint[],
): Promise<void> {
  await safeSupabaseCall(
    async () =>
      supabase.from('yield_curves').insert({
        currency,
        as_of_date: date,
        grid_data: points,
      }),
    null,
    'upsertYieldCurves',
  );
}

// ---------------------------------------------------------------------------
// Yield Curve History
// ---------------------------------------------------------------------------

export interface CurveHistoryEntry {
  date: string;
  points: YieldCurvePoint[];
}

/** Fetch curve history for a given curve ID within the last N months. */
export async function listCurveHistory(
  curveId: string,
  months: number = 12,
): Promise<CurveHistoryEntry[]> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const { data } = await safeSupabaseCall(
    async () =>
      supabase
        .from('yield_curve_history')
        .select('snapshot_date, points')
        .eq('curve_id', curveId)
        .gte('snapshot_date', cutoffStr)
        .order('snapshot_date', { ascending: false }),
    [],
    'listCurveHistory',
  );

  return (data as Record<string, unknown>[]).map((row) => ({
    date: row.snapshot_date as string,
    points: row.points as YieldCurvePoint[],
  }));
}

/** Save a curve history snapshot (upsert on curve_id + snapshot_date). */
export async function saveCurveHistorySnapshot(
  curveId: string,
  currency: string,
  date: string,
  points: YieldCurvePoint[],
): Promise<void> {
  await safeSupabaseCall(
    async () =>
      supabase
        .from('yield_curve_history')
        .upsert(
          { curve_id: curveId, currency, snapshot_date: date, points },
          { onConflict: 'curve_id,snapshot_date' },
        ),
    null,
    'saveCurveHistorySnapshot',
  );
}

// ---------------------------------------------------------------------------
// Liquidity Curves
// ---------------------------------------------------------------------------

/** Fetch all liquidity curves, most-recently created first. */
export async function listLiquidityCurves(): Promise<DualLiquidityCurve[]> {
  const { data } = await safeSupabaseCall(
    async () =>
      supabase
        .from('liquidity_curves')
        .select('*')
        .order('created_at', { ascending: false }),
    [],
    'listLiquidityCurves',
  );
  return (data as Record<string, unknown>[]).map(mapLiquidityCurveFromDB);
}

// ---------------------------------------------------------------------------
// Behavioural Models
// ---------------------------------------------------------------------------

/** Fetch all behavioural models. */
export async function listModels(): Promise<BehaviouralModel[]> {
  const { data } = await safeSupabaseCall(
    async () => supabase.from('behavioural_models').select('*'),
    [],
    'listModels',
  );
  return (data as Record<string, unknown>[]).map(mapModelFromDB);
}

/** Insert or update a behavioural model. Returns the persisted model or `null`. */
export async function upsertModel(model: BehaviouralModel): Promise<BehaviouralModel | null> {
  const { data, error } = await safeSupabaseCall(
    async () =>
      supabase
        .from('behavioural_models')
        .upsert(mapModelToDB(model))
        .select(),
    null,
    'upsertModel',
  );
  if (error || !data) return null;
  const rows = data as Record<string, unknown>[];
  return rows.length > 0 ? mapModelFromDB(rows[0]) : null;
}

/** Delete a behavioural model by id. */
export async function deleteModel(id: string): Promise<void> {
  await safeSupabaseCall(
    async () => supabase.from('behavioural_models').delete().eq('id', id),
    null,
    'deleteModel',
  );
}
