import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowUpRight, Check, Download, Filter, GitPullRequestArrow,
  Pause, Play, Tag, TrendingUp,
} from 'lucide-react';
import { usePipelineNbaQuery, useConsumeNbaPipeline } from '../../hooks/queries/useClvQueries';
import { useEntity } from '../../contexts/EntityContext';
import { useUI } from '../../contexts/UIContext';
import { clvTranslations } from '../../translations/index';
import type { NbaReasonCode, PipelineNbaRow, PipelineStatusFilter } from '../../types/clv';
import { pipelineCsvFilename, pipelineRowsToCsv } from './pipelineCsv';

/**
 * /pipeline — firmwide NBA feed.
 *
 * The RM's landing page for "what actions need my attention across the
 * book today". Uses the cross-client endpoint `/api/clv/nba` so it only
 * makes one HTTP round trip regardless of how many clients have NBAs.
 *
 * Polish added 2026-04-23:
 *   - Bulk selection (checkboxes) + bulk consume.
 *   - Export visible feed to CSV (RFC 4180, pure module pipelineCsv.ts).
 *   - Auto-refresh toggle — opt-in 30s polling via refetchInterval.
 *
 * Design trade-offs:
 *   - Selection stored in a Set<string> (O(1) toggle) instead of array.
 *   - Auto-refresh is opt-in so the RM's focus is not interrupted.
 *   - Bulk consume fires sequential mutations so we get per-row feedback
 *     + invalidation, not a single atomic server call. Tradeoff: slower
 *     for 50+ rows, but N is bounded by what the pipeline shows (max 500)
 *     and user rarely selects > 10.
 */

const REASON_LABEL: Record<NbaReasonCode, string> = {
  share_of_wallet_low: 'SoW low',
  renewal_window_open: 'Renewal open',
  nim_below_target: 'NIM below target',
  product_gap_core: 'Core gap',
  cross_sell_cohort_signal: 'Crosssell cohort',
  churn_signal_detected: 'Churn signal',
  price_above_market: 'Price above market',
  capacity_underused: 'Capacity under',
  regulatory_incentive_available: 'Reg incentive',
};

const fmtEur = (v: number | null): string =>
  v === null ? '—' : new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(v);
const fmtPct = (v: number | null): string => v === null ? '—' : `${(v * 100).toFixed(0)}%`;
const fmtBps = (v: number | null): string => v === null ? '—' : `${v.toFixed(0)} bps`;

type ConfidenceBand = 'all' | 'high' | 'medium' | 'low';
const CONFIDENCE_MIN: Record<ConfidenceBand, number> = { all: 0, low: 0, medium: 0.6, high: 0.8 };
const CONFIDENCE_MAX: Record<ConfidenceBand, number> = { all: 1, low: 0.6, medium: 0.8, high: 1 };

const AUTO_REFRESH_MS = 30_000;

function downloadBlobFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const PipelineView: React.FC = () => {
  const navigate = useNavigate();
  const { activeEntity } = useEntity();
  const { language } = useUI();
  const t = clvTranslations(language);
  const [status, setStatus] = useState<PipelineStatusFilter>('open');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [confidenceBand, setConfidenceBand] = useState<ConfidenceBand>('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const consume = useConsumeNbaPipeline();

  const { data: rows = [], isLoading } = usePipelineNbaQuery(
    status,
    autoRefresh ? AUTO_REFRESH_MS : 0,
  );

  const products = useMemo(
    () => Array.from(new Set(rows.map((r) => r.recommendedProduct))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const min = CONFIDENCE_MIN[confidenceBand];
    const max = CONFIDENCE_MAX[confidenceBand];
    return rows.filter((r) => {
      if (productFilter !== 'all' && r.recommendedProduct !== productFilter) return false;
      if (r.confidence < min || r.confidence >= max + 0.0001) return false;
      return true;
    });
  }, [rows, productFilter, confidenceBand]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) =>
      b.expectedClvDeltaEur - a.expectedClvDeltaEur || b.confidence - a.confidence,
    ),
    [filtered],
  );

  const kpis = useMemo(() => {
    const totalDelta = sorted.reduce((s, r) => s + r.expectedClvDeltaEur, 0);
    const uniqueClients = new Set(sorted.map((r) => r.clientId)).size;
    const avgConfidence = sorted.length === 0
      ? 0
      : sorted.reduce((s, r) => s + r.confidence, 0) / sorted.length;
    return { totalDelta, uniqueClients, avgConfidence, count: sorted.length };
  }, [sorted]);

  // Drop selected ids that no longer appear in the visible (filtered) set —
  // otherwise a filter change could leave phantom selections. Keyed on the
  // concatenated id sequence so we only run this when the visible set
  // actually shifts.
  const visibleIdsKey = useMemo(() => sorted.map((r) => r.id).join('|'), [sorted]);
  React.useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(sorted.map((r) => r.id));
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (visible.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleIdsKey]);

  const toggleSelection = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelected(new Set(sorted.map((r) => r.id)));
  }, [sorted]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const bulkConsume = useCallback(async () => {
    const ids = Array.from(selected);
    for (const id of ids) {
      await consume.mutateAsync(id).catch(() => undefined);
    }
    setSelected(new Set());
  }, [consume, selected]);

  const exportCsv = useCallback(() => {
    const csv = pipelineRowsToCsv(sorted);
    downloadBlobFile(pipelineCsvFilename(status), csv);
  }, [sorted, status]);

  const hasSelection = selected.size > 0;
  const allVisibleSelected = sorted.length > 0 && selected.size === sorted.length;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <GitPullRequestArrow className="h-5 w-5 text-emerald-400" />
          <h2 className="font-mono text-sm font-bold uppercase tracking-tight text-white">
            Pipeline
          </h2>
          {activeEntity && (
            <span className="nfq-label text-[10px] text-slate-400">
              {activeEntity.shortCode}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoRefresh((x) => !x)}
            aria-pressed={autoRefresh}
            data-testid="pipeline-auto-refresh"
            className={`nfq-btn-ghost flex items-center gap-1.5 px-3 py-1 text-[10px] ${
              autoRefresh ? 'ring-1 ring-emerald-400/40' : ''
            }`}
          >
            {autoRefresh ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {autoRefresh ? 'Auto-refresh: on' : 'Auto-refresh: off'}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={sorted.length === 0}
            data-testid="pipeline-export-csv"
            className="nfq-btn-ghost flex items-center gap-1.5 px-3 py-1 text-[10px] disabled:opacity-60"
          >
            <Download className="h-3 w-3" />
            Export CSV
          </button>
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.02] p-1">
            {(['open', 'consumed', 'all'] as PipelineStatusFilter[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                aria-pressed={status === s}
                data-testid={`pipeline-status-${s}`}
                className={`rounded-md px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  status === s
                    ? 'bg-white/[0.08] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile label="Recommendations"      value={String(kpis.count)}         tone="sky" />
        <KpiTile label="Clients covered"      value={String(kpis.uniqueClients)} tone="amber" />
        <KpiTile label="Total expected ΔCLV"  value={fmtEur(kpis.totalDelta)}    tone="emerald" />
        <KpiTile label="Avg confidence"       value={fmtPct(kpis.avgConfidence)} tone="violet" />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-3 w-3 text-slate-400" />
        <label className="nfq-label text-[10px] text-slate-400">Product</label>
        <select
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          data-testid="pipeline-filter-product"
          className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-1 font-mono text-[11px] text-slate-200"
        >
          <option value="all">All</option>
          {products.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <label className="nfq-label text-[10px] text-slate-400 ml-3">Confidence</label>
        <select
          value={confidenceBand}
          onChange={(e) => setConfidenceBand(e.target.value as ConfidenceBand)}
          data-testid="pipeline-filter-confidence"
          className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-1 font-mono text-[11px] text-slate-200"
        >
          <option value="all">All</option>
          <option value="high">High (≥80%)</option>
          <option value="medium">Medium (60-80%)</option>
          <option value="low">Low (&lt;60%)</option>
        </select>
      </div>

      {hasSelection && (
        <div
          data-testid="pipeline-bulk-bar"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/[0.04] p-3"
        >
          <span className="font-mono text-[11px] text-emerald-200">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearSelection}
              data-testid="pipeline-bulk-clear"
              className="nfq-btn-ghost px-3 py-1 text-[10px]"
            >
              Clear
            </button>
            {status !== 'consumed' && (
              <button
                type="button"
                onClick={bulkConsume}
                disabled={consume.isPending}
                data-testid="pipeline-bulk-consume"
                className="nfq-btn-primary flex items-center gap-1.5 px-3 py-1 text-[10px] disabled:opacity-60"
              >
                <Check className="h-3 w-3" />
                Mark {selected.size} consumed
              </button>
            )}
          </div>
        </div>
      )}

      {sorted.length > 0 && (
        <label className="flex items-center gap-2 font-mono text-[10px] text-slate-400">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={(e) => (e.target.checked ? selectAllVisible() : clearSelection())}
            data-testid="pipeline-select-all"
            className="h-3 w-3"
          />
          Select all visible ({sorted.length})
        </label>
      )}

      {!isLoading && sorted.length === 0 && (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-8 text-center text-xs text-slate-400">
          {t.clvNbaEmpty}
        </div>
      )}

      <ul className="space-y-2" data-testid="pipeline-feed">
        {sorted.map((r) => (
          <PipelineRow
            key={r.id}
            row={r}
            status={status}
            selected={selected.has(r.id)}
            onToggleSelect={() => toggleSelection(r.id)}
            onOpenClient={() => navigate(`/customers?id=${encodeURIComponent(r.clientId)}`)}
            onConsume={() => consume.mutate(r.id)}
            consumeBusy={consume.isPending && consume.variables === r.id}
          />
        ))}
      </ul>
    </div>
  );
};

const KpiTile: React.FC<{ label: string; value: string; tone: 'sky' | 'amber' | 'emerald' | 'violet' }> = ({ label, value, tone }) => {
  const toneClass = {
    sky:      'text-sky-300',
    amber:    'text-amber-300',
    emerald:  'text-emerald-300',
    violet:   'text-violet-300',
  }[tone];
  return (
    <div className="rounded border border-white/5 bg-white/[0.02] p-3">
      <div className="nfq-label text-[9px] text-slate-400">{label}</div>
      <div className={`mt-1 font-mono text-sm font-bold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
};

interface RowProps {
  row: PipelineNbaRow;
  status: PipelineStatusFilter;
  selected: boolean;
  onToggleSelect: () => void;
  onOpenClient: () => void;
  onConsume: () => void;
  consumeBusy: boolean;
}

const PipelineRow: React.FC<RowProps> = ({
  row, status, selected, onToggleSelect,
  onOpenClient, onConsume, consumeBusy,
}) => {
  return (
    <li
      data-testid={`pipeline-row-${row.id}`}
      className={`rounded border p-3 space-y-2 transition-colors ${
        selected
          ? 'border-emerald-400/40 bg-emerald-500/[0.04]'
          : 'border-white/5 bg-white/[0.03]'
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Select recommendation for ${row.clientName}`}
          data-testid={`pipeline-row-select-${row.id}`}
          className="mt-1 h-3 w-3 shrink-0"
        />
        <div className="flex-1 flex items-start justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Tag className="h-3 w-3 text-violet-300 shrink-0" />
              <span className="font-mono text-sm font-bold text-white truncate">
                {row.clientName}
              </span>
              {row.clientSegment && (
                <span className="font-mono text-[9px] text-slate-500">
                  · {row.clientSegment} · {row.clientRating ?? 'BBB'}
                </span>
              )}
            </div>
            <div className="mt-1 font-mono text-[11px] text-slate-300">
              {row.recommendedProduct}
              <span className="text-slate-500"> · {fmtEur(row.recommendedVolumeEur)} · {fmtBps(row.recommendedRateBps)}</span>
            </div>
            {row.rationale && (
              <p className="mt-1 text-[11px] text-slate-400">{row.rationale}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-center justify-end gap-1 font-mono text-sm font-bold text-emerald-300">
              <TrendingUp className="h-3 w-3" />
              +{fmtEur(row.expectedClvDeltaEur)}
            </div>
            <div className="font-mono text-[10px] text-slate-500">
              conf. {fmtPct(row.confidence)}
            </div>
          </div>
        </div>
      </div>

      {row.reasonCodes.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-6">
          {row.reasonCodes.map((code) => (
            <span key={code} className="rounded bg-white/[0.05] px-2 py-0.5 font-mono text-[9px] text-slate-300">
              {REASON_LABEL[code] ?? code}
            </span>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2 pl-6">
        <button
          type="button"
          onClick={onOpenClient}
          data-testid={`pipeline-row-open-${row.id}`}
          className="nfq-btn-ghost flex items-center gap-1.5 px-3 py-1 text-[10px]"
        >
          Open client <ArrowUpRight className="h-3 w-3" />
        </button>
        {status !== 'consumed' && row.consumedAt === null && (
          <button
            type="button"
            onClick={onConsume}
            disabled={consumeBusy}
            data-testid={`pipeline-row-consume-${row.id}`}
            className="nfq-btn-ghost flex items-center gap-1.5 px-3 py-1 text-[10px] disabled:opacity-60"
          >
            <Check className="h-3 w-3" />
            Mark consumed
          </button>
        )}
      </div>
    </li>
  );
};

export default PipelineView;
