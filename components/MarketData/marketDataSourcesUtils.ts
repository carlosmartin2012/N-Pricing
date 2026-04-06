import type { MarketDataSource } from '../../types';

export interface MarketDataSourceDraft {
  id?: string;
  name: string;
  provider: string;
  status: MarketDataSource['status'];
  currenciesInput: string;
  notes: string;
}

export function createDefaultMarketDataSourceDraft(currency = 'USD'): MarketDataSourceDraft {
  return {
    name: '',
    provider: '',
    status: 'Active',
    currenciesInput: currency,
    notes: '',
  };
}

export function normalizeSourceCurrencies(input: string, fallbackCurrency = 'USD'): string[] {
  const normalized = input
    .split(/[\s,;]+/)
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  const unique = Array.from(new Set(normalized));
  return unique.length ? unique : [fallbackCurrency.toUpperCase()];
}

export function buildMarketDataSourceFromDraft(
  draft: MarketDataSourceDraft,
  fallbackCurrency = 'USD',
  existingSource?: MarketDataSource
): MarketDataSource {
  return {
    id: existingSource?.id ?? `MDS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    name: draft.name.trim() || existingSource?.name || 'Yield Curve Source',
    provider: draft.provider.trim() || existingSource?.provider || 'Internal',
    sourceType: 'YieldCurve',
    status: draft.status,
    currencies: normalizeSourceCurrencies(draft.currenciesInput, fallbackCurrency),
    lastSyncAt: existingSource?.lastSyncAt,
    notes: draft.notes.trim() || undefined,
  };
}

export function buildMarketDataSourceDraft(source: MarketDataSource): MarketDataSourceDraft {
  return {
    id: source.id,
    name: source.name,
    provider: source.provider,
    status: source.status,
    currenciesInput: source.currencies.join(', '),
    notes: source.notes || '',
  };
}

export function markMarketDataSourceSynced(
  source: MarketDataSource,
  currency: string,
  syncedAt = new Date().toISOString()
): MarketDataSource {
  const currencies = Array.from(new Set([...source.currencies, currency.toUpperCase()]));

  return {
    ...source,
    status: 'Active',
    currencies,
    lastSyncAt: syncedAt,
  };
}
