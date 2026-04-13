import React from 'react';
import { User, Mail, TrendingUp, TrendingDown } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  YAxis,
  Tooltip,
} from 'recharts';
import type { OriginatorScorecard as OriginatorScorecardType } from '../../types';

interface Props {
  scorecard: OriginatorScorecardType | null;
  isLoading: boolean;
}

function fmtEur(value: number): string {
  if (Math.abs(value) >= 1e6) return `EUR ${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `EUR ${(value / 1e3).toFixed(1)}K`;
  return `EUR ${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function fmtBps(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)} bps`;
}

const OriginatorScorecardComponent: React.FC<Props> = ({ scorecard, isLoading }) => {
  if (isLoading) {
    return (
      <div className="nfq-kpi-card animate-pulse">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[var(--nfq-bg-elevated)]" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-32 rounded bg-[var(--nfq-bg-elevated)]" />
            <div className="h-3 w-48 rounded bg-[var(--nfq-bg-elevated)]" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-16 rounded bg-[var(--nfq-bg-elevated)]" />
              <div className="h-6 w-20 rounded bg-[var(--nfq-bg-elevated)]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!scorecard) {
    return (
      <div className="nfq-kpi-card">
        <div className="flex items-center justify-center py-8 text-xs text-[color:var(--nfq-text-muted)]">
          Select an originator to view scorecard
        </div>
      </div>
    );
  }

  const trendData = scorecard.trend.map((t) => ({
    period: t.period,
    inBandPct: t.inBandPct,
    leakageEur: t.leakageEur,
  }));

  const latestTrend = trendData.length >= 2
    ? trendData[trendData.length - 1].inBandPct - trendData[trendData.length - 2].inBandPct
    : 0;

  return (
    <div className="nfq-kpi-card">
      {/* Header: originator info */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-950/40">
          <User size={18} className="text-cyan-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-[color:var(--nfq-text-primary)]">
            {scorecard.originatorName}
          </h3>
          <div className="flex items-center gap-1 text-[10px] text-[color:var(--nfq-text-muted)]">
            <Mail size={10} />
            <span className="truncate">{scorecard.originatorEmail}</span>
          </div>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="mb-5 grid grid-cols-3 gap-4">
        <div>
          <div className="nfq-kpi-label mb-1">Total Deals</div>
          <div className="nfq-kpi-value text-lg text-cyan-400">{scorecard.totalDeals}</div>
        </div>
        <div>
          <div className="nfq-kpi-label mb-1">In-Band %</div>
          <div className="flex items-baseline gap-1.5">
            <span className={`nfq-kpi-value text-lg ${scorecard.inBandPct >= 90 ? 'text-emerald-400' : scorecard.inBandPct >= 75 ? 'text-amber-400' : 'text-rose-400'}`}>
              {fmtPct(scorecard.inBandPct)}
            </span>
            {latestTrend !== 0 && (
              <span className={`flex items-center text-[10px] font-mono ${latestTrend > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {latestTrend > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {Math.abs(latestTrend).toFixed(1)}pp
              </span>
            )}
          </div>
        </div>
        <div>
          <div className="nfq-kpi-label mb-1">Leakage</div>
          <div className={`nfq-kpi-value text-lg ${scorecard.totalLeakageEur > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {fmtEur(scorecard.totalLeakageEur)}
          </div>
        </div>
      </div>

      {/* Additional metrics */}
      <div className="mb-4 flex gap-6 text-[10px] font-mono text-[color:var(--nfq-text-muted)]">
        <span>Avg FTP Var: <span className="text-[color:var(--nfq-text-secondary)]">{fmtBps(scorecard.avgFtpVarianceBps)}</span></span>
        <span>Avg RAROC Var: <span className="text-[color:var(--nfq-text-secondary)]">{fmtBps(scorecard.avgRarocVariancePp * 100)}</span></span>
      </div>

      {/* Sparkline trend chart */}
      {trendData.length > 1 && (
        <div>
          <div className="nfq-kpi-label mb-2">In-Band Trend</div>
          <ResponsiveContainer width="100%" height={64}>
            <LineChart data={trendData} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
              <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
              <Tooltip
                contentStyle={{
                  background: 'var(--nfq-bg-elevated)',
                  border: '1px solid var(--nfq-border-ghost)',
                  borderRadius: 8,
                  fontSize: 10,
                  fontFamily: 'var(--nfq-font-mono)',
                  color: 'var(--nfq-text-primary)',
                }}
                formatter={(value: number | string | undefined) => `${Number(value ?? 0).toFixed(1)}%`}
              />
              <Line
                type="monotone"
                dataKey="inBandPct"
                stroke="#22d3ee"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: '#22d3ee' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default OriginatorScorecardComponent;
