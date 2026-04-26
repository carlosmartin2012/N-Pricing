import React from 'react';
import { Link } from 'react-router';
import { LayoutDashboard, ArrowUpRight, CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * FTP Ledger — summary card (Phase 6.7).
 *
 * Lives inside the Analytics Overview dashboard. Serves two purposes:
 *
 *   1. Preserve the didactic value of the (demoted) Accounting Ledger
 *      screen — the "FTP accounting mirror" idea is still worth showing,
 *      but not as a top-level view. A single card in the Overview tells
 *      the story without taking a sidebar slot.
 *
 *   2. Provide a deep-link to /accounting for power users who need the
 *      full journal + T-accounts breakdown. Matches the ⌘K entry added
 *      when ACCOUNTING was moved to AUX.
 *
 * Data-agnostic on purpose: the parent computes numbers (FTP income MTD,
 * deals priced count, reconciliation status) from whatever source is
 * available. This lets us reuse the card in future dashboards (e.g.
 * Controller-focused /reconciliation view) without duplicating fetch
 * logic. Pattern: container calcula, componente pinta.
 */

export type ReconciliationStatus = 'ok' | 'mismatches' | 'unknown';

export interface FtpLedgerSummary {
  /** FTP income booked month-to-date (reporting currency). */
  ftpIncomeMtdEur: number;
  /** Number of deals that hit the FTP ledger this month. */
  dealsLedgerizedMtd: number;
  /** Average transfer rate across the ledger (%). */
  avgTransferRatePct: number;
  /** Delta vs previous month (%). */
  mtdGrowthPct: number;
  /** Status of the BU ↔ Treasury reconciliation. */
  reconciliationStatus: ReconciliationStatus;
  /** Number of unmatched entries (mismatches variant). */
  unmatchedCount?: number;
}

interface Props {
  summary: FtpLedgerSummary;
  title?: string;
  linkLabel?: string;
  linkTo?: string;
}

const fmtEur = (v: number): string =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
const fmtPct = (v: number, digits = 1): string => `${v.toFixed(digits)}%`;

const STATUS_CONFIG: Record<ReconciliationStatus, { icon: React.ComponentType<{ className?: string }>; tone: string; label: string }> = {
  ok:         { icon: CheckCircle2, tone: 'text-emerald-300', label: 'Reconciled' },
  mismatches: { icon: AlertCircle,  tone: 'text-amber-300',   label: 'Mismatches' },
  unknown:    { icon: AlertCircle,  tone: 'text-slate-400',   label: 'Unknown' },
};

const FtpLedgerSummaryCard: React.FC<Props> = ({
  summary,
  title = 'FTP Ledger — this month',
  linkLabel = 'Open full ledger',
  linkTo = '/reconciliation',
}) => {
  const statusCfg = STATUS_CONFIG[summary.reconciliationStatus];
  const StatusIcon = statusCfg.icon;
  const growthPositive = summary.mtdGrowthPct >= 0;

  return (
    <section
      data-testid="ftp-ledger-summary-card"
      className="rounded-lg border border-white/5 bg-white/[0.02] p-5 md:p-6 space-y-4"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-4 w-4 text-amber-400" />
          <h3 className="font-mono text-xs font-medium text-white">
            {title}
          </h3>
        </div>
        <Link
          to={linkTo}
          data-testid="ftp-ledger-summary-link"
          className="nfq-btn-ghost flex items-center gap-1.5 px-3 py-1 text-[10px]"
        >
          {linkLabel}
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </header>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded border border-white/5 bg-white/[0.02] p-3">
          <dt className="nfq-label text-[9px] text-slate-400">FTP income (MTD)</dt>
          <dd className="mt-1 font-mono text-base font-bold tabular-nums text-emerald-300">
            {fmtEur(summary.ftpIncomeMtdEur)}
          </dd>
          <p className={`font-mono text-[10px] ${growthPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {growthPositive ? '+' : ''}{fmtPct(summary.mtdGrowthPct)} vs last month
          </p>
        </div>

        <div className="rounded border border-white/5 bg-white/[0.02] p-3">
          <dt className="nfq-label text-[9px] text-slate-400">Deals ledgerized</dt>
          <dd className="mt-1 font-mono text-base font-bold tabular-nums text-slate-100">
            {summary.dealsLedgerizedMtd}
          </dd>
          <p className="font-mono text-[10px] text-slate-500">entries posted</p>
        </div>

        <div className="rounded border border-white/5 bg-white/[0.02] p-3">
          <dt className="nfq-label text-[9px] text-slate-400">Avg transfer rate</dt>
          <dd className="mt-1 font-mono text-base font-bold tabular-nums text-amber-300">
            {fmtPct(summary.avgTransferRatePct, 2)}
          </dd>
          <p className="font-mono text-[10px] text-slate-500">portfolio weighted</p>
        </div>

        <div className="rounded border border-white/5 bg-white/[0.02] p-3">
          <dt className="nfq-label text-[9px] text-slate-400">Reconciliation</dt>
          <dd className={`mt-1 flex items-center gap-1.5 font-mono text-sm font-bold ${statusCfg.tone}`}>
            <StatusIcon className="h-4 w-4" />
            {statusCfg.label}
          </dd>
          <p className="font-mono text-[10px] text-slate-500">
            {summary.reconciliationStatus === 'mismatches' && summary.unmatchedCount !== undefined
              ? `${summary.unmatchedCount} unmatched`
              : 'BU ↔ Treasury'}
          </p>
        </div>
      </dl>

      <p className="font-mono text-[10px] text-slate-500">
        {summary.reconciliationStatus === 'ok'
          ? 'All BU journal entries match their Treasury mirror. No intervention needed.'
          : summary.reconciliationStatus === 'mismatches'
            ? 'Some entries do not match their Treasury mirror. Open the full ledger to investigate.'
            : 'Reconciliation status not yet computed for this period.'}
      </p>
    </section>
  );
};

export default FtpLedgerSummaryCard;
