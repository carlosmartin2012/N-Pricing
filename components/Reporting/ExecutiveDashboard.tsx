import React, { useMemo } from 'react';
import type { ProductDefinition, Transaction } from '../../types';
import type {
  PortfolioBusinessUnitSummary,
  PortfolioMetrics,
} from './reportingTypes';

interface Props {
  deals: Transaction[];
  products: ProductDefinition[];
  portfolioMetrics: PortfolioMetrics;
  portfolioByBU: PortfolioBusinessUnitSummary[];
}

const ExecutiveDashboard: React.FC<Props> = ({
  deals,
  products,
  portfolioMetrics,
  portfolioByBU,
}) => {
  const bookedDeals = deals.filter(d => d.status === 'Booked' || d.status === 'Approved');
  const totalVolume = bookedDeals.reduce((sum, deal) => sum + (deal.amount || 0), 0);
  const avgMargin = bookedDeals.length > 0
    ? bookedDeals.reduce((sum, deal) => sum + (deal.marginTarget || 0), 0) / bookedDeals.length
    : 0;

  const byProduct = useMemo(() => {
    const map: Record<string, { volume: number; count: number }> = {};

    bookedDeals.forEach(deal => {
      const product = deal.productType || 'Unknown';
      if (!map[product]) map[product] = { volume: 0, count: 0 };
      map[product].volume += deal.amount || 0;
      map[product].count++;
    });

    return Object.entries(map)
      .map(([product, value]) => ({
        product: products.find(item => item.id === product)?.name || product,
        ...value,
      }))
      .sort((a, b) => b.volume - a.volume);
  }, [bookedDeals, products]);

  const byCurrency = useMemo(() => {
    const map: Record<string, number> = {};
    bookedDeals.forEach(deal => {
      map[deal.currency] = (map[deal.currency] || 0) + (deal.amount || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [bookedDeals]);

  const fmtM = (value: number) => {
    if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    return `$${(value / 1e3).toFixed(0)}K`;
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {[
          { label: 'Total Portfolio', value: fmtM(totalVolume), sub: `${bookedDeals.length} deals`, color: 'text-white' },
          { label: 'Avg Margin', value: `${avgMargin.toFixed(2)}%`, sub: 'target spread', color: 'text-emerald-400' },
          { label: 'LCR Ratio', value: `${portfolioMetrics.lcr.toFixed(1)}%`, sub: portfolioMetrics.lcr > 100 ? 'COMPLIANT' : 'AT RISK', color: portfolioMetrics.lcr > 100 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'NSFR Ratio', value: `${portfolioMetrics.nsfr.toFixed(1)}%`, sub: portfolioMetrics.nsfr > 100 ? 'COMPLIANT' : 'AT RISK', color: portfolioMetrics.nsfr > 100 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Currencies', value: `${byCurrency.length}`, sub: byCurrency.map(currency => currency[0]).join(', '), color: 'text-cyan-400' },
        ].map(kpi => (
          <div key={kpi.label} className="nfq-kpi-card">
            <div className="nfq-kpi-label mb-2">{kpi.label}</div>
            <div className={`nfq-kpi-value text-2xl ${kpi.color}`}>{kpi.value}</div>
            <div className="mt-1 nfq-label">{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="nfq-kpi-card">
          <h4 className="nfq-kpi-label mb-4">Volume by Business Unit</h4>
          <div className="space-y-3">
            {portfolioByBU.map(bu => {
              const pct = totalVolume > 0 ? (bu.volume / totalVolume) * 100 : 0;
              return (
                <div key={bu.bu} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-[color:var(--nfq-text-secondary)]">{bu.buName}</span>
                    <span className="font-mono text-[color:var(--nfq-text-muted)]">{fmtM(bu.volume)} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--nfq-bg-elevated)]">
                    <div className="h-full rounded-full bg-[var(--nfq-accent)]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {portfolioByBU.length === 0 && <div className="py-4 text-center text-xs text-[color:var(--nfq-text-faint)]">No booked deals</div>}
          </div>
        </div>

        <div className="nfq-kpi-card">
          <h4 className="nfq-kpi-label mb-4">Volume by Product</h4>
          <div className="space-y-3">
            {byProduct.map(product => {
              const pct = totalVolume > 0 ? (product.volume / totalVolume) * 100 : 0;
              return (
                <div key={product.product} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-[color:var(--nfq-text-secondary)]">{product.product}</span>
                    <span className="font-mono text-[color:var(--nfq-text-muted)]">{fmtM(product.volume)} ({product.count} deals)</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--nfq-bg-elevated)]">
                    <div className="h-full rounded-full bg-[var(--nfq-accent-secondary)]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {byProduct.length === 0 && <div className="py-4 text-center text-xs text-[color:var(--nfq-text-faint)]">No booked deals</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveDashboard;
