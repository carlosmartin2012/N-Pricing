import React, { useMemo } from 'react';
import type { ImpactReport, CellImpact } from '../../types';
import {
  BarChart3,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from '../ui/charts/lazyRecharts';
import { Panel } from '../ui/LayoutComponents';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  report: ImpactReport | null;
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtBps(value: number): string {
  if (!Number.isFinite(value)) return '\u2014';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)} bp`;
}

function fmtPct(value: number): string {
  if (!Number.isFinite(value)) return '\u2014';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function fmtCurrency(value: number): string {
  if (!Number.isFinite(value)) return '\u2014';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '+';
  if (abs >= 1e9) return `${sign}EUR ${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}EUR ${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}EUR ${(abs / 1e3).toFixed(0)}K`;
  return `${sign}EUR ${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtRaroc(value: number): string {
  if (!Number.isFinite(value)) return '\u2014';
  return `${(value * 100).toFixed(2)}%`;
}

function deltaColor(value: number): string {
  if (value > 0) return 'text-emerald-400';
  if (value < 0) return 'text-rose-400';
  return 'text-amber-400';
}

function deltaBgColor(value: number): string {
  if (value > 0) return 'bg-emerald-500/10';
  if (value < 0) return 'bg-rose-500/10';
  return 'bg-amber-500/10';
}

// ---------------------------------------------------------------------------
// Recharts tooltip styling
// ---------------------------------------------------------------------------

const tooltipStyle: React.CSSProperties = {
  backgroundColor: 'var(--nfq-bg-elevated)',
  border: '1px solid var(--nfq-border-ghost)',
  borderRadius: '12px',
  padding: '8px 12px',
  fontFamily: 'var(--nfq-font-mono)',
  fontSize: '11px',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const SummaryCard: React.FC<{
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: string;
}> = ({ label, value, icon, tone }) => (
  <div className="group relative overflow-hidden rounded-[16px] border border-white/5 bg-[var(--nfq-bg-elevated)] p-4">
    <div className="absolute right-0 top-0 p-3 opacity-10 transition-opacity group-hover:opacity-20">
      {icon}
    </div>
    <div className="text-[11px] font-medium text-[color:var(--nfq-text-secondary)]">
      {label}
    </div>
    <div className={`mt-1 text-lg font-mono font-bold ${tone}`}>{value}</div>
  </div>
);

const Skeleton: React.FC = () => (
  <div className="space-y-4 p-4 animate-pulse">
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-20 rounded-[16px] bg-[var(--nfq-bg-elevated)]" />
      ))}
    </div>
    <div className="h-48 rounded-[16px] bg-[var(--nfq-bg-elevated)]" />
    <div className="h-32 rounded-[16px] bg-[var(--nfq-bg-elevated)]" />
  </div>
);

// ---------------------------------------------------------------------------
// Sensitivity chart data
// ---------------------------------------------------------------------------

interface CohortBar {
  cohort: string;
  ftpDelta: number;
}

function buildCohortBars(cellImpacts: CellImpact[]): CohortBar[] {
  const grouped = new Map<string, { sum: number; count: number }>();
  for (const cell of cellImpacts) {
    const key = `${cell.product} / ${cell.segment}`;
    const entry = grouped.get(key) ?? { sum: 0, count: 0 };
    entry.sum += cell.ftpDeltaBps;
    entry.count += 1;
    grouped.set(key, entry);
  }
  return Array.from(grouped.entries())
    .map(([cohort, { sum, count }]) => ({ cohort, ftpDelta: sum / count }))
    .sort((a, b) => b.ftpDelta - a.ftpDelta);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const ImpactReportPanel: React.FC<Props> = ({ report, isLoading }) => {
  const cohortBars = useMemo(
    () => (report ? buildCohortBars(report.cellImpacts) : []),
    [report],
  );

  if (isLoading) {
    return (
      <Panel
        title="Impact Report"
        icon={<BarChart3 className="h-5 w-5 text-cyan-400" />}
      >
        <Skeleton />
      </Panel>
    );
  }

  if (!report) {
    return (
      <Panel
        title="Impact Report"
        icon={<BarChart3 className="h-5 w-5 text-cyan-400" />}
      >
        <div className="flex flex-col items-center justify-center py-12 text-[color:var(--nfq-text-secondary)]">
          <BarChart3 className="mb-3 h-8 w-8 opacity-30" />
          <span className="text-xs">No impact report available. Compute one first.</span>
        </div>
      </Panel>
    );
  }

  const { summary, portfolioImpact, cellImpacts } = report;

  return (
    <Panel
      title="Impact Report"
      icon={<BarChart3 className="h-5 w-5 text-cyan-400" />}
      actions={
        <span className="text-[10px] font-mono text-[color:var(--nfq-text-secondary)]">
          {new Date(report.computedAt).toLocaleString()}
        </span>
      }
    >
      <div className="space-y-6 p-4">
        {/* --- Summary KPI cards --- */}
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard
            label="\u0394 NII"
            value={fmtCurrency(summary.estimatedNiiDelta)}
            icon={
              summary.estimatedNiiDelta >= 0 ? (
                <TrendingUp className="h-6 w-6 text-emerald-400" />
              ) : (
                <TrendingDown className="h-6 w-6 text-rose-400" />
              )
            }
            tone={deltaColor(summary.estimatedNiiDelta)}
          />
          <SummaryCard
            label="\u0394 RAROC"
            value={`${summary.avgRarocChangePp >= 0 ? '+' : ''}${summary.avgRarocChangePp.toFixed(2)} pp`}
            icon={
              summary.avgRarocChangePp >= 0 ? (
                <TrendingUp className="h-6 w-6 text-emerald-400" />
              ) : (
                <TrendingDown className="h-6 w-6 text-rose-400" />
              )
            }
            tone={deltaColor(summary.avgRarocChangePp)}
          />
          <SummaryCard
            label="Cells Affected"
            value={summary.totalCellsAffected.toLocaleString()}
            icon={<BarChart3 className="h-6 w-6 text-cyan-400" />}
            tone="text-[color:var(--nfq-text-primary)]"
          />
          <SummaryCard
            label="Volume at Risk"
            value={`${fmtCurrency(summary.volumeAtRisk)} (${fmtPct(summary.volumeAtRiskPct)})`}
            icon={<TrendingDown className="h-6 w-6 text-amber-400" />}
            tone="text-amber-400"
          />
        </div>

        {/* --- Sensitivity bar chart --- */}
        {cohortBars.length > 0 && (
          <div>
            <h4 className="mb-3 text-[11px] font-medium text-[color:var(--nfq-text-secondary)]">
              FTP Delta by Cohort (bps)
            </h4>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cohortBars} layout="vertical" margin={{ left: 80, right: 16, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--nfq-text-secondary)' }} />
                  <YAxis
                    type="category"
                    dataKey="cohort"
                    tick={{ fontSize: 10, fill: 'var(--nfq-text-secondary)' }}
                    width={76}
                  />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v).toFixed(1)} bp`, 'FTP \u0394']} />
                  <Bar dataKey="ftpDelta" radius={[0, 4, 4, 0]}>
                    {cohortBars.map((entry, idx) => (
                      <Cell key={idx} fill={entry.ftpDelta >= 0 ? '#10b981' : '#f43f5e'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* --- Portfolio impact --- */}
        <div>
          <h4 className="mb-3 text-[11px] font-medium text-[color:var(--nfq-text-secondary)]">
            Portfolio Impact
          </h4>
          <div className="overflow-hidden rounded-[16px] border border-white/5">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5 bg-[var(--nfq-bg-elevated)]">
                  <th className="px-4 py-2.5 text-left font-semibold text-[color:var(--nfq-text-secondary)]">Metric</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-[color:var(--nfq-text-secondary)]">Current</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-[color:var(--nfq-text-secondary)]">Projected</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-[color:var(--nfq-text-secondary)]">Delta</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-medium text-[color:var(--nfq-text-primary)]">NII</td>
                  <td className="px-4 py-2.5 text-right font-mono text-[color:var(--nfq-text-primary)]">
                    {fmtCurrency(portfolioImpact.currentNii)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-[color:var(--nfq-text-primary)]">
                    {fmtCurrency(portfolioImpact.projectedNii)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono font-bold ${deltaColor(portfolioImpact.niiDelta)}`}>
                    {fmtCurrency(portfolioImpact.niiDelta)}
                  </td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-medium text-[color:var(--nfq-text-primary)]">Avg RAROC</td>
                  <td className="px-4 py-2.5 text-right font-mono text-[color:var(--nfq-text-primary)]">
                    {fmtRaroc(portfolioImpact.currentAvgRaroc)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-[color:var(--nfq-text-primary)]">
                    {fmtRaroc(portfolioImpact.projectedAvgRaroc)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono font-bold ${deltaColor(portfolioImpact.rarocDelta)}`}>
                    {`${portfolioImpact.rarocDelta >= 0 ? '+' : ''}${(portfolioImpact.rarocDelta * 100).toFixed(2)} pp`}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-[color:var(--nfq-text-primary)]">Deals Affected</td>
                  <td className="px-4 py-2.5 text-right font-mono text-[color:var(--nfq-text-primary)]">
                    {portfolioImpact.dealCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-[color:var(--nfq-text-primary)]">
                    {portfolioImpact.affectedDealCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-amber-400">
                    {fmtPct((portfolioImpact.affectedDealCount / Math.max(portfolioImpact.dealCount, 1)) * 100)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* --- Cell-by-cell impact table --- */}
        {cellImpacts.length > 0 && (
          <div>
            <h4 className="mb-3 text-[11px] font-medium text-[color:var(--nfq-text-secondary)]">
              Cell-by-Cell Impact ({cellImpacts.length})
            </h4>
            <div className="max-h-64 overflow-auto rounded-[16px] border border-white/5">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[var(--nfq-bg-elevated)]">
                    <th className="px-3 py-2 text-left font-semibold text-[color:var(--nfq-text-secondary)]">Product</th>
                    <th className="px-3 py-2 text-left font-semibold text-[color:var(--nfq-text-secondary)]">Segment</th>
                    <th className="px-3 py-2 text-left font-semibold text-[color:var(--nfq-text-secondary)]">Tenor</th>
                    <th className="px-3 py-2 text-left font-semibold text-[color:var(--nfq-text-secondary)]">Ccy</th>
                    <th className="px-3 py-2 text-right font-semibold text-[color:var(--nfq-text-secondary)]">FTP \u0394</th>
                    <th className="px-3 py-2 text-right font-semibold text-[color:var(--nfq-text-secondary)]">RAROC \u0394</th>
                    <th className="px-3 py-2 text-right font-semibold text-[color:var(--nfq-text-secondary)]">Rate \u0394</th>
                  </tr>
                </thead>
                <tbody>
                  {cellImpacts.map((cell, idx) => (
                    <tr
                      key={`${cell.product}-${cell.segment}-${cell.tenorBucket}-${cell.currency}-${idx}`}
                      className="border-t border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-3 py-2 text-[color:var(--nfq-text-primary)]">{cell.product}</td>
                      <td className="px-3 py-2 text-[color:var(--nfq-text-primary)]">{cell.segment}</td>
                      <td className="px-3 py-2 text-[color:var(--nfq-text-secondary)]">{cell.tenorBucket}</td>
                      <td className="px-3 py-2 text-[color:var(--nfq-text-secondary)]">{cell.currency}</td>
                      <td className={`px-3 py-2 text-right font-mono ${deltaColor(cell.ftpDeltaBps)}`}>
                        <span className={`inline-block rounded px-1.5 py-0.5 ${deltaBgColor(cell.ftpDeltaBps)}`}>
                          {fmtBps(cell.ftpDeltaBps)}
                        </span>
                      </td>
                      <td className={`px-3 py-2 text-right font-mono ${deltaColor(cell.rarocDeltaPp)}`}>
                        {`${cell.rarocDeltaPp >= 0 ? '+' : ''}${cell.rarocDeltaPp.toFixed(2)} pp`}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono ${deltaColor(cell.clientRateDeltaBps)}`}>
                        {fmtBps(cell.clientRateDeltaBps)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
};

export default ImpactReportPanel;
