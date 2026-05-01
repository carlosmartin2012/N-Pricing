import React, { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  AlertCircle, ArrowUpRight, CheckCircle2, Download, Filter,
  Scale, ShieldCheck,
} from 'lucide-react';
import { useReconciliationSummaryQuery } from '../../hooks/queries/useReconciliationQueries';
import { useEntity } from '../../contexts/EntityContext';
import type { EntryPair, MatchStatus } from '../../types/reconciliation';
import { reconciliationPairsToCsv, reconciliationCsvFilename } from './reconciliationCsv';

/**
 * /reconciliation — controller-grade FTP Reconciliation view.
 *
 * Replaces the demoted Accounting Ledger with a focused tool: list every
 * deal, show whether the BU and Treasury journals match, drill down on
 * mismatches.
 *
 * Design decisions:
 *   - Single page (no tabs) — controllers want one place for everything.
 *   - Period selector (YYYY-MM) at top; defaults to current month.
 *   - 4 KPI tiles: matched · unmatched · matched% · max single delta.
 *   - Status filter chips: All · Matched · Unmatched · per-status quick
 *     filters (amount / rate / currency / bu_only / treasury_only).
 *   - Table with row-level "Open deal" deep-link to /blotter.
 *   - CSV export of the *filtered* set (so controllers can download just
 *     the rows they're investigating).
 */

const STATUS_LABEL: Record<MatchStatus, string> = {
  matched: 'Matched',
  amount_mismatch: 'Amount mismatch',
  rate_mismatch: 'Rate mismatch',
  currency_mismatch: 'Currency mismatch',
  bu_only: 'BU only',
  treasury_only: 'Treasury only',
  unknown: 'Unknown',
};

const STATUS_TONE: Record<MatchStatus, string> = {
  matched: 'bg-emerald-500/10 text-emerald-300',
  amount_mismatch: 'bg-amber-500/10 text-amber-300',
  rate_mismatch: 'bg-amber-500/10 text-amber-300',
  currency_mismatch: 'bg-rose-500/10 text-rose-300',
  bu_only: 'bg-sky-500/10 text-sky-300',
  treasury_only: 'bg-violet-500/10 text-violet-300',
  unknown: 'bg-slate-500/10 text-slate-300',
};

type StatusFilter = 'all' | 'matched' | 'unmatched' | MatchStatus;

const fmtEur = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
};
const fmtPct = (v: number | null | undefined, digits = 2): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${v.toFixed(digits)}%`;
};

function downloadBlobFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

const ReconciliationView: React.FC = () => {
  const { activeEntity } = useEntity();
  const [period, setPeriod] = useState<string>(() => currentPeriod());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { data, isLoading } = useReconciliationSummaryQuery(period);

  const summary = data?.summary;
  // useMemo evita crear un nuevo [] cada render cuando data es undefined,
  // que invalidaría la identidad de allPairs y dispararía el filtered
  // useMemo aunque ningún input lógico haya cambiado.
  const allPairs = useMemo(() => data?.pairs ?? [], [data?.pairs]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return allPairs;
    if (statusFilter === 'unmatched') {
      return allPairs.filter((p) => p.matchStatus !== 'matched' && p.matchStatus !== 'unknown');
    }
    return allPairs.filter((p) => p.matchStatus === statusFilter);
  }, [allPairs, statusFilter]);

  const matchedPct = useMemo(() => {
    if (!summary || summary.totalEntries === 0) return 0;
    return (summary.matched / summary.totalEntries) * 100;
  }, [summary]);

  const exportCsv = useCallback(() => {
    const csv = reconciliationPairsToCsv(filtered);
    downloadBlobFile(reconciliationCsvFilename(period, statusFilter), csv);
  }, [filtered, period, statusFilter]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Scale className="h-5 w-5 text-violet-400" />
          <div>
            <h2 className="font-mono text-sm font-bold uppercase tracking-tight text-white">
              FTP Reconciliation
            </h2>
            <p className="font-mono text-[10px] text-slate-400">
              Controller view · BU ↔ Treasury journal matching
            </p>
          </div>
          {activeEntity && (
            <span className="nfq-label text-[10px] text-slate-400">
              {activeEntity.shortCode}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="font-mono text-[10px] uppercase text-slate-400">Period</label>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value || currentPeriod())}
            data-testid="reconciliation-period"
            className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-1 font-mono text-[11px] text-slate-200"
          />
          <button
            type="button"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            data-testid="reconciliation-export-csv"
            className="nfq-btn-ghost flex items-center gap-1.5 px-3 py-1 text-[10px] disabled:opacity-60"
          >
            <Download className="h-3 w-3" />
            Export CSV
          </button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile
          icon={CheckCircle2}
          label="Matched"
          value={String(summary?.matched ?? 0)}
          sub={summary ? `${matchedPct.toFixed(1)}%` : '—'}
          tone="emerald"
        />
        <KpiTile
          icon={AlertCircle}
          label="Unmatched"
          value={String(summary?.unmatched ?? 0)}
          sub={summary ? `${summary.totalEntries} total` : '—'}
          tone="amber"
        />
        <KpiTile
          icon={ShieldCheck}
          label="Total amount delta"
          value={fmtEur(summary?.amountMismatchEur ?? 0)}
          sub="cumulative"
          tone="rose"
        />
        <KpiTile
          icon={AlertCircle}
          label="Max single delta"
          value={fmtEur(summary?.maxSingleDeltaEur ?? 0)}
          sub="biggest gap"
          tone="rose"
        />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-3 w-3 text-slate-400" />
        <span className="nfq-label text-[10px] text-slate-400">Status</span>
        {(['all', 'matched', 'unmatched', 'amount_mismatch', 'rate_mismatch', 'currency_mismatch', 'bu_only', 'treasury_only'] as StatusFilter[]).map((s) => {
          const active = statusFilter === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              aria-pressed={active}
              data-testid={`reconciliation-filter-${s}`}
              className={`rounded-md px-2 py-1 font-mono text-[10px] tracking-normal transition-colors ${
                active
                  ? 'bg-white/[0.08] text-white ring-1 ring-violet-400/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {s === 'all' ? 'All' : s === 'matched' ? 'Matched' : s === 'unmatched' ? 'Unmatched' : STATUS_LABEL[s as MatchStatus]}
            </button>
          );
        })}
      </div>

      {!isLoading && filtered.length === 0 && (
        <div
          data-testid="reconciliation-empty"
          className="rounded-lg border border-white/5 bg-white/[0.02] p-4 text-center text-xs text-slate-400"
        >
          No entries for the current filter. Try a different period or widen the status filter.
        </div>
      )}

      {filtered.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-white/10">
          <table className="w-full text-sm" data-testid="reconciliation-table">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <Th>Deal</Th>
                <Th>Client</Th>
                <Th>BU</Th>
                <Th>Product</Th>
                <Th>Status</Th>
                <Th align="right">Δ Amount</Th>
                <Th align="right">Δ Rate</Th>
                <Th align="right">Hint / Action</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <RowEntry key={p.dealId} pair={p} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

interface KpiTileProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  tone: 'emerald' | 'amber' | 'rose' | 'sky';
}

const KpiTile: React.FC<KpiTileProps> = ({ icon: Icon, label, value, sub, tone }) => {
  const toneClass = {
    emerald: 'text-emerald-300',
    amber: 'text-amber-300',
    rose: 'text-rose-300',
    sky: 'text-sky-300',
  }[tone];
  return (
    <div className="rounded border border-white/5 bg-white/[0.02] p-3">
      <div className="nfq-label flex items-center gap-1.5 text-[9px] text-slate-400">
        <Icon className={`h-3 w-3 ${toneClass}`} />
        {label}
      </div>
      <div className={`mt-1 font-mono text-sm font-bold tabular-nums ${toneClass}`}>{value}</div>
      <p className="font-mono text-[10px] text-slate-500">{sub}</p>
    </div>
  );
};

const Th: React.FC<{ children: React.ReactNode; align?: 'left' | 'right' }> = ({ children, align = 'left' }) => (
  <th className={`nfq-label text-[10px] px-3 py-2 text-${align}`}>{children}</th>
);

const RowEntry: React.FC<{ pair: EntryPair }> = ({ pair }) => {
  return (
    <tr
      data-testid={`reconciliation-row-${pair.dealId}`}
      className="border-b border-white/5"
    >
      <td className="px-3 py-2 font-mono text-xs text-slate-200">{pair.dealId.slice(0, 12)}…</td>
      <td className="px-3 py-2 text-xs text-slate-300">{pair.clientName ?? '—'}</td>
      <td className="px-3 py-2 font-mono text-[10px] text-slate-400">{pair.businessUnit}</td>
      <td className="px-3 py-2 font-mono text-[10px] text-slate-400">{pair.productType}</td>
      <td className="px-3 py-2 text-xs">
        <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${STATUS_TONE[pair.matchStatus]}`}>
          {STATUS_LABEL[pair.matchStatus]}
        </span>
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-xs">
        {pair.amountDeltaEur > 0 ? fmtEur(pair.amountDeltaEur) : '—'}
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-xs">
        {pair.rateDeltaPct > 0 ? fmtPct(pair.rateDeltaPct) : '—'}
      </td>
      <td className="px-3 py-2 text-right text-[11px]">
        <div className="flex items-center justify-end gap-2">
          {pair.hint && (
            <span className="text-slate-400 max-w-[260px] truncate" title={pair.hint}>{pair.hint}</span>
          )}
          <Link
            to={`/blotter?dealId=${encodeURIComponent(pair.dealId)}`}
            data-testid={`reconciliation-row-open-${pair.dealId}`}
            className="nfq-btn-ghost flex items-center gap-1 px-2 py-1 text-[10px]"
          >
            Open <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </td>
    </tr>
  );
};

export default ReconciliationView;
