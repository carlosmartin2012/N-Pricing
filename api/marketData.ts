import type { BehaviouralModel, DualLiquidityCurve, YieldCurvePoint } from '../types';
import { apiGet, apiPost, apiDelete } from '../utils/apiFetch';
import { createLogger } from '../utils/logger';
import {
  mapModelFromDB,
  mapModelToDB,
  mapLiquidityCurveFromDB,
  mapYieldCurveSnapshotFromDB,
  type YieldCurveSnapshot,
} from './mappers';

const log = createLogger('api/marketData');

export async function listYieldCurves(): Promise<YieldCurveSnapshot[]> {
  try {
    const rows = await apiGet<Record<string, unknown>[]>('/market-data/yield-curves');
    return rows.map(mapYieldCurveSnapshotFromDB);
  } catch (err) {
    log.warn('listYieldCurves failed — returning empty list', { error: String(err) });
    return [];
  }
}

export async function upsertYieldCurves(currency: string, date: string, points: YieldCurvePoint[]): Promise<void> {
  await apiPost('/market-data/yield-curves', { currency, as_of_date: date, grid_data: points });
}

export async function listLiquidityCurves(): Promise<DualLiquidityCurve[]> {
  try {
    const rows = await apiGet<Record<string, unknown>[]>('/market-data/liquidity-curves');
    return rows.map(mapLiquidityCurveFromDB);
  } catch (err) {
    log.warn('listLiquidityCurves failed — returning empty list', { error: String(err) });
    return [];
  }
}

export async function listBehaviouralModels(): Promise<BehaviouralModel[]> {
  try {
    const rows = await apiGet<Record<string, unknown>[]>('/market-data/models');
    return rows.map(mapModelFromDB);
  } catch (err) {
    log.warn('listBehaviouralModels failed — returning empty list', { error: String(err) });
    return [];
  }
}

export async function upsertBehaviouralModel(model: BehaviouralModel): Promise<BehaviouralModel | null> {
  try {
    const row = await apiPost<Record<string, unknown>>('/market-data/models', mapModelToDB(model));
    return row ? mapModelFromDB(row) : null;
  } catch (err) {
    log.error('upsertBehaviouralModel failed', { modelId: model.id }, err as Error);
    return null;
  }
}

export async function deleteBehaviouralModel(id: string): Promise<void> {
  await apiDelete(`/market-data/models/${id}`);
}

export const listModels = listBehaviouralModels;
export const upsertModel = upsertBehaviouralModel;
export const deleteModel = deleteBehaviouralModel;

export async function listCurveHistory(curveId: string, months: number = 12): Promise<YieldCurveSnapshot[]> {
  try {
    const rows = await apiGet<Record<string, unknown>[]>(`/market-data/yield-curves/history?curveId=${encodeURIComponent(curveId)}&months=${months}`);
    return rows.map(mapYieldCurveSnapshotFromDB);
  } catch (err) {
    log.warn('listCurveHistory failed — returning empty history', { curveId, months, error: String(err) });
    return [];
  }
}

export async function saveCurveHistorySnapshot(
  currency: string,
  date: string,
  points: YieldCurvePoint[],
): Promise<void> {
  await upsertYieldCurves(currency, date, points);
}
