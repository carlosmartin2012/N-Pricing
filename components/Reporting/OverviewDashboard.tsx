import React, { useMemo } from 'react';
import { Activity, BarChart4, Droplets, Shield, ShieldCheck } from 'lucide-react';
import { useEntity } from '../../contexts/EntityContext';
import { useData } from '../../contexts/DataContext';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from '../ui/charts/lazyRecharts';
import type { Transaction, ProductDefinition, BusinessUnit, ClientEntity } from '../../types';
import { calculatePricing } from '../../utils/pricingEngine';
import { buildPricingContext } from '../../utils/pricingContext';
import type {
  LcrHistoryPoint,
  PortfolioBusinessUnitSummary,
  ScenarioMetrics,
} from './reportingTypes';

interface Props {
  metrics: ScenarioMetrics;
  lcrHistory: LcrHistoryPoint[];
  portfolioByBU: PortfolioBusinessUnitSummary[];
  deals?: Transaction[];
  products?: ProductDefinition[];
  businessUnits?: BusinessUnit[];
  clients?: ClientEntity[];
}

const WATERFALL_COLORS: Record<string, string> = {
  baseRate: '#06b6d4',        // cyan
  liquidityPremium: '#f59e0b', // amber
  strategicSpread: '#3b82f6',  // blue
  creditCost: '#f43f5e',       // rose
  capitalCharge: '#e879f9',    // pink
  esgCharges: '#10b981',       // emerald
  operationalCost: '#8b5cf6',  // violet
  margin: '#22c55e',           // green
};

const tooltipStyleWaterfall: React.CSSProperties = {
  backgroundColor: 'var(--nfq-bg-elevated)',
  border: '1px solid var(--nfq-border-ghost)',
  borderRadius: 'var(--nfq-radius-lg)',
  padding: '8px 12px',
  fontFamily: 'var(--nfq-font-mono)',
  fontSize: '12px',
};

const OverviewDashboard: React.FC<Props> = ({
  metrics,
  lcrHistory,
  portfolioByBU,
  deals = [],
  products = [],
  businessUnits = [],
  clients = [],
}) => {
  const { activeEntity, isGroupScope } = useEntity();
  const contextData = useData();

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
          greeniumGrid: contextData.greeniumGrid,
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
      contextData.greeniumGrid,
      contextData.behaviouralModels,
      clients,
      products,
      businessUnits,
    ],
  );

  // Compute weighted-average FTP waterfall across portfolio
  const waterfallData = useMemo(() => {
    const bookedDeals = deals.filter(
      d => (d.status === 'Booked' || d.status === 'Approved') && d.amount > 0 && d.productType,
    );

    if (bookedDeals.length === 0) return null;

    const totalVolume = bookedDeals.reduce((s, d) => s + d.amount, 0);
    if (totalVolume === 0) return null;

    let wBaseRate = 0;
    let wLiquidityPremium = 0;
    let wStrategicSpread = 0;
    let wCreditCost = 0;
    let wCapitalCharge = 0;
    let wEsgCharges = 0;
    let wOperationalCost = 0;
    let wTotalFTP = 0;
    let wFinalRate = 0;

    for (const deal of bookedDeals) {
      const result = calculatePricing(deal, contextData.approvalMatrix, pricingContext);
      const w = deal.amount / totalVolume;
      wBaseRate += result.baseRate * w;
      wLiquidityPremium += result.liquiditySpread * w;
      wStrategicSpread += result.strategicSpread * w;
      wCreditCost += result.regulatoryCost * w;
      wCapitalCharge += result.capitalCharge * w;
      wEsgCharges += (result.esgTransitionCharge + result.esgPhysicalCharge + (result.esgGreeniumAdj || 0)) * w;
      wOperationalCost += result.operationalCost * w;
      wTotalFTP += result.totalFTP * w;
      wFinalRate += result.finalClientRate * w;
    }

    const wMargin = wFinalRate - wTotalFTP;

    const components = [
      { name: 'Base Rate', value: wBaseRate, color: WATERFALL_COLORS.baseRate },
      { name: 'Liquidity Premium', value: wLiquidityPremium, color: WATERFALL_COLORS.liquidityPremium },
      { name: 'Strategic Spread', value: wStrategicSpread, color: WATERFALL_COLORS.strategicSpread },
      { name: 'Credit Cost', value: wCreditCost, color: WATERFALL_COLORS.creditCost },
      { name: 'Capital Charge', value: wCapitalCharge, color: WATERFALL_COLORS.capitalCharge },
      { name: 'ESG Charges', value: wEsgCharges, color: WATERFALL_COLORS.esgCharges },
      { name: 'Operational Cost', value: wOperationalCost, color: WATERFALL_COLORS.operationalCost },
      { name: 'Margin', value: wMargin, color: WATERFALL_COLORS.margin },
    ];

    // Build waterfall chart data.
    // For Recharts stacked bars, negative components need special treatment:
    // the invisible base bar must start at the lower endpoint so the visible
    // bar always rises upward (Recharts cannot render downward-going stacked bars).
    let cumulative = 0;
    const chartData = components.map(c => {
      const before = cumulative;
      cumulative += c.value;
      const after = cumulative;
      const isNegative = c.value < 0;
      return {
        name: c.name,
        // base = lower of the two endpoints so the visible bar always goes up
        base: Number(((isNegative ? after : before) * 100).toFixed(2)),
        value: Number((Math.abs(c.value) * 100).toFixed(2)),
        rawValue: Number((c.value * 100).toFixed(2)),
        color: isNegative ? '#f43f5e' : c.color,
        isNegative,
      };
    });

    return {
      chartData,
      avgFTP: wTotalFTP,
      avgRate: wFinalRate,
      avgMargin: wMargin,
      totalVolume,
      dealCount: bookedDeals.length,
    };
  }, [deals, contextData.approvalMatrix, pricingContext]);

  const maxVolume = useMemo(
    () => Math.max(0, ...portfolioByBU.map(item => item.volume)),
    [portfolioByBU],
  );

  if (deals.length === 0) {
    return (
      <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 rounded-[24px] bg-[var(--nfq-bg-surface)] px-8 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--nfq-bg-elevated)]">
          <BarChart4 size={28} className="text-[var(--nfq-text-muted)] opacity-60" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-[var(--nfq-text-primary)]">No portfolio data</h3>
          <p className="mt-1.5 max-w-sm text-sm text-[var(--nfq-text-muted)]">
            Book deals in the Deal Blotter to see portfolio analytics and FTP breakdowns.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* FTP Waterfall (Portfolio Weighted Average) */}
      {waterfallData && (
        <div className="space-y-6 mb-8">
          <div className="nfq-kpi-card">
            <h4 className="nfq-kpi-label mb-6">FTP Waterfall — Portfolio Weighted Average</h4>

            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="rounded-[var(--nfq-radius-lg)] bg-[var(--nfq-bg-elevated)] p-4">
                <div className="nfq-label mb-1">Portfolio Avg FTP</div>
                <div className="text-lg font-mono font-bold text-[color:var(--nfq-accent)]">
                  {(waterfallData.avgFTP * 100).toFixed(3)}%
                </div>
              </div>
              <div className="rounded-[var(--nfq-radius-lg)] bg-[var(--nfq-bg-elevated)] p-4">
                <div className="nfq-label mb-1">Portfolio Avg Rate</div>
                <div className="text-lg font-mono font-bold text-[color:var(--nfq-text-primary)]">
                  {(waterfallData.avgRate * 100).toFixed(3)}%
                </div>
              </div>
              <div className="rounded-[var(--nfq-radius-lg)] bg-[var(--nfq-bg-elevated)] p-4">
                <div className="nfq-label mb-1">Portfolio Avg Margin</div>
                <div className="text-lg font-mono font-bold text-[color:var(--nfq-success)]">
                  {(waterfallData.avgMargin * 10000).toFixed(0)} bps
                </div>
              </div>
              <div className="rounded-[var(--nfq-radius-lg)] bg-[var(--nfq-bg-elevated)] p-4">
                <div className="nfq-label mb-1">Total Volume</div>
                <div className="text-lg font-mono font-bold text-[color:var(--nfq-text-primary)]">
                  {waterfallData.totalVolume >= 1e9
                    ? `\u20AC${(waterfallData.totalVolume / 1e9).toFixed(1)}B`
                    : `\u20AC${(waterfallData.totalVolume / 1e6).toFixed(0)}M`}
                </div>
                <div className="text-[10px] font-mono text-[color:var(--nfq-text-faint)] mt-1">
                  {waterfallData.dealCount} deals
                </div>
              </div>
            </div>

            {/* Waterfall Chart */}
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={waterfallData.chartData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'var(--nfq-font-mono)' }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#475569', fontSize: 10, fontFamily: 'var(--nfq-font-mono)' }}
                    tickFormatter={(v: number) => `${v} bps`}
                  />
                  <Tooltip
                    contentStyle={tooltipStyleWaterfall}
                    formatter={(value, name, props) => {
                      if (name === 'base') return null;
                      const raw = props.payload?.rawValue ?? value;
                      return [`${typeof raw === 'number' ? raw.toFixed(2) : raw} bps`];
                    }}
                  />
                  {/* Invisible base bar for waterfall stacking */}
                  <Bar dataKey="base" stackId="waterfall" fill="transparent" />
                  <Bar dataKey="value" stackId="waterfall" radius={[3, 3, 0, 0]}>
                    {waterfallData.chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-4 justify-center">
              {waterfallData.chartData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-1.5">
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-[10px] font-mono text-[color:var(--nfq-text-muted)]">
                    {entry.name}: {entry.rawValue >= 0 ? '+' : ''}{entry.rawValue.toFixed(1)} bps
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4 xl:grid-cols-5">
        <div className="group relative overflow-hidden nfq-kpi-card">
          <div className="absolute right-0 top-0 p-3 opacity-10 transition-opacity group-hover:opacity-20">
            <ShieldCheck size={48} className="text-[color:var(--nfq-accent)]" />
          </div>
          <div className="nfq-kpi-label mb-2">LCR Ratio</div>
          <div className="flex items-baseline gap-2">
            <div className="nfq-kpi-value">{metrics.lcr.toFixed(1)}%</div>
            <div className={`text-[10px] font-mono font-bold uppercase tracking-[0.18em] ${metrics.lcr > 100 ? 'text-[color:var(--nfq-success)]' : 'text-[color:var(--nfq-danger)]'}`}>
              {metrics.lcr > 100 ? '+SAFE' : '-RISK'}
            </div>
          </div>
          <div className="mt-2 nfq-label">Target: {'>'}100%</div>
        </div>

        <div className="group relative overflow-hidden nfq-kpi-card">
          <div className="absolute right-0 top-0 p-3 opacity-10 transition-opacity group-hover:opacity-20">
            <Activity size={48} className="text-[color:var(--nfq-warning)]" />
          </div>
          <div className="nfq-kpi-label mb-2">NSFR Ratio</div>
          <div className="flex items-baseline gap-2">
            <div className="nfq-kpi-value">{metrics.nsfr.toFixed(1)}%</div>
            <div className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-[color:var(--nfq-success)]">OK</div>
          </div>
          <div className="mt-2 nfq-label">Target: {'>'}100%</div>
        </div>

        <div className="group relative overflow-hidden nfq-kpi-card">
          <div className="absolute right-0 top-0 p-3 opacity-10 transition-opacity group-hover:opacity-20">
            <Droplets size={48} className="text-[color:var(--nfq-accent-secondary)]" />
          </div>
          <div className="nfq-kpi-label mb-2">Liquidity Premium</div>
          <div className="flex items-baseline gap-2">
            <div className="nfq-kpi-value">{metrics.lpValue.toFixed(1)}</div>
            <span className="text-xs font-bold font-mono text-[color:var(--nfq-accent-secondary)]">bps</span>
          </div>
          <div className="mt-2 nfq-label">Curve-Derived</div>
        </div>

        <div className="group relative overflow-hidden nfq-kpi-card">
          <div className="absolute right-0 top-0 p-3 opacity-10 transition-opacity group-hover:opacity-20">
            <Shield size={48} className="text-[color:var(--nfq-success)]" />
          </div>
          <div className="nfq-kpi-label mb-2">CLC Index</div>
          <div className="flex items-baseline gap-2">
            <div className="nfq-kpi-value">{metrics.clc.toFixed(1)}%</div>
            <div className="text-[10px] font-mono font-bold text-[color:var(--nfq-text-muted)]">WLP: {metrics.wlp.toFixed(0)}</div>
          </div>
          <div className="mt-2 nfq-label">Cash Coverage</div>
        </div>

        <div className="group relative overflow-hidden nfq-kpi-card">
          <div className="nfq-kpi-label mb-2">Entity Scope</div>
          <div className="nfq-kpi-value text-base">
            {isGroupScope ? 'Group' : (activeEntity?.shortCode ?? '—')}
          </div>
          <div className="mt-2 nfq-label">
            {isGroupScope ? 'Consolidated view' : (activeEntity?.name ?? 'Single entity')}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="nfq-kpi-card">
          <h4 className="nfq-kpi-label mb-6">LCR Stress Simulation</h4>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={lcrHistory}>
                <defs>
                  <linearGradient id="colorLcr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 9 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#475569', fontSize: 9 }}
                  domain={['dataMin - 5', 'dataMax + 5']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--nfq-bg-elevated)',
                    border: '1px solid var(--nfq-border-ghost)',
                    borderRadius: 'var(--nfq-radius-lg)',
                    padding: '8px 12px',
                    fontFamily: 'var(--nfq-font-mono)',
                    fontSize: '12px',
                  }}
                />
                <Area type="monotone" dataKey="lcr" stroke="#06b6d4" strokeWidth={2} fill="url(#colorLcr)" />
                <Area type="monotone" dataKey="simulated" stroke="#f43f5e" strokeWidth={2} strokeDasharray="5 5" fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="nfq-kpi-card">
          <h4 className="nfq-kpi-label mb-4">Portfolio by Business Unit</h4>
          <div className="space-y-3">
            {portfolioByBU.length > 0 ? (
              portfolioByBU.map(item => {
                const pct = maxVolume > 0 ? (item.volume / maxVolume) * 100 : 0;

                return (
                  <div key={item.bu} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-[color:var(--nfq-text-secondary)]">{item.buName}</span>
                      <span className="font-mono text-[color:var(--nfq-text-muted)]">
                        ${(item.volume / 1e6).toFixed(1)}M ({item.count} deals)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--nfq-bg-elevated)]">
                      <div className="h-full rounded-full bg-[var(--nfq-accent-secondary)]" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-[10px] font-mono text-[color:var(--nfq-text-faint)]">
                      Avg margin: {item.avgMargin.toFixed(2)}%
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-xs text-[color:var(--nfq-text-faint)]">No booked deals in portfolio</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default OverviewDashboard;
