import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Transaction, ProductDefinition, BusinessUnit, ClientEntity } from '../../types';
import { calculatePricing } from '../../utils/pricingEngine';
import { buildPricingContext } from '../../utils/pricingContext';
import { useData } from '../../contexts/DataContext';
import { Calendar, TrendingDown, AlertTriangle } from 'lucide-react';

interface Props {
  deals: Transaction[];
  products: ProductDefinition[];
  businessUnits: BusinessUnit[];
  clients: ClientEntity[];
}

type SortField =
  | 'cohort'
  | 'dealCount'
  | 'totalVolume'
  | 'avgTechnicalPrice'
  | 'avgFinalRate'
  | 'avgMargin'
  | 'avgRaroc'
  | 'belowFloor';

type SortDir = 'asc' | 'desc';

interface VintageCohort {
  cohort: string;
  dealCount: number;
  totalVolume: number;
  avgTechnicalPrice: number;
  avgFinalRate: number;
  avgMargin: number;
  avgRaroc: number;
  belowFloor: number;
  // Margin components for stacked chart
  avgFTP: number;
  avgCreditCost: number;
  avgCapitalCharge: number;
  avgOpex: number;
  avgMarginBps: number;
}

interface SegmentBreakdown {
  segment: string;
  dealCount: number;
  totalVolume: number;
  avgMargin: number;
  avgRaroc: number;
  belowFloorPct: number;
}

const COMPONENT_COLORS = {
  ftp: '#06b6d4',
  creditCost: '#f43f5e',
  capitalCharge: '#e879f9',
  opex: '#8b5cf6',
  margin: '#22c55e',
};

const tooltipStyle: React.CSSProperties = {
  backgroundColor: 'var(--nfq-bg-elevated)',
  border: '1px solid var(--nfq-border-ghost)',
  borderRadius: 'var(--nfq-radius-lg)',
  padding: '8px 12px',
  fontFamily: 'var(--nfq-font-mono)',
  fontSize: '12px',
};

function formatMonth(dateStr: string): string {
  if (!dateStr) return 'Unknown';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Unknown';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatVolume(v: number): string {
  if (Math.abs(v) >= 1e9) return `\u20AC${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `\u20AC${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `\u20AC${(v / 1e3).toFixed(0)}K`;
  return `\u20AC${v.toFixed(0)}`;
}

const VintageAnalysis: React.FC<Props> = ({ deals, products, businessUnits, clients }) => {
  const contextData = useData();
  const [sortField, setSortField] = useState<SortField>('cohort');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

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
        { clients, products, businessUnits },
      ),
    [
      contextData.yieldCurves,
      contextData.liquidityCurves,
      contextData.rules,
      contextData.ftpRateCards,
      contextData.transitionGrid,
      contextData.physicalGrid,
      contextData.behaviouralModels,
      clients,
      products,
      businessUnits,
    ],
  );

  const bookedDeals = useMemo(
    () => deals.filter(d => (d.status === 'Booked' || d.status === 'Approved') && d.amount > 0 && d.productType),
    [deals],
  );

  // Pricing results per deal
  const pricingResults = useMemo(
    () =>
      bookedDeals.map(deal => ({
        deal,
        result: calculatePricing(deal, contextData.approvalMatrix, pricingContext),
      })),
    [bookedDeals, contextData.approvalMatrix, pricingContext],
  );

  // 1. Vintage cohorts grouped by startDate month
  const vintageCohorts = useMemo<VintageCohort[]>(() => {
    const groups = new Map<string, typeof pricingResults>();

    for (const pr of pricingResults) {
      const cohort = formatMonth(pr.deal.startDate);
      const existing = groups.get(cohort);
      if (existing) {
        existing.push(pr);
      } else {
        groups.set(cohort, [pr]);
      }
    }

    const cohorts: VintageCohort[] = [];

    for (const [cohort, items] of groups) {
      const totalVolume = items.reduce((s, p) => s + p.deal.amount, 0);
      const n = items.length;

      let wTechnicalPrice = 0;
      let wFinalRate = 0;
      let wMargin = 0;
      let wRaroc = 0;
      let wFTP = 0;
      let wCreditCost = 0;
      let wCapitalCharge = 0;
      let wOpex = 0;
      let belowFloor = 0;

      for (const { deal, result } of items) {
        const w = totalVolume > 0 ? deal.amount / totalVolume : 1 / n;
        wTechnicalPrice += result.technicalPrice * w;
        wFinalRate += result.finalClientRate * w;
        wMargin += (result.finalClientRate - result.totalFTP) * w;
        wRaroc += result.raroc * w;
        wFTP += result.totalFTP * w;
        wCreditCost += result.regulatoryCost * w;
        wCapitalCharge += result.capitalCharge * w;
        wOpex += result.operationalCost * w;

        if (result.finalClientRate < result.floorPrice) {
          belowFloor++;
        }
      }

      cohorts.push({
        cohort,
        dealCount: n,
        totalVolume,
        avgTechnicalPrice: wTechnicalPrice,
        avgFinalRate: wFinalRate,
        avgMargin: wMargin,
        avgRaroc: wRaroc,
        belowFloor,
        avgFTP: wFTP,
        avgCreditCost: wCreditCost,
        avgCapitalCharge: wCapitalCharge,
        avgOpex: wOpex,
        avgMarginBps: wMargin * 10000,
      });
    }

    return cohorts;
  }, [pricingResults]);

  // Sorted cohorts
  const sortedCohorts = useMemo(() => {
    const sorted = [...vintageCohorts];
    sorted.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const na = typeof aVal === 'number' ? aVal : 0;
      const nb = typeof bVal === 'number' ? bVal : 0;
      return sortDir === 'asc' ? na - nb : nb - na;
    });
    return sorted;
  }, [vintageCohorts, sortField, sortDir]);

  // Chart data for combo chart (bps scale)
  const chartData = useMemo(
    () =>
      [...vintageCohorts]
        .sort((a, b) => a.cohort.localeCompare(b.cohort))
        .map(c => ({
          cohort: c.cohort,
          ftp: Number((c.avgFTP * 100).toFixed(2)),
          creditCost: Number((c.avgCreditCost * 100).toFixed(2)),
          capitalCharge: Number((c.avgCapitalCharge * 100).toFixed(2)),
          opex: Number((c.avgOpex * 100).toFixed(2)),
          margin: Number((c.avgMargin * 100).toFixed(2)),
          raroc: Number(c.avgRaroc.toFixed(2)),
        })),
    [vintageCohorts],
  );

  // 3. Channel / Segment breakdown by clientType
  const segmentBreakdown = useMemo<SegmentBreakdown[]>(() => {
    const groups = new Map<string, typeof pricingResults>();

    for (const pr of pricingResults) {
      const seg = pr.deal.clientType || 'Unknown';
      const existing = groups.get(seg);
      if (existing) {
        existing.push(pr);
      } else {
        groups.set(seg, [pr]);
      }
    }

    const segments: SegmentBreakdown[] = [];

    for (const [segment, items] of groups) {
      const totalVolume = items.reduce((s, p) => s + p.deal.amount, 0);
      const n = items.length;

      let wMargin = 0;
      let wRaroc = 0;
      let belowFloor = 0;

      for (const { deal, result } of items) {
        const w = totalVolume > 0 ? deal.amount / totalVolume : 1 / n;
        wMargin += (result.finalClientRate - result.totalFTP) * w;
        wRaroc += result.raroc * w;
        if (result.finalClientRate < result.floorPrice) belowFloor++;
      }

      segments.push({
        segment,
        dealCount: n,
        totalVolume,
        avgMargin: wMargin,
        avgRaroc: wRaroc,
        belowFloorPct: n > 0 ? (belowFloor / n) * 100 : 0,
      });
    }

    return segments.sort((a, b) => a.avgRaroc - b.avgRaroc);
  }, [pricingResults]);

  // BU breakdown
  const buBreakdown = useMemo<SegmentBreakdown[]>(() => {
    const groups = new Map<string, typeof pricingResults>();

    for (const pr of pricingResults) {
      const bu = pr.deal.businessUnit || 'Unknown';
      const buName = businessUnits.find(b => b.id === bu)?.name || bu;
      const existing = groups.get(buName);
      if (existing) {
        existing.push(pr);
      } else {
        groups.set(buName, [pr]);
      }
    }

    const segments: SegmentBreakdown[] = [];

    for (const [segment, items] of groups) {
      const totalVolume = items.reduce((s, p) => s + p.deal.amount, 0);
      const n = items.length;

      let wMargin = 0;
      let wRaroc = 0;
      let belowFloor = 0;

      for (const { deal, result } of items) {
        const w = totalVolume > 0 ? deal.amount / totalVolume : 1 / n;
        wMargin += (result.finalClientRate - result.totalFTP) * w;
        wRaroc += result.raroc * w;
        if (result.finalClientRate < result.floorPrice) belowFloor++;
      }

      segments.push({
        segment,
        dealCount: n,
        totalVolume,
        avgMargin: wMargin,
        avgRaroc: wRaroc,
        belowFloorPct: n > 0 ? (belowFloor / n) * 100 : 0,
      });
    }

    return segments.sort((a, b) => a.avgRaroc - b.avgRaroc);
  }, [pricingResults, businessUnits]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortIndicator = (field: SortField) =>
    sortField === field ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';

  if (pricingResults.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Calendar className="w-12 h-12 text-[color:var(--nfq-text-faint)] mb-4" />
        <h3 className="text-sm font-bold text-[color:var(--nfq-text-secondary)] mb-2">No Vintage Data</h3>
        <p className="text-xs text-[color:var(--nfq-text-muted)]">
          Book or approve deals to see vintage analysis by origination cohort.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Calendar className="w-5 h-5 text-purple-400" />
        <h2 className="text-sm font-bold tracking-tight text-white uppercase font-mono">
          Vintage Analysis
        </h2>
        <span className="nfq-label ml-2">
          {vintageCohorts.length} cohorts / {pricingResults.length} deals
        </span>
      </div>

      {/* 1. Vintage Table */}
      <div className="nfq-kpi-card overflow-x-auto">
        <h4 className="nfq-kpi-label mb-4">Origination Cohorts</h4>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--nfq-border-ghost)]">
              {[
                { field: 'cohort' as SortField, label: 'Cohort' },
                { field: 'dealCount' as SortField, label: '# Deals' },
                { field: 'totalVolume' as SortField, label: 'Volume' },
                { field: 'avgTechnicalPrice' as SortField, label: 'Avg Tech Price' },
                { field: 'avgFinalRate' as SortField, label: 'Avg Final Rate' },
                { field: 'avgMargin' as SortField, label: 'Avg Margin' },
                { field: 'avgRaroc' as SortField, label: 'Avg RAROC' },
                { field: 'belowFloor' as SortField, label: 'Below Floor' },
              ].map(col => (
                <th
                  key={col.field}
                  onClick={() => handleSort(col.field)}
                  className="py-2 px-3 text-left font-mono uppercase tracking-[0.16em] text-[color:var(--nfq-text-muted)] cursor-pointer hover:text-white transition-colors whitespace-nowrap"
                >
                  {col.label}{sortIndicator(col.field)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedCohorts.map(c => {
              const rarocClass =
                c.avgRaroc < 5
                  ? 'bg-[#f43f5e]/10'
                  : c.avgRaroc < 10
                    ? 'bg-[#f59e0b]/10'
                    : '';

              return (
                <tr key={c.cohort} className={`border-b border-[var(--nfq-border-ghost)]/50 hover:bg-white/[0.02] transition-colors ${rarocClass}`}>
                  <td className="py-2.5 px-3 font-mono font-bold text-[color:var(--nfq-text-primary)]">
                    {c.cohort}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-right text-[color:var(--nfq-text-secondary)]">
                    {c.dealCount}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-right text-[color:var(--nfq-text-secondary)]">
                    {formatVolume(c.totalVolume)}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-right text-[color:var(--nfq-accent)]">
                    {(c.avgTechnicalPrice * 100).toFixed(2)}%
                  </td>
                  <td className="py-2.5 px-3 font-mono text-right text-[color:var(--nfq-text-primary)]">
                    {(c.avgFinalRate * 100).toFixed(2)}%
                  </td>
                  <td className="py-2.5 px-3 font-mono text-right text-[color:var(--nfq-success)]">
                    {(c.avgMargin * 10000).toFixed(0)} bps
                  </td>
                  <td className={`py-2.5 px-3 font-mono text-right font-bold ${
                    c.avgRaroc < 5
                      ? 'text-[color:var(--nfq-danger)]'
                      : c.avgRaroc < 10
                        ? 'text-[color:var(--nfq-warning)]'
                        : 'text-[color:var(--nfq-success)]'
                  }`}>
                    {c.avgRaroc.toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-3 font-mono text-right">
                    {c.belowFloor > 0 ? (
                      <span className="text-[color:var(--nfq-danger)] flex items-center justify-end gap-1">
                        <AlertTriangle className="w-3 h-3" /> {c.belowFloor}
                      </span>
                    ) : (
                      <span className="text-[color:var(--nfq-text-faint)]">0</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 2. Vintage Combo Chart */}
      <div className="nfq-kpi-card">
        <h4 className="nfq-kpi-label mb-6">Margin Decomposition by Cohort</h4>
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} barCategoryGap="15%">
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
              <XAxis
                dataKey="cohort"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'var(--nfq-font-mono)' }}
              />
              <YAxis
                yAxisId="left"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#475569', fontSize: 10, fontFamily: 'var(--nfq-font-mono)' }}
                tickFormatter={(v: number) => `${v}%`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#a78bfa', fontSize: 10, fontFamily: 'var(--nfq-font-mono)' }}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend
                wrapperStyle={{ fontSize: '10px', fontFamily: 'var(--nfq-font-mono)' }}
              />
              <Bar yAxisId="left" dataKey="ftp" stackId="components" name="FTP" fill={COMPONENT_COLORS.ftp} />
              <Bar yAxisId="left" dataKey="creditCost" stackId="components" name="Credit Cost" fill={COMPONENT_COLORS.creditCost} />
              <Bar yAxisId="left" dataKey="capitalCharge" stackId="components" name="Capital Charge" fill={COMPONENT_COLORS.capitalCharge} />
              <Bar yAxisId="left" dataKey="opex" stackId="components" name="Opex" fill={COMPONENT_COLORS.opex} />
              <Bar yAxisId="left" dataKey="margin" stackId="components" name="Margin" fill={COMPONENT_COLORS.margin} radius={[3, 3, 0, 0]} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="raroc"
                name="RAROC"
                stroke="#a78bfa"
                strokeWidth={2}
                dot={{ fill: '#a78bfa', r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Channel / Segment Breakdown */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* By Client Type */}
        <div className="nfq-kpi-card">
          <h4 className="nfq-kpi-label mb-4 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-[color:var(--nfq-warning)]" />
            By Client Segment
          </h4>
          {segmentBreakdown.length > 0 ? (
            <div className="space-y-3">
              {segmentBreakdown.map(seg => (
                <div key={seg.segment} className="flex items-center justify-between gap-4 py-2 border-b border-[var(--nfq-border-ghost)]/50">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-[color:var(--nfq-text-secondary)] truncate">{seg.segment}</div>
                    <div className="text-[10px] font-mono text-[color:var(--nfq-text-faint)]">
                      {seg.dealCount} deals / {formatVolume(seg.totalVolume)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-xs font-mono font-bold ${
                      seg.avgRaroc < 5 ? 'text-[color:var(--nfq-danger)]' :
                      seg.avgRaroc < 10 ? 'text-[color:var(--nfq-warning)]' :
                      'text-[color:var(--nfq-success)]'
                    }`}>
                      RAROC {seg.avgRaroc.toFixed(1)}%
                    </div>
                    <div className="text-[10px] font-mono text-[color:var(--nfq-text-muted)]">
                      Margin: {(seg.avgMargin * 10000).toFixed(0)} bps
                    </div>
                  </div>
                  {seg.belowFloorPct > 20 && (
                    <div className="text-[9px] font-mono text-[color:var(--nfq-danger)] bg-[#f43f5e]/10 px-2 py-0.5 rounded shrink-0">
                      {seg.belowFloorPct.toFixed(0)}% below floor
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-[color:var(--nfq-text-faint)]">No segment data</div>
          )}
        </div>

        {/* By Business Unit */}
        <div className="nfq-kpi-card">
          <h4 className="nfq-kpi-label mb-4 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-[color:var(--nfq-warning)]" />
            By Business Unit
          </h4>
          {buBreakdown.length > 0 ? (
            <div className="space-y-3">
              {buBreakdown.map(seg => (
                <div key={seg.segment} className="flex items-center justify-between gap-4 py-2 border-b border-[var(--nfq-border-ghost)]/50">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-[color:var(--nfq-text-secondary)] truncate">{seg.segment}</div>
                    <div className="text-[10px] font-mono text-[color:var(--nfq-text-faint)]">
                      {seg.dealCount} deals / {formatVolume(seg.totalVolume)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-xs font-mono font-bold ${
                      seg.avgRaroc < 5 ? 'text-[color:var(--nfq-danger)]' :
                      seg.avgRaroc < 10 ? 'text-[color:var(--nfq-warning)]' :
                      'text-[color:var(--nfq-success)]'
                    }`}>
                      RAROC {seg.avgRaroc.toFixed(1)}%
                    </div>
                    <div className="text-[10px] font-mono text-[color:var(--nfq-text-muted)]">
                      Margin: {(seg.avgMargin * 10000).toFixed(0)} bps
                    </div>
                  </div>
                  {seg.belowFloorPct > 20 && (
                    <div className="text-[9px] font-mono text-[color:var(--nfq-danger)] bg-[#f43f5e]/10 px-2 py-0.5 rounded shrink-0">
                      {seg.belowFloorPct.toFixed(0)}% below floor
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-[color:var(--nfq-text-faint)]">No business unit data</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VintageAnalysis;
