import React from 'react';
import { X, Layers } from 'lucide-react';
import { useCohortBreakdownQuery } from '../../hooks/queries/useDisciplineQueries';
import type { Cohort, DateRange } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  cohort: Cohort | null;
  dateRange: DateRange;
}

function fmtBps(value: number | null): string {
  if (value == null) return '-';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)} bps`;
}

function fmtEur(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function fmtPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

const CohortDrilldownModal: React.FC<Props> = ({ isOpen, onClose, cohort, dateRange }) => {
  const { data: breakdown, isLoading } = useCohortBreakdownQuery(
    cohort ?? { product: '', segment: '', tenorBucket: '0-1Y', currency: '' },
    dateRange,
  );

  if (!isOpen || !cohort) return null;

  const cohortLabel = `${cohort.product} x ${cohort.segment} x ${cohort.tenorBucket} x ${cohort.currency}`;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/55 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Cohort drilldown: ${cohortLabel}`}
        className="fixed inset-x-4 top-[10%] z-50 mx-auto max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-[22px] border border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] shadow-[var(--nfq-shadow-dialog)] md:inset-x-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-[var(--nfq-bg-elevated)] px-6 py-5">
          <div className="min-w-0">
            <div className="nfq-eyebrow">Cohort Drilldown</div>
            <h2 className="mt-3 flex items-center gap-2 text-lg font-semibold tracking-[var(--nfq-tracking-snug)] text-[color:var(--nfq-text-primary)]">
              <Layers size={18} className="shrink-0 text-cyan-400" />
              <span className="truncate">{cohortLabel}</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-[color:var(--nfq-text-muted)] transition-colors hover:bg-[var(--nfq-bg-surface)] hover:text-[color:var(--nfq-text-primary)]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-auto p-6" style={{ maxHeight: 'calc(80vh - 88px)' }}>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-500" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-[color:var(--nfq-text-muted)]">
                Loading cohort data...
              </span>
            </div>
          ) : breakdown ? (
            <>
              {/* Summary stats */}
              <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="nfq-kpi-card">
                  <div className="nfq-kpi-label mb-1">Deals</div>
                  <div className="nfq-kpi-value text-xl text-cyan-400">{breakdown.dealCount}</div>
                </div>
                <div className="nfq-kpi-card">
                  <div className="nfq-kpi-label mb-1">In-Band</div>
                  <div className={`nfq-kpi-value text-xl ${breakdown.inBandPct >= 90 ? 'text-emerald-400' : breakdown.inBandPct >= 75 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {fmtPct(breakdown.inBandPct)}
                  </div>
                </div>
                <div className="nfq-kpi-card">
                  <div className="nfq-kpi-label mb-1">Avg FTP Var</div>
                  <div className="nfq-kpi-value text-xl text-violet-400">
                    {fmtBps(breakdown.avgFtpVarianceBps)}
                  </div>
                </div>
                <div className="nfq-kpi-card">
                  <div className="nfq-kpi-label mb-1">Total Leakage</div>
                  <div className={`nfq-kpi-value text-xl ${breakdown.totalLeakageEur > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {fmtEur(breakdown.totalLeakageEur)}
                  </div>
                </div>
              </div>

              {/* Top outlier deals */}
              {breakdown.topOutlierDealIds.length > 0 && (
                <div>
                  <h3 className="nfq-kpi-label mb-3">Top Outlier Deal IDs</h3>
                  <div className="flex flex-wrap gap-2">
                    {breakdown.topOutlierDealIds.map((id) => (
                      <span
                        key={id}
                        className="rounded bg-rose-950/30 px-2 py-1 font-mono text-[10px] text-rose-400"
                      >
                        {id.slice(0, 12)}...
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center text-xs text-[color:var(--nfq-text-muted)]">
              No data available for this cohort
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CohortDrilldownModal;
