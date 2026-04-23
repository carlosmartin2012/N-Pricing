/**
 * Market benchmarks API client (Ola 6 Bloque D).
 *
 * Cross-tenant reference data — no x-entity-id required. Read open to any
 * authenticated user; write is admin-only (enforced server-side).
 *
 * Supersedes `listBenchmarks` / `upsertBenchmark` in api/whatIf.ts — those
 * point to the orphan path `/what-if/benchmarks` and should be removed
 * once callers migrate.
 */

import { apiGet, apiPost, apiDelete } from '../utils/apiFetch';
import { createLogger } from '../utils/logger';
import type { MarketBenchmark } from '../utils/marketBenchmarks';

const log = createLogger('api/marketBenchmarks');

export interface MarketBenchmarkFilters {
  products?: string[];
  currencies?: string[];
  clients?: string[];
}

export interface MarketBenchmarkWithId extends MarketBenchmark {
  id: string;
  notes: string | null;
}

function mapServerRow(row: Record<string, unknown>): MarketBenchmarkWithId {
  return {
    id:          String(row.id ?? ''),
    productType: String(row.productType ?? ''),
    tenorBucket: (row.tenorBucket as MarketBenchmarkWithId['tenorBucket']) ?? 'MT',
    clientType:  String(row.clientType ?? ''),
    currency:    String(row.currency ?? 'EUR'),
    rate:        Number(row.rate ?? 0),
    source:      String(row.source ?? ''),
    asOfDate:    String(row.asOfDate ?? ''),
    notes:       row.notes == null ? null : String(row.notes),
  };
}

export async function listMarketBenchmarks(
  filters?: MarketBenchmarkFilters,
): Promise<MarketBenchmarkWithId[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.products?.length)   params.set('products',   filters.products.join(','));
    if (filters?.currencies?.length) params.set('currencies', filters.currencies.join(','));
    if (filters?.clients?.length)    params.set('clients',    filters.clients.join(','));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const rows = await apiGet<Record<string, unknown>[]>(`/market-benchmarks${qs}`);
    return Array.isArray(rows) ? rows.map(mapServerRow) : [];
  } catch (err) {
    log.error('listMarketBenchmarks failed', {}, err as Error);
    return [];
  }
}

export async function upsertMarketBenchmark(
  benchmark: Omit<MarketBenchmarkWithId, 'id'> & { id?: string },
): Promise<MarketBenchmarkWithId | null> {
  try {
    const row = await apiPost<Record<string, unknown>>('/market-benchmarks', benchmark);
    return row ? mapServerRow(row) : null;
  } catch (err) {
    log.error('upsertMarketBenchmark failed', {}, err as Error);
    return null;
  }
}

export async function deleteMarketBenchmark(id: string): Promise<boolean> {
  try {
    await apiDelete(`/market-benchmarks/${id}`);
    return true;
  } catch (err) {
    log.error('deleteMarketBenchmark failed', { id }, err as Error);
    return false;
  }
}
