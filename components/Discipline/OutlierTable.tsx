import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import type { DealVariance } from '../../types';

interface Props {
  variances: DealVariance[];
  onDealClick?: (dealId: string) => void;
}

type SortField = 'leakage' | 'ftpVariance' | 'rarocVariance';

function fmtBps(value: number | null): string {
  if (value == null) return '-';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
}

function fmtPp(value: number | null): string {
  if (value == null) return '-';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
}

function fmtEur(value: number | null): string {
  if (value == null) return '-';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function varianceColor(bps: number | null, threshold: number): string {
  if (bps == null) return 'text-[color:var(--nfq-text-muted)]';
  const abs = Math.abs(bps);
  if (abs > threshold * 2) return 'text-rose-400';
  if (abs > threshold) return 'text-amber-400';
  return 'text-[color:var(--nfq-text-secondary)]';
}

const DEFAULT_TOP_N = 25;

const OutlierTable: React.FC<Props> = ({ variances, onDealClick }) => {
  const [sortField, setSortField] = useState<SortField>('leakage');
  const [sortAsc, setSortAsc] = useState(false);

  const outliers = useMemo(() => {
    const filtered = variances.filter((v) => v.outOfBand);
    const sorted = [...filtered].sort((a, b) => {
      let aVal = 0;
      let bVal = 0;
      switch (sortField) {
        case 'leakage':
          aVal = Math.abs(a.leakageEur ?? 0);
          bVal = Math.abs(b.leakageEur ?? 0);
          break;
        case 'ftpVariance':
          aVal = Math.abs(a.ftpVarianceBps ?? 0);
          bVal = Math.abs(b.ftpVarianceBps ?? 0);
          break;
        case 'rarocVariance':
          aVal = Math.abs(a.rarocVariancePp ?? 0);
          bVal = Math.abs(b.rarocVariancePp ?? 0);
          break;
      }
      return sortAsc ? aVal - bVal : bVal - aVal;
    });
    return sorted.slice(0, DEFAULT_TOP_N);
  }, [variances, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
    if (sortField !== field) return null;
    return sortAsc
      ? <ChevronUp size={12} className="inline ml-0.5" />
      : <ChevronDown size={12} className="inline ml-0.5" />;
  };

  const thClass = 'border-b border-[color:var(--nfq-border)] px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]';
  const tdClass = 'border-b border-[color:var(--nfq-border-ghost)] px-4 py-2';

  return (
    <div className="nfq-kpi-card p-0 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4">
        <AlertTriangle size={16} className="text-rose-400" />
        <span className="nfq-kpi-label">Outlier Deals</span>
        <span className="ml-auto text-[10px] font-mono text-[color:var(--nfq-text-muted)]">
          Top {Math.min(outliers.length, DEFAULT_TOP_N)} of {variances.filter((v) => v.outOfBand).length}
        </span>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 z-10 bg-[var(--nfq-bg-surface)]">
            <tr>
              <th className={thClass}>Deal ID</th>
              <th className={thClass}>Product</th>
              <th className={thClass}>Segment</th>
              <th className={thClass}>Tenor</th>
              <th className={thClass}>CCY</th>
              <th
                className={`${thClass} cursor-pointer hover:text-[color:var(--nfq-text-secondary)]`}
                onClick={() => handleSort('ftpVariance')}
              >
                FTP Var (bps)<SortIcon field="ftpVariance" />
              </th>
              <th
                className={`${thClass} cursor-pointer hover:text-[color:var(--nfq-text-secondary)]`}
                onClick={() => handleSort('rarocVariance')}
              >
                RAROC Var (pp)<SortIcon field="rarocVariance" />
              </th>
              <th
                className={`${thClass} cursor-pointer hover:text-[color:var(--nfq-text-secondary)]`}
                onClick={() => handleSort('leakage')}
              >
                Leakage (EUR)<SortIcon field="leakage" />
              </th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs text-[color:var(--nfq-text-secondary)]">
            {outliers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-[color:var(--nfq-text-muted)]">
                  No outlier deals found
                </td>
              </tr>
            ) : (
              outliers.map((v) => (
                <tr
                  key={v.dealId}
                  onClick={() => onDealClick?.(v.dealId)}
                  className="group cursor-pointer transition-colors even:bg-[var(--nfq-bg-surface)] odd:bg-[var(--nfq-bg-root)] hover:bg-[var(--nfq-bg-elevated)]"
                >
                  <td className={`${tdClass} text-cyan-400`}>
                    {v.dealId.slice(0, 8)}...
                  </td>
                  <td className={tdClass}>{v.cohort.product}</td>
                  <td className={tdClass}>
                    <span className="rounded bg-[var(--nfq-bg-elevated)] px-2 py-0.5 text-[10px]">
                      {v.cohort.segment}
                    </span>
                  </td>
                  <td className={tdClass}>{v.cohort.tenorBucket}</td>
                  <td className={tdClass}>{v.cohort.currency}</td>
                  <td className={`${tdClass} [font-variant-numeric:tabular-nums] ${varianceColor(v.ftpVarianceBps, 10)}`}>
                    {fmtBps(v.ftpVarianceBps)}
                  </td>
                  <td className={`${tdClass} [font-variant-numeric:tabular-nums] ${varianceColor((v.rarocVariancePp ?? 0) * 100, 10)}`}>
                    {fmtPp(v.rarocVariancePp)}
                  </td>
                  <td className={`${tdClass} [font-variant-numeric:tabular-nums] ${(v.leakageEur ?? 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {fmtEur(v.leakageEur)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OutlierTable;
