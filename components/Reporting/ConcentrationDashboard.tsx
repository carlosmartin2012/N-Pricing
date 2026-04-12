import React, { useMemo, useState } from 'react';
import { AlertTriangle, BarChart4, Shield } from 'lucide-react';
import type { Transaction } from '../../types';
import { analyzePortfolioConcentration, classifyHHI, type ConcentrationMetrics } from '../../utils/concentrationAnalytics';

interface Props {
  deals: Transaction[];
}

function fmtAmount(v: number): string {
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toFixed(0);
}

const ConcentrationCard: React.FC<{ metrics: ConcentrationMetrics }> = ({ metrics }) => {
  const hhiClass = classifyHHI(metrics.hhi);

  return (
    <div className="rounded-2xl border border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--nfq-text-muted)]">
          {metrics.dimension}
        </h4>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] text-[var(--nfq-text-faint)]">HHI</span>
          <span className={`font-mono text-sm font-bold ${hhiClass.color}`}>
            {metrics.hhi.toFixed(0)}
          </span>
          <span className={`text-[9px] uppercase font-semibold ${hhiClass.color}`}>
            {hhiClass.level}
          </span>
        </div>
      </div>

      {/* Top-N bar chart */}
      <div className="space-y-2">
        {metrics.topN.map((seg) => (
          <div key={seg.name} className="flex items-center gap-2">
            <span className="w-24 truncate text-[11px] text-[var(--nfq-text-secondary)]">{seg.name}</span>
            <div className="flex-1 h-4 rounded-full bg-[var(--nfq-bg-elevated)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--nfq-accent)] opacity-70 transition-all"
                style={{ width: `${Math.min(seg.share * 100, 100)}%` }}
              />
            </div>
            <span className="w-14 text-right font-mono text-[10px] text-[var(--nfq-text-muted)]">
              {(seg.share * 100).toFixed(1)}%
            </span>
            <span className="w-16 text-right font-mono text-[10px] text-[var(--nfq-text-faint)]">
              {fmtAmount(seg.exposure)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2 text-[10px] text-[var(--nfq-text-faint)]">
        {metrics.segments.length} segments · Top {metrics.topN.length} shown
      </div>
    </div>
  );
};

const ConcentrationDashboard: React.FC<Props> = ({ deals }) => {
  const allMetrics = useMemo(() => analyzePortfolioConcentration(deals), [deals]);

  const highConcentration = allMetrics.filter((m) => classifyHHI(m.hhi).level === 'high');
  const booked = deals.filter((d) => d.status === 'Booked' || d.status === 'Approved');

  if (booked.length === 0) {
    return (
      <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 rounded-[24px] bg-[var(--nfq-bg-surface)] px-8 py-16 text-center">
        <Shield size={28} className="text-[var(--nfq-text-muted)] opacity-60" />
        <h3 className="text-base font-semibold text-[var(--nfq-text-primary)]">No portfolio data</h3>
        <p className="text-sm text-[var(--nfq-text-muted)]">Book deals to see concentration analysis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Alert banner for high concentration */}
      {highConcentration.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 px-4 py-3">
          <AlertTriangle size={16} className="text-rose-400 shrink-0" />
          <p className="text-xs text-rose-300">
            High concentration detected in: {highConcentration.map((m) => m.dimension).join(', ')}.
            Review large exposure limits (CRR Art. 395).
          </p>
        </div>
      )}

      {/* Grid of concentration cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {allMetrics.map((m) => (
          <ConcentrationCard key={m.dimension} metrics={m} />
        ))}
      </div>
    </div>
  );
};

export default ConcentrationDashboard;
