/**
 * Market benchmark lookup — pivot §Bloque H.
 *
 * Pure utility over an in-memory list of benchmarks. Typically loaded
 * from the `market_benchmarks` Supabase table (see migration
 * 20260510000001_market_benchmarks.sql) and cached in the MarketDataContext.
 */

import { bucketTenor } from './pricing/priceElasticity';

export interface MarketBenchmark {
  productType: string;
  tenorBucket: 'ST' | 'MT' | 'LT';
  clientType: string;
  currency: string;
  rate: number;
  source: string;
  asOfDate: string;
}

export interface BenchmarkLookupQuery {
  productType: string;
  clientType: string;
  currency: string;
  durationMonths: number;
}

export interface BenchmarkMatch {
  benchmark: MarketBenchmark;
  deltaBp: number;              // your rate − market, in basis points
  relative: 'BELOW' | 'ON_MARKET' | 'ABOVE';
}

const ON_MARKET_BAND_BP = 10;

/**
 * Find the most recent benchmark matching the exact product × tenor ×
 * client × currency tuple. Returns null when no match exists (caller
 * should render "no market reference" rather than a misleading zero).
 */
export const findBenchmark = (
  benchmarks: MarketBenchmark[],
  query: BenchmarkLookupQuery,
): MarketBenchmark | null => {
  const tenorBucket = bucketTenor(query.durationMonths);
  const matches = benchmarks.filter(
    (b) =>
      b.productType === query.productType &&
      b.tenorBucket === tenorBucket &&
      b.clientType === query.clientType &&
      b.currency === query.currency,
  );
  if (matches.length === 0) return null;
  // Most recent first
  matches.sort((a, b) => b.asOfDate.localeCompare(a.asOfDate));
  return matches[0];
};

/**
 * Compare the originator's rate against the best benchmark match.
 */
export const compareToMarket = (
  yourRatePct: number,
  benchmarks: MarketBenchmark[],
  query: BenchmarkLookupQuery,
): BenchmarkMatch | null => {
  const benchmark = findBenchmark(benchmarks, query);
  if (!benchmark) return null;
  const deltaBp = Math.round((yourRatePct - benchmark.rate) * 100);
  const relative: BenchmarkMatch['relative'] =
    Math.abs(deltaBp) <= ON_MARKET_BAND_BP ? 'ON_MARKET' : deltaBp > 0 ? 'ABOVE' : 'BELOW';
  return { benchmark, deltaBp, relative };
};
