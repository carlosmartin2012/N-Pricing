import { describe, expect, it } from 'vitest';
import {
  buildMarketDataSourceFromDraft,
  markMarketDataSourceSynced,
  normalizeSourceCurrencies,
} from '../../components/MarketData/marketDataSourcesUtils';

describe('marketDataSourcesUtils', () => {
  it('normalizes source currencies into unique uppercase codes', () => {
    expect(normalizeSourceCurrencies('usd, eur usd; gbp')).toEqual(['USD', 'EUR', 'GBP']);
  });

  it('builds a governed yield curve source from a draft with sensible defaults', () => {
    const source = buildMarketDataSourceFromDraft(
      {
        name: ' Bloomberg BVAL ',
        provider: ' Bloomberg ',
        status: 'Active',
        currenciesInput: 'usd, eur',
        notes: ' Daily validated ',
      },
      'USD'
    );

    expect(source.id).toContain('MDS-');
    expect(source.name).toBe('Bloomberg BVAL');
    expect(source.provider).toBe('Bloomberg');
    expect(source.sourceType).toBe('YieldCurve');
    expect(source.currencies).toEqual(['USD', 'EUR']);
    expect(source.notes).toBe('Daily validated');
  });

  it('marks a source as synced and extends currency coverage', () => {
    const synced = markMarketDataSourceSynced(
      {
        id: 'MDS-1',
        name: 'Bloomberg USD',
        provider: 'Bloomberg',
        sourceType: 'YieldCurve',
        status: 'Inactive',
        currencies: ['USD'],
      },
      'eur',
      '2026-04-02T12:00:00.000Z'
    );

    expect(synced.status).toBe('Active');
    expect(synced.currencies).toEqual(['USD', 'EUR']);
    expect(synced.lastSyncAt).toBe('2026-04-02T12:00:00.000Z');
  });
});
