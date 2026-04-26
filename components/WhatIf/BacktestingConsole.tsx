import React, { useState, useCallback, useMemo } from 'react';
import type { BacktestRun, BacktestResult, BacktestStatus } from '../../types';
import {
  Play,
  FlaskConical,
  BarChart3,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from '../ui/charts/lazyRecharts';
import { Panel, Badge, Button, TextInput, InputGroup } from '../ui/LayoutComponents';
import { useUI } from '../../contexts/UIContext';
import { useEntity } from '../../contexts/EntityContext';
import {
  useBacktestRunsQuery,
  useBacktestResultQuery,
  useCreateBacktestRun,
} from '../../hooks/queries/useWhatIfQueries';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<BacktestStatus, 'muted' | 'warning' | 'success' | 'danger'> = {
  pending: 'muted',
  running: 'warning',
  completed: 'success',
  failed: 'danger',
};

function fmtCurrency(value: number): string {
  if (!Number.isFinite(value)) return '\u2014';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e6) return `${sign}EUR ${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}EUR ${(abs / 1e3).toFixed(0)}K`;
  return `${sign}EUR ${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtPct(value: number): string {
  if (!Number.isFinite(value)) return '\u2014';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
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

function fmtDuration(ms: number | undefined): string {
  if (!ms) return '\u2014';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
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
// Main component
// ---------------------------------------------------------------------------

const BacktestingConsole: React.FC = () => {
  const { t } = useUI();
  const { activeEntity } = useEntity();
  const entityId = activeEntity?.id;

  // --- State ---
  const [selectedRunId, setSelectedRunId] = useState('');
  const [formName, setFormName] = useState('');
  const [formDateFrom, setFormDateFrom] = useState('');
  const [formDateTo, setFormDateTo] = useState('');
  const [formSnapshotId, setFormSnapshotId] = useState('');
  const [formSandboxId, setFormSandboxId] = useState('');

  // --- Queries ---
  const { data: runs = [], isLoading: loadingRuns } = useBacktestRunsQuery(entityId);
  const { data: result, isLoading: loadingResult } = useBacktestResultQuery(selectedRunId);
  const createMutation = useCreateBacktestRun();

  // --- Sorted runs ---
  const sortedRuns = useMemo(
    () => [...runs].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()),
    [runs],
  );

  // --- Handlers ---
  const handleCreateRun = useCallback(() => {
    if (!formName.trim() || !formDateFrom || !formDateTo || !formSnapshotId.trim()) return;
    createMutation.mutate(
      {
        name: formName.trim(),
        snapshotId: formSnapshotId.trim(),
        sandboxId: formSandboxId.trim() || undefined,
        dateFrom: formDateFrom,
        dateTo: formDateTo,
        dealCount: 0,
        entityId,
        createdByEmail: '',
      },
      {
        onSuccess: (created) => {
          if (created) setSelectedRunId(created.id);
          setFormName('');
          setFormDateFrom('');
          setFormDateTo('');
          setFormSnapshotId('');
          setFormSandboxId('');
        },
      },
    );
  }, [formName, formDateFrom, formDateTo, formSnapshotId, formSandboxId, entityId, createMutation]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-full min-h-0 gap-4">
      {/* --- Left: form + run list --- */}
      <div className="flex w-[380px] shrink-0 flex-col gap-4">
        {/* New backtest form */}
        <Panel
          title="New Backtest"
          icon={<Play className="h-5 w-5 text-cyan-400" />}
        >
          <div className="space-y-3 p-4">
            <InputGroup label="Name">
              <TextInput
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Q1 2026 Backtest"
              />
            </InputGroup>
            <div className="grid grid-cols-2 gap-3">
              <InputGroup label="Date From">
                <TextInput
                  type="date"
                  value={formDateFrom}
                  onChange={(e) => setFormDateFrom(e.target.value)}
                />
              </InputGroup>
              <InputGroup label="Date To">
                <TextInput
                  type="date"
                  value={formDateTo}
                  onChange={(e) => setFormDateTo(e.target.value)}
                />
              </InputGroup>
            </div>
            <InputGroup label="Snapshot ID">
              <TextInput
                value={formSnapshotId}
                onChange={(e) => setFormSnapshotId(e.target.value)}
                placeholder="Methodology snapshot"
              />
            </InputGroup>
            <InputGroup label="Sandbox ID (optional)">
              <TextInput
                value={formSandboxId}
                onChange={(e) => setFormSandboxId(e.target.value)}
                placeholder="Leave empty for baseline"
              />
            </InputGroup>
            <Button
              onClick={handleCreateRun}
              disabled={!formName.trim() || !formDateFrom || !formDateTo || !formSnapshotId.trim() || createMutation.isPending}
              className="w-full"
            >
              <Play className="mr-1.5 h-3.5 w-3.5" />
              {createMutation.isPending ? 'Starting...' : 'Run Backtest'}
            </Button>
          </div>
        </Panel>

        {/* Past runs list */}
        <Panel
          title="Past Runs"
          icon={<FlaskConical className="h-5 w-5 text-cyan-400" />}
        >
          <div className="p-2">
            {loadingRuns ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-500" />
              </div>
            ) : sortedRuns.length === 0 ? (
              <div className="py-8 text-center text-xs text-[color:var(--nfq-text-secondary)]">
                No backtest runs yet.
              </div>
            ) : (
              <div className="max-h-[320px] space-y-1 overflow-y-auto">
                {sortedRuns.map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => setSelectedRunId(run.id)}
                    className={`w-full text-left rounded-[12px] px-3 py-2.5 transition-colors ${
                      run.id === selectedRunId
                        ? 'bg-cyan-500/10 border border-cyan-500/30'
                        : 'hover:bg-[var(--nfq-bg-elevated)] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-[color:var(--nfq-text-primary)] truncate">
                        {run.name}
                      </span>
                      <Badge variant={STATUS_BADGE[run.status]}>{run.status}</Badge>
                    </div>
                    <div className="mt-1 text-[10px] text-[color:var(--nfq-text-secondary)]">
                      {run.dateFrom} &rarr; {run.dateTo} &middot; {run.dealCount.toLocaleString()} deals &middot;{' '}
                      {fmtDuration(run.durationMs)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* --- Right: selected result --- */}
      <div className="flex flex-1 min-w-0 flex-col">
        {!selectedRunId ? (
          <div className="flex flex-1 items-center justify-center rounded-[22px] bg-[var(--nfq-bg-surface)] border border-white/5">
            <div className="text-center">
              <BarChart3 className="mx-auto mb-3 h-10 w-10 text-[color:var(--nfq-text-secondary)] opacity-30" />
              <span className="text-xs text-[color:var(--nfq-text-secondary)]">Select a run to view results</span>
            </div>
          </div>
        ) : loadingResult ? (
          <div className="flex flex-1 items-center justify-center rounded-[22px] bg-[var(--nfq-bg-surface)] border border-white/5">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-500" />
          </div>
        ) : !result ? (
          <div className="flex flex-1 items-center justify-center rounded-[22px] bg-[var(--nfq-bg-surface)] border border-white/5">
            <span className="text-xs text-[color:var(--nfq-text-secondary)]">
              Results not available yet. The run may still be in progress.
            </span>
          </div>
        ) : (
          <BacktestResultView result={result} />
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Result detail view
// ---------------------------------------------------------------------------

const BacktestResultView: React.FC<{ result: BacktestResult }> = ({ result }) => {
  const pnlDeltaColor = deltaColor(result.pnlDelta);
  const rarocDeltaColor = deltaColor(result.rarocDeltaPp);

  return (
    <Panel
      title="Backtest Results"
      icon={<BarChart3 className="h-5 w-5 text-cyan-400" />}
    >
      <div className="space-y-6 p-4">
        {/* --- P&L comparison cards --- */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-[16px] border border-white/5 bg-[var(--nfq-bg-elevated)] p-4">
            <div className="text-[11px] font-medium text-[color:var(--nfq-text-secondary)]">
              Simulated P&L
            </div>
            <div className="mt-1 text-lg font-mono font-bold text-[color:var(--nfq-text-primary)]">
              {fmtCurrency(result.simulatedPnl)}
            </div>
          </div>
          <div className="rounded-[16px] border border-white/5 bg-[var(--nfq-bg-elevated)] p-4">
            <div className="text-[11px] font-medium text-[color:var(--nfq-text-secondary)]">
              Actual P&L
            </div>
            <div className="mt-1 text-lg font-mono font-bold text-[color:var(--nfq-text-primary)]">
              {fmtCurrency(result.actualPnl)}
            </div>
          </div>
          <div className="rounded-[16px] border border-white/5 bg-[var(--nfq-bg-elevated)] p-4">
            <div className="text-[11px] font-medium text-[color:var(--nfq-text-secondary)]">
              P&L Delta
            </div>
            <div className={`mt-1 text-lg font-mono font-bold ${pnlDeltaColor}`}>
              {fmtCurrency(result.pnlDelta)} ({fmtPct(result.pnlDeltaPct)})
            </div>
          </div>
        </div>

        {/* RAROC summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-[16px] border border-white/5 bg-[var(--nfq-bg-elevated)] p-4">
            <div className="text-[11px] font-medium text-[color:var(--nfq-text-secondary)]">
              Simulated RAROC
            </div>
            <div className="mt-1 text-lg font-mono font-bold text-[color:var(--nfq-text-primary)]">
              {fmtRaroc(result.simulatedAvgRaroc)}
            </div>
          </div>
          <div className="rounded-[16px] border border-white/5 bg-[var(--nfq-bg-elevated)] p-4">
            <div className="text-[11px] font-medium text-[color:var(--nfq-text-secondary)]">
              Actual RAROC
            </div>
            <div className="mt-1 text-lg font-mono font-bold text-[color:var(--nfq-text-primary)]">
              {fmtRaroc(result.actualAvgRaroc)}
            </div>
          </div>
          <div className="rounded-[16px] border border-white/5 bg-[var(--nfq-bg-elevated)] p-4">
            <div className="text-[11px] font-medium text-[color:var(--nfq-text-secondary)]">
              RAROC Delta
            </div>
            <div className={`mt-1 text-lg font-mono font-bold ${rarocDeltaColor}`}>
              {`${result.rarocDeltaPp >= 0 ? '+' : ''}${result.rarocDeltaPp.toFixed(2)} pp`}
            </div>
          </div>
        </div>

        {/* --- Period breakdown chart --- */}
        {result.periodBreakdown.length > 0 && (
          <div>
            <h4 className="mb-3 text-[11px] font-medium text-[color:var(--nfq-text-secondary)]">
              Period Breakdown
            </h4>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={result.periodBreakdown} margin={{ left: 16, right: 16, top: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="period" tick={{ fontSize: 10, fill: 'var(--nfq-text-secondary)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--nfq-text-secondary)' }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line
                    type="monotone"
                    dataKey="simulatedPnl"
                    stroke="#06b6d4"
                    name="Simulated"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="actualPnl"
                    stroke="#10b981"
                    name="Actual"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* --- Cohort breakdown table --- */}
        {result.cohortBreakdown.length > 0 && (
          <div>
            <h4 className="mb-3 text-[11px] font-medium text-[color:var(--nfq-text-secondary)]">
              Cohort Breakdown
            </h4>
            <div className="max-h-64 overflow-auto rounded-[16px] border border-white/5">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[var(--nfq-bg-elevated)]">
                    <th className="px-3 py-2 text-left font-semibold text-[color:var(--nfq-text-secondary)]">Product</th>
                    <th className="px-3 py-2 text-left font-semibold text-[color:var(--nfq-text-secondary)]">Segment</th>
                    <th className="px-3 py-2 text-right font-semibold text-[color:var(--nfq-text-secondary)]">Sim Rate</th>
                    <th className="px-3 py-2 text-right font-semibold text-[color:var(--nfq-text-secondary)]">Act Rate</th>
                    <th className="px-3 py-2 text-right font-semibold text-[color:var(--nfq-text-secondary)]">\u0394 (bps)</th>
                    <th className="px-3 py-2 text-right font-semibold text-[color:var(--nfq-text-secondary)]">Deals</th>
                    <th className="px-3 py-2 text-right font-semibold text-[color:var(--nfq-text-secondary)]">Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {result.cohortBreakdown.map((cohort, idx) => (
                    <tr
                      key={`${cohort.product}-${cohort.segment}-${idx}`}
                      className="border-t border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-3 py-2 font-medium text-[color:var(--nfq-text-primary)]">{cohort.product}</td>
                      <td className="px-3 py-2 text-[color:var(--nfq-text-primary)]">{cohort.segment}</td>
                      <td className="px-3 py-2 text-right font-mono text-[color:var(--nfq-text-primary)]">
                        {(cohort.simulatedAvgRate * 100).toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[color:var(--nfq-text-primary)]">
                        {(cohort.actualAvgRate * 100).toFixed(2)}%
                      </td>
                      <td className={`px-3 py-2 text-right font-mono ${deltaColor(cohort.rateDeltaBps)}`}>
                        {cohort.rateDeltaBps >= 0 ? '+' : ''}{cohort.rateDeltaBps.toFixed(1)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[color:var(--nfq-text-secondary)]">
                        {cohort.dealCount.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[color:var(--nfq-text-secondary)]">
                        {fmtCurrency(cohort.volumeEur)}
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

export default BacktestingConsole;
