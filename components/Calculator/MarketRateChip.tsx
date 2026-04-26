/**
 * Market rate comparison chip — Ola 6 Bloque D.
 *
 * Renders a compact "Market X.XX% (source) · Δbp vs market" badge next to
 * the finalClientRate, so a trader can see at a glance whether the quote is
 * above, on, or below the most recent external benchmark for their
 * product × tenor × client × currency tuple.
 *
 * - Emerald  → quote at least 5 bp BELOW market (strongly competitive).
 * - Amber    → within ±5 bp of market (on-market).
 * - Rose     → at least 5 bp ABOVE market (potentially uncompetitive).
 *
 * Renders nothing when no benchmark match exists (vs. a misleading zero).
 */

import React, { useMemo } from 'react';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { useMarketBenchmarksQuery } from '../../hooks/queries/useMarketBenchmarksQuery';
import { compareToMarket, type MarketBenchmark } from '../../utils/marketBenchmarks';
import type { Transaction } from '../../types';

interface Props {
  deal: Transaction;
  finalClientRatePct: number;
}

function toneClasses(relative: 'BELOW' | 'ON_MARKET' | 'ABOVE'): { bg: string; text: string; ring: string } {
  if (relative === 'BELOW')   return { bg: 'bg-emerald-500/10', text: 'text-emerald-300', ring: 'ring-emerald-500/30' };
  if (relative === 'ON_MARKET') return { bg: 'bg-amber-500/10',  text: 'text-amber-300',  ring: 'ring-amber-500/30'  };
  return { bg: 'bg-rose-500/10',   text: 'text-rose-300',   ring: 'ring-rose-500/30'   };
}

const MarketRateChip: React.FC<Props> = ({ deal, finalClientRatePct }) => {
  const { data: benchmarks } = useMarketBenchmarksQuery({
    products:   [deal.productType],
    currencies: [deal.currency],
    clients:    [deal.clientType],
  });

  const match = useMemo(() => {
    if (!benchmarks || benchmarks.length === 0) return null;
    const feed: MarketBenchmark[] = benchmarks.map((b) => ({
      productType: b.productType,
      tenorBucket: b.tenorBucket,
      clientType:  b.clientType,
      currency:    b.currency,
      rate:        b.rate,
      source:      b.source,
      asOfDate:    b.asOfDate,
    }));
    return compareToMarket(finalClientRatePct, feed, {
      productType:    deal.productType,
      clientType:     deal.clientType,
      currency:       deal.currency,
      durationMonths: deal.durationMonths,
    });
  }, [benchmarks, deal.productType, deal.clientType, deal.currency, deal.durationMonths, finalClientRatePct]);

  if (!match) return null;

  const tone = toneClasses(match.relative);
  const Icon = match.relative === 'BELOW' ? TrendingDown : match.relative === 'ABOVE' ? TrendingUp : Minus;
  const deltaLabel = match.deltaBp === 0
    ? 'on market'
    : `${match.deltaBp > 0 ? '+' : ''}${match.deltaBp} bp vs market`;

  return (
    <div
      data-testid="market-rate-chip"
      className={`mx-4 my-2 flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-mono ring-1 ${tone.bg} ${tone.text} ${tone.ring}`}
      title={`As of ${match.benchmark.asOfDate} · ${match.benchmark.source}`}
    >
      <Icon size={14} aria-hidden="true" />
      <span className="tracking-normal opacity-80">Market</span>
      <span className="font-semibold">{match.benchmark.rate.toFixed(2)}%</span>
      <span className="opacity-60">({match.benchmark.source})</span>
      <span className="ml-auto font-semibold">{deltaLabel}</span>
    </div>
  );
};

export default MarketRateChip;
