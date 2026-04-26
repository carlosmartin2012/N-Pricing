import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from '../ui/charts/lazyRecharts';
import { Transaction, BusinessUnit, ProductDefinition, ClientEntity } from '../../types';
import { calculatePricing } from '../../utils/pricingEngine';
import { useData } from '../../contexts/DataContext';
import { TrendingUp, BarChart4, PieChart as PieIcon, Activity } from 'lucide-react';
import { buildPricingContext } from '../../utils/pricingContext';

const COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899'];

interface Props {
  deals: Transaction[];
  businessUnits: BusinessUnit[];
  products: ProductDefinition[];
  clients: ClientEntity[];
}

const fmtM = (v: number) => {
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

const fmtPercent = (value: number | string | readonly (number | string)[] | undefined) => {
  if (typeof value === 'number') return `${value.toFixed(2)}%`;
  if (Array.isArray(value)) return value.join(' - ');
  return `${value ?? '-'}`;
};

const tooltipStyle: React.CSSProperties = {
  backgroundColor: 'var(--nfq-bg-elevated)',
  border: '1px solid var(--nfq-border-ghost)',
  borderRadius: 'var(--nfq-radius-lg)',
  padding: '8px 12px',
  fontFamily: 'var(--nfq-font-mono)',
  fontSize: '12px',
};

const PricingAnalytics: React.FC<Props> = ({ deals, businessUnits, products, clients }) => {
  const contextData = useData();

  const bookedDeals = useMemo(
    () => deals.filter(d => d.status === 'Booked' || d.status === 'Approved'),
    [deals]
  );

  const pricingContext = useMemo(
    () =>
      buildPricingContext({
        yieldCurves: contextData.yieldCurves,
        liquidityCurves: contextData.liquidityCurves,
        rules: contextData.rules,
        ftpRateCards: contextData.ftpRateCards,
        transitionGrid: contextData.transitionGrid,
        physicalGrid: contextData.physicalGrid,
        greeniumGrid: contextData.greeniumGrid,
        behaviouralModels: contextData.behaviouralModels,
      }, {
        clients,
        products,
        businessUnits,
      }),
    [
      contextData.yieldCurves,
      contextData.liquidityCurves,
      contextData.rules,
      contextData.ftpRateCards,
      contextData.transitionGrid,
      contextData.physicalGrid,
      contextData.greeniumGrid,
      contextData.behaviouralModels,
      clients,
      products,
      businessUnits,
    ]
  );

  // Build pricing context and compute results for all booked deals
  const pricingResults = useMemo(() => {
    return bookedDeals.map(deal => ({
      deal,
      result: calculatePricing(deal, contextData.approvalMatrix, pricingContext),
    }));
  }, [bookedDeals, contextData.approvalMatrix, pricingContext]);

  // ── Section 1: Summary KPIs ──
  const summaryKpis = useMemo(() => {
    const count = pricingResults.length;
    const totalVolume = pricingResults.reduce((s, p) => s + (p.deal.amount || 0), 0);
    const avgFtp = count > 0
      ? pricingResults.reduce((s, p) => s + p.result.totalFTP, 0) / count
      : 0;
    const avgRaroc = count > 0
      ? pricingResults.reduce((s, p) => s + p.result.raroc, 0) / count
      : 0;
    return { count, totalVolume, avgFtp, avgRaroc };
  }, [pricingResults]);

  // ── Section 2: RAROC Distribution ──
  const rarocDistribution = useMemo(() => {
    const buckets = [
      { label: '<0%', min: -Infinity, max: 0, color: '#ef4444' },
      { label: '0-5%', min: 0, max: 5, color: '#ef4444' },
      { label: '5-10%', min: 5, max: 10, color: '#f59e0b' },
      { label: '10-15%', min: 10, max: 15, color: '#10b981' },
      { label: '15-20%', min: 15, max: 20, color: '#10b981' },
      { label: '>20%', min: 20, max: Infinity, color: '#10b981' },
    ];
    return buckets.map(b => ({
      bucket: b.label,
      count: pricingResults.filter(p => p.result.raroc >= b.min && p.result.raroc < b.max).length,
      color: b.color,
    }));
  }, [pricingResults]);

  // ── Section 3: FTP by Product Category ──
  const ftpByCategory = useMemo(() => {
    const categories: Array<'Asset' | 'Liability' | 'Off-Balance'> = ['Asset', 'Liability', 'Off-Balance'];
    return categories.map(cat => {
      const items = pricingResults.filter(p => p.deal.category === cat);
      const count = items.length;
      return {
        category: cat,
        count,
        avgBaseRate: count > 0 ? items.reduce((s, p) => s + p.result.baseRate, 0) / count : 0,
        avgLP: count > 0 ? items.reduce((s, p) => s + p.result.liquiditySpread, 0) / count : 0,
        avgTotalFTP: count > 0 ? items.reduce((s, p) => s + p.result.totalFTP, 0) / count : 0,
      };
    });
  }, [pricingResults]);

  // ── Section 4: Product Volume Breakdown ──
  const productVolume = useMemo(() => {
    const map: Record<string, { name: string; volume: number; count: number }> = {};
    pricingResults.forEach(({ deal }) => {
      const pid = deal.productType || 'Unknown';
      if (!map[pid]) {
        const prod = products.find(p => p.id === pid);
        map[pid] = { name: prod?.name || pid, volume: 0, count: 0 };
      }
      map[pid].volume += deal.amount || 0;
      map[pid].count++;
    });
    return Object.values(map).sort((a, b) => b.volume - a.volume);
  }, [pricingResults, products]);

  // ── Section 5: BU Performance Table ──
  const buPerformance = useMemo(() => {
    const map: Record<string, {
      buName: string; dealCount: number; totalFtp: number;
      totalRaroc: number; totalVolume: number; totalMargin: number;
    }> = {};
    pricingResults.forEach(({ deal, result }) => {
      const buId = deal.businessUnit;
      if (!map[buId]) {
        const bu = businessUnits.find(b => b.id === buId);
        map[buId] = { buName: bu?.name || buId, dealCount: 0, totalFtp: 0, totalRaroc: 0, totalVolume: 0, totalMargin: 0 };
      }
      map[buId].dealCount++;
      map[buId].totalFtp += result.totalFTP;
      map[buId].totalRaroc += result.raroc;
      map[buId].totalVolume += deal.amount || 0;
      map[buId].totalMargin += deal.marginTarget || 0;
    });
    return Object.values(map)
      .map(bu => ({
        buName: bu.buName,
        dealCount: bu.dealCount,
        avgFtp: bu.dealCount > 0 ? bu.totalFtp / bu.dealCount : 0,
        avgRaroc: bu.dealCount > 0 ? bu.totalRaroc / bu.dealCount : 0,
        totalVolume: bu.totalVolume,
        avgMargin: bu.dealCount > 0 ? bu.totalMargin / bu.dealCount : 0,
      }))
      .sort((a, b) => b.totalVolume - a.totalVolume);
  }, [pricingResults, businessUnits]);

  if (bookedDeals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <Activity size={40} className="mb-4 opacity-30" />
        <div className="text-sm font-medium">No Booked Deals</div>
        <div className="text-xs mt-1 text-slate-600">Book deals to populate pricing analytics</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Section 1: Summary KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Deals', value: `${summaryKpis.count}`, icon: <BarChart4 size={14} />, color: 'text-cyan-400' },
          { label: 'Avg FTP Rate', value: `${summaryKpis.avgFtp.toFixed(2)}%`, icon: <TrendingUp size={14} />, color: 'text-emerald-400' },
          { label: 'Avg RAROC', value: `${summaryKpis.avgRaroc.toFixed(1)}%`, icon: <Activity size={14} />, color: summaryKpis.avgRaroc >= 10 ? 'text-emerald-400' : summaryKpis.avgRaroc >= 5 ? 'text-amber-400' : 'text-red-400' },
          { label: 'Portfolio Volume', value: fmtM(summaryKpis.totalVolume), icon: <PieIcon size={14} />, color: 'text-white' },
        ].map(kpi => (
          <div key={kpi.label} className="nfq-kpi-card">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[color:var(--nfq-text-muted)]">{kpi.icon}</span>
              <span className="nfq-kpi-label">{kpi.label}</span>
            </div>
            <div className={`nfq-kpi-value text-xl ${kpi.color}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* ── Section 2 & 3: Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* RAROC Distribution */}
        <div className="nfq-kpi-card">
          <h4 className="nfq-kpi-label mb-4 flex items-center gap-2">
            <BarChart4 size={14} className="text-[color:var(--nfq-accent)]" />
            RAROC Distribution
          </h4>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rarocDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis dataKey="bucket" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 9 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 9 }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Deals" radius={[4, 4, 0, 0]}>
                  {rarocDistribution.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* FTP by Product Category */}
        <div className="nfq-kpi-card">
          <h4 className="nfq-kpi-label mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-[color:var(--nfq-success)]" />
            FTP Breakdown by Category
          </h4>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ftpByCategory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 9 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 9 }} unit="%" />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => fmtPercent(value)} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="avgBaseRate" name="Base Rate" fill="#06b6d4" radius={[2, 2, 0, 0]} />
                <Bar dataKey="avgLP" name="Liquidity Premium" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                <Bar dataKey="avgTotalFTP" name="Total FTP" fill="#10b981" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Section 4: Product Volume Pie ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="nfq-kpi-card">
          <h4 className="nfq-kpi-label mb-4 flex items-center gap-2">
            <PieIcon size={14} className="text-[color:var(--nfq-warning)]" />
            Product Volume Breakdown
          </h4>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={productVolume}
                  dataKey="volume"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={40}
                  paddingAngle={2}
                  label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                  labelLine={{ stroke: '#475569' }}
                >
                  {productVolume.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} fillOpacity={0.85} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => typeof value === 'number' ? fmtM(value) : `${value ?? '-'}`} />
                <Legend wrapperStyle={{ fontSize: '10px' }} formatter={(value) => <span className="text-slate-400">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Legend with amounts */}
        <div className="nfq-kpi-card">
          <h4 className="nfq-kpi-label mb-4 flex items-center gap-2">
            <Activity size={14} className="text-[color:var(--nfq-accent-secondary)]" />
            Product Details
          </h4>
          <div className="space-y-3">
            {productVolume.map((pv, idx) => (
              <div key={pv.name} className="flex items-center justify-between py-2 last:border-0" style={{ borderBottom: 'none' }}>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="text-xs text-[color:var(--nfq-text-secondary)] font-medium">{pv.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-mono text-[color:var(--nfq-text-muted)]">{pv.count} deals</span>
                  <span className="text-xs font-mono font-bold text-[color:var(--nfq-text-primary)]">{fmtM(pv.volume)}</span>
                </div>
              </div>
            ))}
            {productVolume.length === 0 && (
              <div className="text-xs text-[color:var(--nfq-text-faint)] text-center py-4">No product data</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 5: BU Performance Table ── */}
      <div className="nfq-kpi-card">
        <h4 className="nfq-kpi-label mb-4 flex items-center gap-2">
          <BarChart4 size={14} className="text-[color:var(--nfq-accent)]" />
          Business Unit Performance
        </h4>
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 text-left font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">BU Name</th>
                <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 text-right font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Deal Count</th>
                <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 text-right font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Avg FTP</th>
                <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 text-right font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Avg RAROC</th>
                <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 text-right font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Total Volume</th>
                <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 text-right font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Avg Margin</th>
              </tr>
            </thead>
            <tbody>
              {buPerformance.map(bu => (
                <tr key={bu.buName} className="transition-colors even:bg-[var(--nfq-bg-surface)] odd:bg-[var(--nfq-bg-root)] hover:bg-[var(--nfq-bg-elevated)]">
                  <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 font-medium text-[color:var(--nfq-text-secondary)]">{bu.buName}</td>
                  <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono text-[color:var(--nfq-text-tertiary)] [font-variant-numeric:tabular-nums]">{bu.dealCount}</td>
                  <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono text-[var(--nfq-accent)] [font-variant-numeric:tabular-nums]">{bu.avgFtp.toFixed(2)}%</td>
                  <td className={`border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono [font-variant-numeric:tabular-nums] ${bu.avgRaroc >= 10 ? 'text-[var(--nfq-success)]' : bu.avgRaroc >= 5 ? 'text-[var(--nfq-warning)]' : 'text-[var(--nfq-danger)]'}`}>
                    {bu.avgRaroc.toFixed(1)}%
                  </td>
                  <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono font-bold text-[color:var(--nfq-text-primary)] [font-variant-numeric:tabular-nums]">{fmtM(bu.totalVolume)}</td>
                  <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono text-[color:var(--nfq-text-tertiary)] [font-variant-numeric:tabular-nums]">{bu.avgMargin.toFixed(2)}%</td>
                </tr>
              ))}
              {buPerformance.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-[color:var(--nfq-text-muted)]">No data available</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PricingAnalytics;
