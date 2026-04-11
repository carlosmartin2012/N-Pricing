import type { MarketDataSource, YieldCurvePoint } from '../../types';
import * as configApi from '../../api/config';
import * as marketDataApi from '../../api/marketData';
import { apiPost } from '../apiFetch';

export const marketDataIngestionService = {
  async fetchMarketDataSources(): Promise<MarketDataSource[]> {
    return configApi.fetchMarketDataSources();
  },

  async saveMarketDataSources(sources: MarketDataSource[]): Promise<void> {
    await configApi.saveMarketDataSources(sources);
  },

  async registerMarketDataSource(source: MarketDataSource): Promise<MarketDataSource[]> {
    const existing = await configApi.fetchMarketDataSources();
    const nextSources = existing.some((item) => item.id === source.id)
      ? existing.map((item) => (item.id === source.id ? source : item))
      : [source, ...existing];
    await configApi.saveMarketDataSources(nextSources);
    return nextSources;
  },

  async captureYieldCurveSnapshot({
    sourceId,
    currency,
    date,
    points,
  }: {
    sourceId: string;
    currency: string;
    date: string;
    points: YieldCurvePoint[];
  }): Promise<void> {
    await marketDataApi.upsertYieldCurves(currency, date, points);
    await apiPost('/market-data/yield-curve-history', {
      curve_id: sourceId,
      currency,
      snapshot_date: date,
      points,
    });
  },
};
