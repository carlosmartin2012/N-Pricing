import React, { useMemo } from 'react';
import { Activity, Droplets, Shield, ShieldCheck } from 'lucide-react';
import { useEntity } from '../../contexts/EntityContext';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  LcrHistoryPoint,
  PortfolioBusinessUnitSummary,
  ScenarioMetrics,
} from './reportingTypes';

interface Props {
  metrics: ScenarioMetrics;
  lcrHistory: LcrHistoryPoint[];
  portfolioByBU: PortfolioBusinessUnitSummary[];
}

const OverviewDashboard: React.FC<Props> = ({
  metrics,
  lcrHistory,
  portfolioByBU,
}) => {
  const { activeEntity, isGroupScope } = useEntity();
  const maxVolume = useMemo(
    () => Math.max(0, ...portfolioByBU.map(item => item.volume)),
    [portfolioByBU],
  );

  return (
    <>
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
