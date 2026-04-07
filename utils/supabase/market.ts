import type { BehaviouralModel, YieldCurvePoint } from '../../types';
import { mapModelFromDB, mapModelToDB } from './mappers';
import { apiGet, apiPost, apiDelete } from '../apiFetch';
import { log } from './shared';

export const marketDataService = {
  async fetchModels(): Promise<BehaviouralModel[]> {
    try {
      const rows = await apiGet<Record<string, unknown>[]>('/market-data/models');
      return rows.map(mapModelFromDB);
    } catch { return []; }
  },

  async saveModel(model: BehaviouralModel) {
    try {
      const row = await apiPost<Record<string, unknown>>('/market-data/models', mapModelToDB(model));
      return row ? mapModelFromDB(row) : null;
    } catch (err) {
      log.error('Error saving model', { error: String(err) });
      return null;
    }
  },

  async deleteModel(id: string) {
    try {
      await apiDelete(`/market-data/models/${id}`);
    } catch (err) {
      log.error('Error deleting model', { error: String(err) });
    }
  },

  async saveCurveSnapshot(currency: string, date: string, points: YieldCurvePoint[]) {
    try {
      await apiPost('/market-data/yield-curves', { currency, as_of_date: date, grid_data: points });
    } catch (err) {
      log.error('Error saving curve snapshot', { error: String(err) });
    }
  },

  async fetchCurveHistory(_currency: string): Promise<unknown[]> {
    try {
      return await apiGet<unknown[]>('/market-data/yield-curves');
    } catch { return []; }
  },

  async fetchCurveHistoryByIdAndMonths(curveId: string, months: number = 12): Promise<{ date: string; points: YieldCurvePoint[] }[]> {
    try {
      const rows = await apiGet<{ snapshot_date: string; points: YieldCurvePoint[] }[]>(
        `/market-data/yield-curve-history?curve_id=${encodeURIComponent(curveId)}&months=${months}`
      );
      return rows.map((r) => ({ date: r.snapshot_date, points: r.points }));
    } catch { return []; }
  },

  async saveCurveHistorySnapshot(curveId: string, currency: string, date: string, points: YieldCurvePoint[]): Promise<void> {
    try {
      await apiPost('/market-data/yield-curve-history', { curve_id: curveId, currency, snapshot_date: date, points });
    } catch (err) {
      log.error('Error saving curve history snapshot', { error: String(err) });
    }
  },

  async fetchYieldCurves(): Promise<unknown[]> {
    try {
      return await apiGet<unknown[]>('/market-data/yield-curves');
    } catch { return []; }
  },

  async fetchLiquidityCurves(): Promise<unknown[]> {
    try {
      const rows = await apiGet<Record<string, unknown>[]>('/market-data/liquidity-curves');
      return rows.map((curve) => ({
        currency: curve.currency,
        curveType: curve.curve_type,
        lastUpdate: curve.last_update,
        points: curve.points || [],
      }));
    } catch { return []; }
  },

  async seedDatabase(): Promise<{ success: boolean; errors: string[] }> {
    try {
      const { MOCK_CLIENTS, MOCK_PRODUCT_DEFS, MOCK_BUSINESS_UNITS, MOCK_USERS,
              MOCK_BEHAVIOURAL_MODELS, MOCK_DEALS, MOCK_YIELD_CURVE } =
        await import('../../constants');
      const { mapDealToDB, mapRuleToDB } = await import('./mappers');
      const { apiPost: post } = await import('../apiFetch');

      const errors: string[] = [];

      await post('/config/seed', {
        clients: MOCK_CLIENTS,
        products: MOCK_PRODUCT_DEFS,
        business_units: MOCK_BUSINESS_UNITS,
        users: MOCK_USERS,
        models: MOCK_BEHAVIOURAL_MODELS.map(mapModelToDB),
        deals: MOCK_DEALS.map(mapDealToDB),
        yield_curve: { currency: 'USD', as_of_date: new Date().toISOString().split('T')[0], grid_data: MOCK_YIELD_CURVE },
      }).catch((err) => errors.push(String(err)));

      return { success: errors.length === 0, errors };
    } catch (err) {
      return { success: false, errors: [String(err)] };
    }
  },
};
