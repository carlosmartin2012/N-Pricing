import React, { useMemo } from 'react';
import type { Transaction } from '../../types';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
  Line,
  Area,
  Legend,
} from 'recharts';
import { calculatePricing } from '../../utils/pricingEngine';
import { useData } from '../../contexts/DataContext';
import { buildPricingContext } from '../../utils/pricingContext';

interface Props {
  deals: Transaction[];
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const fmtPct = (v: number) => `${v.toFixed(2)}%`;
const fmtCount = (v: number) => v.toLocaleString('en-US');

const SEGMENT_COLORS: Record<string, string> = {
  Corporate: '#06b6d4',
  SME: '#8b5cf6',
  Retail: '#f59e0b',
  'Wealth Management': '#10b981',
  Institutional: '#ec4899',
  Consumer: '#ef4444',
};
const DEFAULT_DOT_COLOR = '#94a3b8';

const tooltipStyle: React.CSSProperties = {
  backgroundColor: 'var(--nfq-bg-elevated)',
  border: '1px solid var(--nfq-border-ghost)',
  borderRadius: 'var(--nfq-radius-lg)',
  padding: '8px 12px',
  fontFamily: 'var(--nfq-font-mono)',
  fontSize: '12px',
};

/* ── Component ───────────────────────────────────────────────────────────── */

const NIISensitivity: React.FC<Props> = React.memo(({ deals }) => {
  const contextData = useData();

  // Filter to meaningful deals
  const activeDealsList = useMemo(
    () => deals.filter(d => d.status === 'Booked' || d.status === 'Approved' || d.status === 'Pending_Approval'),
    [deals],
  );

  // Build pricing context from global data
  const pricingContext = useMemo(
    () =>
      buildPricingContext(
        {
          yieldCurves: contextData.yieldCurves,
          liquidityCurves: contextData.liquidityCurves,
          rules: contextData.rules,
          ftpRateCards: contextData.ftpRateCards,
          transitionGrid: contextData.transitionGrid,
          physicalGrid: contextData.physicalGrid,
          behaviouralModels: contextData.behaviouralModels,
        },
        {
          clients: contextData.clients,
          products: contextData.products,
          businessUnits: contextData.businessUnits,
        },
      ),
    [
      contextData.yieldCurves,
      contextData.liquidityCurves,
      contextData.rules,
      contextData.ftpRateCards,
      contextData.transitionGrid,
      contextData.physicalGrid,
      contextData.behaviouralModels,
      contextData.clients,
      contextData.products,
      contextData.businessUnits,
    ],
  );

  // Compute pricing for each deal
  const pricedDeals = useMemo(() => {
    return activeDealsList.map(deal => {
      const result = calculatePricing(deal, contextData.approvalMatrix, pricingContext);
      return { deal, result };
    });
  }, [activeDealsList, contextData.approvalMatrix, pricingContext]);

  /* ── KPI derivation ────────────────────────────────────────────────────── */

  const kpis = useMemo(() => {
    const n = pricedDeals.length;
    if (n === 0) {
      return { avgTechnical: 0, avgFinal: 0, pricingGap: 0, belowFloor: 0, totalDeals: 0 };
    }

    let totalWeight = 0;
    let weightedTechnical = 0;
    let weightedFinal = 0;
    let belowFloor = 0;

    for (const { deal, result } of pricedDeals) {
      const w = Math.abs(deal.amount);
      totalWeight += w;
      weightedTechnical += result.technicalPrice * w;
      weightedFinal += result.finalClientRate * w;
      if (result.finalClientRate < result.floorPrice && result.floorPrice > 0) {
        belowFloor++;
      }
    }

    const avgTechnical = totalWeight > 0 ? weightedTechnical / totalWeight : 0;
    const avgFinal = totalWeight > 0 ? weightedFinal / totalWeight : 0;
    const pricingGap = avgFinal - avgTechnical;

    return { avgTechnical, avgFinal, pricingGap, belowFloor, totalDeals: n };
  }, [pricedDeals]);

  /* ── Scatter data ──────────────────────────────────────────────────────── */

  const scatterData = useMemo(() => {
    return pricedDeals
      .filter(({ result }) => result.technicalPrice !== 0 || result.finalClientRate !== 0)
      .map(({ deal, result }) => ({
        technicalPrice: result.technicalPrice,
        finalRate: result.finalClientRate,
        amount: deal.amount,
        segment: deal.clientType || 'Other',
        approvalLevel: result.approvalLevel,
        product: deal.productType,
        id: deal.id,
      }));
  }, [pricedDeals]);

  // Group scatter data by segment for coloring
  const scatterBySegment = useMemo(() => {
    const groups: Record<string, typeof scatterData> = {};
    for (const d of scatterData) {
      const key = d.segment;
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    }
    return groups;
  }, [scatterData]);

  /* ── Monthly drift data ────────────────────────────────────────────────── */

  const monthlyDrift = useMemo(() => {
    const buckets: Record<string, { sumTechnical: number; sumFinal: number; totalWeight: number; count: number }> = {};

    for (const { deal, result } of pricedDeals) {
      if (!deal.startDate) continue;
      // Group by YYYY-MM
      const month = deal.startDate.slice(0, 7);
      if (!buckets[month]) {
        buckets[month] = { sumTechnical: 0, sumFinal: 0, totalWeight: 0, count: 0 };
      }
      const w = Math.abs(deal.amount);
      buckets[month].sumTechnical += result.technicalPrice * w;
      buckets[month].sumFinal += result.finalClientRate * w;
      buckets[month].totalWeight += w;
      buckets[month].count++;
    }

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, b]) => ({
        month,
        avgTechnical: b.totalWeight > 0 ? b.sumTechnical / b.totalWeight : 0,
        avgFinal: b.totalWeight > 0 ? b.sumFinal / b.totalWeight : 0,
        deals: b.count,
      }));
  }, [pricedDeals]);

  /* ── Scatter axis domain ───────────────────────────────────────────────── */

  const axisDomain = useMemo(() => {
    if (scatterData.length === 0) return { min: 0, max: 5 };
    const allVals = scatterData.flatMap(d => [d.technicalPrice, d.finalRate]);
    const min = Math.floor(Math.min(...allVals) * 2) / 2;
    const max = Math.ceil(Math.max(...allVals) * 2) / 2;
    const padding = Math.max(0.25, (max - min) * 0.1);
    return { min: min - padding, max: max + padding };
  }, [scatterData]);

  /* ── Render ────────────────────────────────────────────────────────────── */

  if (activeDealsList.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[color:var(--nfq-text-muted)]">
        <p>No booked or approved deals to analyze.</p>
      </div>
    );
  }

  const gapColor = kpis.pricingGap >= 0 ? 'var(--nfq-success)' : 'var(--nfq-danger)';
  const belowFloorColor = kpis.belowFloor > 0 ? 'var(--nfq-danger)' : 'var(--nfq-success)';

  return (
    <div className="space-y-6">
      {/* ── KPI Row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] p-4">
          <div className="nfq-label mb-1">Avg Technical Price</div>
          <div className="font-mono text-2xl font-bold text-[color:var(--nfq-text-primary)]">
            {fmtPct(kpis.avgTechnical)}
          </div>
          <div className="text-xs text-[color:var(--nfq-text-muted)]">
            Weighted by notional ({fmtCount(kpis.totalDeals)} deals)
          </div>
        </div>

        <div className="rounded-2xl border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] p-4">
          <div className="nfq-label mb-1">Avg Final Rate</div>
          <div className="font-mono text-2xl font-bold text-[color:var(--nfq-text-primary)]">
            {fmtPct(kpis.avgFinal)}
          </div>
          <div className="text-xs text-[color:var(--nfq-text-muted)]">
            Client-facing rate
          </div>
        </div>

        <div className="rounded-2xl border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] p-4">
          <div className="nfq-label mb-1">Pricing Gap</div>
          <div className="font-mono text-2xl font-bold" style={{ color: gapColor }}>
            {kpis.pricingGap >= 0 ? '+' : ''}{fmtPct(kpis.pricingGap)}
          </div>
          <div className="text-xs text-[color:var(--nfq-text-muted)]">
            {kpis.pricingGap >= 0 ? 'Margin above minimum' : 'Underpricing risk'}
          </div>
        </div>

        <div className="rounded-2xl border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] p-4">
          <div className="nfq-label mb-1">Deals Below Floor</div>
          <div className="font-mono text-2xl font-bold" style={{ color: belowFloorColor }}>
            {kpis.belowFloor}
          </div>
          <div className="text-xs text-[color:var(--nfq-text-muted)]">
            Final rate &lt; floor price
          </div>
        </div>
      </div>

      {/* ── Scatter: Technical vs Final ──────────────────────────────────── */}
      <div className="rounded-2xl border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] p-4">
        <div className="nfq-label mb-3">Technical Price vs Final Rate</div>
        <div className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--nfq-border-ghost)" />
              <XAxis
                type="number"
                dataKey="technicalPrice"
                name="Technical Price"
                domain={[axisDomain.min, axisDomain.max]}
                tick={{ fill: 'var(--nfq-text-muted)', fontSize: 10, fontFamily: 'var(--nfq-font-mono)' }}
                tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                label={{ value: 'Technical Price (%)', position: 'insideBottom', offset: -5, fill: 'var(--nfq-text-muted)', fontSize: 10 }}
              />
              <YAxis
                type="number"
                dataKey="finalRate"
                name="Final Rate"
                domain={[axisDomain.min, axisDomain.max]}
                tick={{ fill: 'var(--nfq-text-muted)', fontSize: 10, fontFamily: 'var(--nfq-font-mono)' }}
                tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                label={{ value: 'Final Rate (%)', angle: -90, position: 'insideLeft', fill: 'var(--nfq-text-muted)', fontSize: 10 }}
              />
              <ZAxis type="number" dataKey="amount" range={[40, 400]} name="Amount" />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={tooltipStyle}
                content={({ payload }) => {
                  if (!payload || payload.length === 0) return null;
                  const d = payload[0]?.payload as (typeof scatterData)[number] | undefined;
                  if (!d) return null;
                  return (
                    <div style={tooltipStyle}>
                      <div className="font-semibold text-[color:var(--nfq-text-primary)] text-xs mb-1">{d.product}</div>
                      <div className="font-mono text-xs text-[color:var(--nfq-text-secondary)]">
                        Technical: {fmtPct(d.technicalPrice)}
                      </div>
                      <div className="font-mono text-xs text-[color:var(--nfq-text-secondary)]">
                        Final: {fmtPct(d.finalRate)}
                      </div>
                      <div className="font-mono text-xs text-[color:var(--nfq-text-secondary)]">
                        Gap: {fmtPct(d.finalRate - d.technicalPrice)}
                      </div>
                      <div className="text-xs text-[color:var(--nfq-text-muted)] mt-1">
                        {d.segment} &middot; {d.approvalLevel}
                      </div>
                    </div>
                  );
                }}
              />
              {/* 45-degree reference line: where technical = final */}
              <ReferenceLine
                segment={[
                  { x: axisDomain.min, y: axisDomain.min },
                  { x: axisDomain.max, y: axisDomain.max },
                ]}
                stroke="var(--nfq-text-muted)"
                strokeDasharray="6 4"
                strokeWidth={1}
              />
              {Object.entries(scatterBySegment).map(([segment, data]) => (
                <Scatter
                  key={segment}
                  name={segment}
                  data={data}
                  fill={SEGMENT_COLORS[segment] || DEFAULT_DOT_COLOR}
                  fillOpacity={0.7}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap gap-3 justify-center">
          {Object.keys(scatterBySegment).map(segment => (
            <div key={segment} className="flex items-center gap-1.5 text-xs text-[color:var(--nfq-text-muted)]">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: SEGMENT_COLORS[segment] || DEFAULT_DOT_COLOR }}
              />
              <span>{segment}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs text-[color:var(--nfq-text-muted)]">
            <span className="font-mono">---</span>
            <span>Technical = Final</span>
          </div>
        </div>
      </div>

      {/* ── Drift Over Time ──────────────────────────────────────────────── */}
      {monthlyDrift.length > 1 && (
        <div className="rounded-2xl border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] p-4">
          <div className="nfq-label mb-3">Pricing Drift Over Time</div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyDrift} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <defs>
                  <linearGradient id="marginBand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--nfq-border-ghost)" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: 'var(--nfq-text-muted)', fontSize: 10, fontFamily: 'var(--nfq-font-mono)' }}
                />
                <YAxis
                  tick={{ fill: 'var(--nfq-text-muted)', fontSize: 10, fontFamily: 'var(--nfq-font-mono)' }}
                  tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number | undefined, name: string | undefined) => {
                    const label = name === 'avgTechnical' ? 'Technical Price' : name === 'avgFinal' ? 'Avg Final Rate' : (name ?? '');
                    return [value != null ? fmtPct(value) : '-', label] as [React.ReactNode, string];
                  }}
                  labelFormatter={(label: any) => `Month: ${String(label)}`}
                />
                <Legend
                  formatter={(value: string) =>
                    value === 'avgTechnical' ? 'Avg Technical Price' : value === 'avgFinal' ? 'Avg Final Rate' : value
                  }
                  wrapperStyle={{ fontSize: '11px', fontFamily: 'var(--nfq-font-mono)' }}
                />
                {/* Shaded area between the two lines — approximate via stacked area from technical to final */}
                <Area
                  type="monotone"
                  dataKey="avgFinal"
                  stroke="none"
                  fill="url(#marginBand)"
                  fillOpacity={1}
                />
                <Line
                  type="monotone"
                  dataKey="avgTechnical"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#f59e0b' }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="avgFinal"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#10b981' }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-center text-xs text-[color:var(--nfq-text-muted)]">
            {monthlyDrift.length > 0 && (() => {
              const first = monthlyDrift[0];
              const last = monthlyDrift[monthlyDrift.length - 1];
              const gapFirst = first.avgFinal - first.avgTechnical;
              const gapLast = last.avgFinal - last.avgTechnical;
              const trend = gapLast - gapFirst;
              if (Math.abs(trend) < 0.05) return 'Pricing margin is stable over the period.';
              return trend > 0
                ? 'Pricing margin is widening — rates are moving above technical minimums.'
                : 'Pricing margin is tightening — commercial pressure on margins.';
            })()}
          </div>
        </div>
      )}
    </div>
  );
});

export default NIISensitivity;
