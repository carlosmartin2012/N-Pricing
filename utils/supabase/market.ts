import type { BehaviouralModel, YieldCurvePoint } from '../../types';
import * as marketDataApi from '../../api/marketData';
import { apiPost } from '../apiFetch';

/**
 * @deprecated Use `api/marketData.ts` directly for CRUD flows. This adapter
 * remains only to preserve the public `supabaseService` surface during the
 * migration.
 */
export const marketDataService = {
  fetchModels: marketDataApi.listBehaviouralModels,
  saveModel: marketDataApi.upsertBehaviouralModel,
  deleteModel: marketDataApi.deleteBehaviouralModel,
  saveCurveSnapshot: marketDataApi.upsertYieldCurves,

  async fetchCurveHistory(_currency: string): Promise<unknown[]> {
    return marketDataApi.listYieldCurves();
  },

  async fetchCurveHistoryByIdAndMonths(
    curveId: string,
    months: number = 12,
  ): Promise<{ date: string; points: YieldCurvePoint[] }[]> {
    const snapshots = await marketDataApi.listCurveHistory(curveId, months);
    return snapshots.map((snapshot) => ({
      date: snapshot.asOfDate,
      points: snapshot.gridData,
    }));
  },

  async saveCurveHistorySnapshot(
    curveId: string,
    currency: string,
    date: string,
    points: YieldCurvePoint[],
  ): Promise<void> {
    await apiPost('/market-data/yield-curve-history', {
      curve_id: curveId,
      currency,
      snapshot_date: date,
      points,
    });
  },

  fetchYieldCurves: marketDataApi.listYieldCurves,
  fetchLiquidityCurves: marketDataApi.listLiquidityCurves,

  async seedDatabase(): Promise<{ success: boolean; errors: string[] }> {
    try {
      const {
        MOCK_BEHAVIOURAL_MODELS,
        MOCK_BUSINESS_UNITS,
        MOCK_CLIENTS,
        MOCK_DEALS,
        MOCK_PRODUCT_DEFS,
        MOCK_USERS,
        MOCK_YIELD_CURVE,
      } = await import('../../utils/seedData');
      const { mapDealToDB, mapModelToDB } = await import('./mappers');
      const { apiPost: post } = await import('../apiFetch');

      const errors: string[] = [];

      await post('/config/seed', {
        clients: MOCK_CLIENTS,
        products: MOCK_PRODUCT_DEFS,
        business_units: MOCK_BUSINESS_UNITS,
        users: MOCK_USERS,
        models: MOCK_BEHAVIOURAL_MODELS.map((model: BehaviouralModel) => mapModelToDB(model)),
        deals: MOCK_DEALS.map(mapDealToDB),
        yield_curve: {
          currency: 'USD',
          as_of_date: new Date().toISOString().split('T')[0],
          grid_data: MOCK_YIELD_CURVE,
        },
      }).catch((err: unknown) => errors.push(String(err)));

      return { success: errors.length === 0, errors };
    } catch (err) {
      return { success: false, errors: [String(err)] };
    }
  },
};
