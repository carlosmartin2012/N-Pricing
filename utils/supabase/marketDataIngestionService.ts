import type { MarketDataSource, YieldCurvePoint } from '../../types';
import { configService } from './config';
import { marketDataService } from './market';

export const marketDataIngestionService = {
  async fetchMarketDataSources(): Promise<MarketDataSource[]> {
    return configService.fetchMarketDataSources();
  },

  async saveMarketDataSources(sources: MarketDataSource[]): Promise<void> {
    await configService.saveMarketDataSources(sources);
  },

  async registerMarketDataSource(source: MarketDataSource): Promise<MarketDataSource[]> {
    const existing = await configService.fetchMarketDataSources();
    const nextSources = existing.some((item) => item.id === source.id)
      ? existing.map((item) => (item.id === source.id ? source : item))
      : [source, ...existing];
    await configService.saveMarketDataSources(nextSources);
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
    await marketDataService.saveCurveSnapshot(currency, date, points);
    await marketDataService.saveCurveHistorySnapshot(sourceId, currency, date, points);
  },
};
