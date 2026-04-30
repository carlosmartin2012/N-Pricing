import React, { useState } from 'react';
import { Scale, RefreshCw } from 'lucide-react';
import { useUI } from '../../contexts/UIContext';
import { budgetTranslations } from '../../translations/index';
import { useBudgetComparisonQuery } from '../../hooks/queries/useBudgetQueries';
import type { BudgetVarianceItem, BudgetVarianceStatus } from '../../utils/budget/budgetReconciler';

const fmtBps = (v: number | null) => (v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)} bps`);
const fmtEur = (v: number | null) =>
  v === null
    ? '—'
    : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
const fmtPct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(1)}%`);

const STATUS_CLASSES: Record<BudgetVarianceStatus, string> = {
  on_track:           'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  over_budget_rate:   'bg-rose-500/10    text-rose-300    border-rose-500/30',
  under_budget_rate:  'bg-amber-500/10   text-amber-300   border-amber-500/30',
  over_budget_volume: 'bg-sky-500/10     text-sky-300     border-sky-500/30',
  under_budget_volume:'bg-violet-500/10  text-violet-300  border-violet-500/30',
  budget_only:        'bg-slate-500/10   text-slate-300   border-slate-500/30',
  realized_only:      'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30',
};

function statusLabel(status: BudgetVarianceStatus, t: ReturnType<typeof budgetTranslations>): string {
  switch (status) {
    case 'on_track':            return t.statusOnTrack;
    case 'over_budget_rate':    return t.statusOverRate;
    case 'under_budget_rate':   return t.statusUnderRate;
    case 'over_budget_volume':  return t.statusOverVolume;
    case 'under_budget_volume': return t.statusUnderVolume;
    case 'budget_only':         return t.statusBudgetOnly;
    case 'realized_only':       return t.statusRealizedOnly;
  }
}

/**
 * Budget Reconciliation View (Ola 9 Bloque C) — wrapper read-only sobre
 * ALQUID. Compara supuestos del budget con precios realizados N-Pricing
 * por (segment × productType × currency) en el periodo seleccionado.
 *
 * Filtros: periodo (YYYY-MM), tolerancias rate/volume.
 */
const BudgetReconciliationView: React.FC = () => {
  const { language } = useUI();
  const t = budgetTranslations(language);

  const [period, setPeriod] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [rateTolerance, setRateTolerance] = useState<number>(5);
  const [volumeTolerance, setVolumeTolerance] = useState<number>(0.10);

  const query = useBudgetComparisonQuery(
    { period, rateToleranceBps: rateTolerance, volumeTolerancePct: volumeTolerance },
    Boolean(period),
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Scale className="h-5 w-5 text-emerald-400" />
          <div>
            <h2 className="font-mono text-sm font-bold uppercase tracking-tight text-white">
              {t.view}
            </h2>
            <p className="text-xs text-slate-400">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NumberField
            label={t.periodLabel}
            type="month"
            value={period}
            onChange={setPeriod}
          />
          <NumberField
            label={t.rateToleranceLabel}
            value={rateTolerance}
            min={0}
            step={0.5}
            onChange={(v) => setRateTolerance(Number(v))}
          />
          <NumberField
            label={t.volumeToleranceLabel}
            value={volumeTolerance * 100}
            min={0}
            step={1}
            onChange={(v) => setVolumeTolerance(Number(v) / 100)}
          />
          <button
            type="button"
            onClick={() => query.refetch()}
            className="flex items-center gap-1 rounded-md border border-white/10 bg-transparent px-2 py-1 text-xs text-slate-300 hover:bg-white/5"
          >
            <RefreshCw className={`h-3 w-3 ${query.isFetching ? 'animate-spin' : ''}`} />
            <span>{t.retry}</span>
          </button>
        </div>
      </header>

      {/* Summary KPIs */}
      <section className="grid gap-3 md:grid-cols-4">
        <Stat label={t.totalBudgeted}      value={query.data ? fmtEur(query.data.summary.totalBudgetedVolumeEur) : '—'} />
        <Stat label={t.totalRealized}      value={query.data ? fmtEur(query.data.summary.totalRealizedVolumeEur) : '—'} />
        <Stat label={t.weightedDriftRate}  value={query.data ? fmtBps(query.data.summary.weightedAvgDiffRateBps) : '—'} />
        <Stat label={t.statusOnTrack}      value={query.data ? `${query.data.summary.onTrack} / ${query.data.summary.total}` : '—'} />
      </section>

      {/* Table */}
      <section className="rounded-xl border border-white/5 bg-slate-900/40">
        {query.isLoading && (
          <div className="p-6 text-center text-xs text-slate-400">{t.loading}</div>
        )}
        {query.isError && (
          <div className="p-6 text-center text-xs text-rose-300">{t.errorLoading}</div>
        )}
        {query.data && query.data.items.length === 0 && (
          <div className="p-6 text-center text-xs text-slate-400">{t.emptyState}</div>
        )}
        {query.data && query.data.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/5 text-[10px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">{t.tableSegment}</th>
                  <th className="px-3 py-2">{t.tableProduct}</th>
                  <th className="px-3 py-2">{t.tableCurrency}</th>
                  <th className="px-3 py-2 text-right">{t.tableBudgetedRate}</th>
                  <th className="px-3 py-2 text-right">{t.tableRealizedRate}</th>
                  <th className="px-3 py-2 text-right">{t.tableDiffRate}</th>
                  <th className="px-3 py-2 text-right">{t.tableBudgetedVolume}</th>
                  <th className="px-3 py-2 text-right">{t.tableRealizedVolume}</th>
                  <th className="px-3 py-2 text-right">{t.tableDiffVolumePct}</th>
                  <th className="px-3 py-2">{t.tableStatus}</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((row) => (
                  <Row key={`${row.segment}|${row.productType}|${row.currency}`} row={row} t={t} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

interface RowProps {
  row: BudgetVarianceItem;
  t: ReturnType<typeof budgetTranslations>;
}

const Row: React.FC<RowProps> = ({ row, t }) => (
  <tr className="border-b border-white/5">
    <td className="px-3 py-2 text-slate-200">{row.segment}</td>
    <td className="px-3 py-2 text-slate-200">{row.productType}</td>
    <td className="px-3 py-2 font-mono text-[11px] text-slate-300">{row.currency}</td>
    <td className="px-3 py-2 text-right font-mono text-slate-200">{fmtBps(row.budgetedRateBps)}</td>
    <td className="px-3 py-2 text-right font-mono text-slate-200">{fmtBps(row.realizedRateBps)}</td>
    <td className="px-3 py-2 text-right font-mono text-slate-300">{fmtBps(row.diffRateBps)}</td>
    <td className="px-3 py-2 text-right font-mono text-slate-300">{fmtEur(row.budgetedVolumeEur)}</td>
    <td className="px-3 py-2 text-right font-mono text-slate-300">{fmtEur(row.realizedVolumeEur)}</td>
    <td className="px-3 py-2 text-right font-mono text-slate-300">{fmtPct(row.diffVolumePct)}</td>
    <td className="px-3 py-2">
      <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${STATUS_CLASSES[row.status]}`}>
        {statusLabel(row.status, t)}
      </span>
    </td>
  </tr>
);

interface StatProps { label: string; value: string }
const Stat: React.FC<StatProps> = ({ label, value }) => (
  <div className="rounded-md border border-white/5 bg-slate-900/40 px-4 py-3">
    <div className="font-mono text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
    <div className="font-mono text-lg font-semibold text-white">{value}</div>
  </div>
);

interface NumberFieldProps {
  label: string;
  value: string | number;
  type?: 'number' | 'month';
  min?: number;
  step?: number;
  onChange: (value: string) => void;
}

const NumberField: React.FC<NumberFieldProps> = ({ label, value, type = 'number', min, step, onChange }) => (
  <label className="block">
    <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
    <input
      type={type}
      value={value}
      min={min}
      step={step}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 w-32 rounded border border-white/10 bg-slate-900/60 px-2 py-1 text-xs text-slate-100"
    />
  </label>
);

export default BudgetReconciliationView;
