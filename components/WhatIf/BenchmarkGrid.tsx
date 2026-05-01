import React, { useMemo } from 'react';
import type { BenchmarkComparison, BudgetConsistency } from '../../types';
import {
  BarChart3,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Panel, Badge } from '../ui/LayoutComponents';
import { useEntity } from '../../contexts/EntityContext';
import {
  useBenchmarkComparisonQuery,
  useBudgetConsistencyQuery,
} from '../../hooks/queries/useWhatIfQueries';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  snapshotId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtRate(value: number): string {
  if (!Number.isFinite(value)) return '\u2014';
  return `${(value * 100).toFixed(2)}%`;
}

function fmtBps(value: number): string {
  if (!Number.isFinite(value)) return '\u2014';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)} bp`;
}

function fmtCurrency(value: number): string {
  if (!Number.isFinite(value)) return '\u2014';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : value > 0 ? '+' : '';
  if (abs >= 1e6) return `${sign}EUR ${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}EUR ${(abs / 1e3).toFixed(0)}K`;
  return `${sign}EUR ${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtPct(value: number): string {
  if (!Number.isFinite(value)) return '\u2014';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

/**
 * Competitiveness: negative delta = our target is below market = competitive (green).
 * Positive delta = above market = potentially uncompetitive (red).
 */
function deltaTone(bps: number): string {
  if (bps <= -5) return 'text-emerald-400';
  if (bps <= 5) return 'text-amber-400';
  return 'text-rose-400';
}

function deltaBg(bps: number): string {
  if (bps <= -5) return 'bg-emerald-500/10';
  if (bps <= 5) return 'bg-amber-500/10';
  return 'bg-rose-500/10';
}

function gapTone(value: number): string {
  if (value > 0) return 'text-emerald-400';
  if (value < 0) return 'text-rose-400';
  return 'text-amber-400';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const Skeleton: React.FC = () => (
  <div className="space-y-3 p-4 animate-pulse">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="h-10 rounded-lg bg-[var(--nfq-bg-elevated)]" />
    ))}
  </div>
);

const BenchmarkTable: React.FC<{ rows: BenchmarkComparison[] }> = ({ rows }) => {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.deltaBps - a.deltaBps),
    [rows],
  );

  return (
    <div className="overflow-auto rounded-[16px] border border-white/5">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[var(--nfq-bg-elevated)] border-b border-white/5">
            <th className="px-4 py-2.5 text-left font-semibold text-[color:var(--nfq-text-secondary)]">Product</th>
            <th className="px-4 py-2.5 text-left font-semibold text-[color:var(--nfq-text-secondary)]">Segment</th>
            <th className="px-4 py-2.5 text-left font-semibold text-[color:var(--nfq-text-secondary)]">Tenor</th>
            <th className="px-4 py-2.5 text-left font-semibold text-[color:var(--nfq-text-secondary)]">Ccy</th>
            <th className="px-4 py-2.5 text-right font-semibold text-[color:var(--nfq-text-secondary)]">Target Rate</th>
            <th className="px-4 py-2.5 text-right font-semibold text-[color:var(--nfq-text-secondary)]">Benchmark</th>
            <th className="px-4 py-2.5 text-right font-semibold text-[color:var(--nfq-text-secondary)]">\u0394 (bps)</th>
            <th className="px-4 py-2.5 text-left font-semibold text-[color:var(--nfq-text-secondary)]">Source</th>
            <th className="px-4 py-2.5 text-left font-semibold text-[color:var(--nfq-text-secondary)]">As Of</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, idx) => (
            <tr
              key={`${row.product}-${row.segment}-${row.tenorBucket}-${row.currency}-${idx}`}
              className="border-t border-white/5 hover:bg-white/[0.02] transition-colors"
            >
              <td className="px-4 py-2.5 font-medium text-[color:var(--nfq-text-primary)]">{row.product}</td>
              <td className="px-4 py-2.5 text-[color:var(--nfq-text-primary)]">{row.segment}</td>
              <td className="px-4 py-2.5 text-[color:var(--nfq-text-secondary)]">{row.tenorBucket}</td>
              <td className="px-4 py-2.5 text-[color:var(--nfq-text-secondary)]">{row.currency}</td>
              <td className="px-4 py-2.5 text-right font-mono text-[color:var(--nfq-text-primary)]">
                {fmtRate(row.targetRate)}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-[color:var(--nfq-text-primary)]">
                {fmtRate(row.benchmarkRate)}
              </td>
              <td className={`px-4 py-2.5 text-right font-mono`}>
                <span className={`inline-block rounded px-1.5 py-0.5 ${deltaBg(row.deltaBps)} ${deltaTone(row.deltaBps)}`}>
                  {fmtBps(row.deltaBps)}
                </span>
              </td>
              <td className="px-4 py-2.5 text-[color:var(--nfq-text-secondary)]">{row.source}</td>
              <td className="px-4 py-2.5 text-[color:var(--nfq-text-secondary)]">
                {new Date(row.asOfDate).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const BudgetConsistencyTable: React.FC<{ rows: BudgetConsistency[] }> = ({ rows }) => (
  <div className="overflow-auto rounded-[16px] border border-white/5">
    <table className="w-full text-xs">
      <thead>
        <tr className="bg-[var(--nfq-bg-elevated)] border-b border-white/5">
          <th className="px-4 py-2.5 text-left font-semibold text-[color:var(--nfq-text-secondary)]">Product</th>
          <th className="px-4 py-2.5 text-left font-semibold text-[color:var(--nfq-text-secondary)]">Segment</th>
          <th className="px-4 py-2.5 text-left font-semibold text-[color:var(--nfq-text-secondary)]">Ccy</th>
          <th className="px-4 py-2.5 text-right font-semibold text-[color:var(--nfq-text-secondary)]">Budget NII</th>
          <th className="px-4 py-2.5 text-right font-semibold text-[color:var(--nfq-text-secondary)]">Grid NII</th>
          <th className="px-4 py-2.5 text-right font-semibold text-[color:var(--nfq-text-secondary)]">NII Gap</th>
          <th className="px-4 py-2.5 text-right font-semibold text-[color:var(--nfq-text-secondary)]">NII Gap %</th>
          <th className="px-4 py-2.5 text-right font-semibold text-[color:var(--nfq-text-secondary)]">Vol Gap %</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr
            key={`${row.product}-${row.segment}-${row.currency}-${idx}`}
            className="border-t border-white/5 hover:bg-white/[0.02] transition-colors"
          >
            <td className="px-4 py-2.5 font-medium text-[color:var(--nfq-text-primary)]">{row.product}</td>
            <td className="px-4 py-2.5 text-[color:var(--nfq-text-primary)]">{row.segment}</td>
            <td className="px-4 py-2.5 text-[color:var(--nfq-text-secondary)]">{row.currency}</td>
            <td className="px-4 py-2.5 text-right font-mono text-[color:var(--nfq-text-primary)]">
              {fmtCurrency(row.budgetNii)}
            </td>
            <td className="px-4 py-2.5 text-right font-mono text-[color:var(--nfq-text-primary)]">
              {fmtCurrency(row.gridImpliedNii)}
            </td>
            <td className={`px-4 py-2.5 text-right font-mono font-bold ${gapTone(row.niiGap)}`}>
              {fmtCurrency(row.niiGap)}
            </td>
            <td className={`px-4 py-2.5 text-right font-mono ${gapTone(row.niiGapPct)}`}>
              {fmtPct(row.niiGapPct)}
            </td>
            <td className={`px-4 py-2.5 text-right font-mono ${gapTone(row.volumeGapPct)}`}>
              {fmtPct(row.volumeGapPct)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const BenchmarkGrid: React.FC<Props> = ({ snapshotId }) => {
  const { activeEntity } = useEntity();
  const entityId = activeEntity?.id;

  // --- Queries ---
  const { data: comparisons = [], isLoading: loadingComparisons } = useBenchmarkComparisonQuery(snapshotId);
  const { data: budgetConsistency = [], isLoading: loadingBudget } = useBudgetConsistencyQuery(snapshotId, entityId);

  // --- Summary stats ---
  const stats = useMemo(() => {
    if (comparisons.length === 0) return null;
    const competitive = comparisons.filter((c) => c.deltaBps <= -5).length;
    const neutral = comparisons.filter((c) => c.deltaBps > -5 && c.deltaBps <= 5).length;
    const above = comparisons.filter((c) => c.deltaBps > 5).length;
    const avgDelta = comparisons.reduce((sum, c) => sum + c.deltaBps, 0) / comparisons.length;
    return { competitive, neutral, above, avgDelta, total: comparisons.length };
  }, [comparisons]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Panel
      title="Benchmark Comparison"
      icon={<BarChart3 className="h-5 w-5 text-cyan-400" />}
      actions={
        stats && (
          <div className="flex items-center gap-2">
            <Badge variant="success">{stats.competitive} competitive</Badge>
            <Badge variant="warning">{stats.neutral} neutral</Badge>
            <Badge variant="danger">{stats.above} above mkt</Badge>
          </div>
        )
      }
    >
      <div className="space-y-6 p-4">
        {/* --- Summary row --- */}
        {stats && (
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-[16px] border border-white/5 bg-[var(--nfq-bg-elevated)] p-4">
              <div className="text-[11px] font-medium text-[color:var(--nfq-text-secondary)]">
                Total Cells
              </div>
              <div className="mt-1 text-lg font-mono font-bold text-[color:var(--nfq-text-primary)]">
                {stats.total}
              </div>
            </div>
            <div className="rounded-[16px] border border-white/5 bg-[var(--nfq-bg-elevated)] p-4">
              <div className="text-[11px] font-medium text-[color:var(--nfq-text-secondary)]">
                Competitive
              </div>
              <div className="mt-1 flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-emerald-400" />
                <span className="text-lg font-mono font-bold text-emerald-400">{stats.competitive}</span>
              </div>
            </div>
            <div className="rounded-[16px] border border-white/5 bg-[var(--nfq-bg-elevated)] p-4">
              <div className="text-[11px] font-medium text-[color:var(--nfq-text-secondary)]">
                Above Market
              </div>
              <div className="mt-1 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-rose-400" />
                <span className="text-lg font-mono font-bold text-rose-400">{stats.above}</span>
              </div>
            </div>
            <div className="rounded-[16px] border border-white/5 bg-[var(--nfq-bg-elevated)] p-4">
              <div className="text-[11px] font-medium text-[color:var(--nfq-text-secondary)]">
                Avg Delta
              </div>
              <div className={`mt-1 text-lg font-mono font-bold ${deltaTone(stats.avgDelta)}`}>
                {fmtBps(stats.avgDelta)}
              </div>
            </div>
          </div>
        )}

        {/* --- Benchmark comparison table --- */}
        <div>
          <h4 className="mb-3 text-[11px] font-medium text-[color:var(--nfq-text-secondary)]">
            Target vs Market Benchmarks
          </h4>
          {loadingComparisons ? (
            <Skeleton />
          ) : comparisons.length === 0 ? (
            <div className="rounded-[16px] border border-dashed border-white/10 py-10 text-center text-xs text-[color:var(--nfq-text-secondary)]">
              No benchmark data available for this snapshot.
            </div>
          ) : (
            <BenchmarkTable rows={comparisons} />
          )}
        </div>

        {/* --- Budget consistency section --- */}
        <div>
          <h4 className="mb-3 text-[11px] font-medium text-[color:var(--nfq-text-secondary)]">
            Budget Consistency
          </h4>
          {loadingBudget ? (
            <Skeleton />
          ) : budgetConsistency.length === 0 ? (
            <div className="rounded-[16px] border border-dashed border-white/10 py-6 text-center text-xs text-[color:var(--nfq-text-secondary)]">
              No budget targets configured for this entity.
            </div>
          ) : (
            <BudgetConsistencyTable rows={budgetConsistency} />
          )}
        </div>
      </div>
    </Panel>
  );
};

export default BenchmarkGrid;
