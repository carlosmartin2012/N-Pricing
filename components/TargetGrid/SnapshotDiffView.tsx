import React, { useState, useMemo } from 'react';
import { Filter } from 'lucide-react';
import type { MethodologySnapshot, GridDiff } from '../../types';
import { useSnapshotDiffQuery } from '../../hooks/queries/useTargetGridQueries';
import { useUI } from '../../contexts/UIContext';
import SnapshotSelector from './SnapshotSelector';

interface Props {
  snapshots: MethodologySnapshot[];
}

function fmtDiffBps(value: number): string {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}bp`;
}

function fmtDiffPp(value: number): string {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}pp`;
}

function diffColor(value: number, positive: 'good' | 'bad' = 'good'): string {
  if (Math.abs(value) < 0.01) return 'text-[color:var(--nfq-text-muted)]';
  const isGreen = positive === 'good' ? value > 0 : value < 0;
  return isGreen ? 'text-[var(--nfq-success)]' : 'text-[var(--nfq-danger)]';
}

const SnapshotDiffView: React.FC<Props> = ({ snapshots }) => {
  const { t } = useUI();

  const [fromId, setFromId] = useState<string>(
    snapshots.length >= 2 ? snapshots[1].id : snapshots[0]?.id ?? '',
  );
  const [toId, setToId] = useState<string>(
    snapshots.find((s) => s.isCurrent)?.id ?? snapshots[0]?.id ?? '',
  );
  const [onlySignificant, setOnlySignificant] = useState(false);

  const { data: diffs, isLoading } = useSnapshotDiffQuery(fromId, toId);

  const filtered = useMemo(() => {
    if (!diffs) return [];
    if (!onlySignificant) return diffs;
    return diffs.filter((d: GridDiff) => d.isSignificant);
  }, [diffs, onlySignificant]);

  return (
    <div className="flex flex-col gap-4">
      {/* Selectors */}
      <div className="flex flex-wrap items-center gap-4">
        <SnapshotSelector
          snapshots={snapshots}
          selectedId={fromId}
          onSelect={setFromId}
          compareMode
          compareId={toId}
          onCompareSelect={setToId}
        />

        <button
          onClick={() => setOnlySignificant((v) => !v)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
            onlySignificant
              ? 'bg-[var(--nfq-accent)]/20 text-[var(--nfq-accent)]'
              : 'bg-[var(--nfq-bg-elevated)] text-[color:var(--nfq-text-muted)] hover:text-[color:var(--nfq-text-primary)]'
          }`}
        >
          <Filter size={10} />
          Significant only
        </button>

        <span className="ml-auto text-[10px] font-mono uppercase tracking-widest text-[color:var(--nfq-text-muted)]">
          {filtered.length} {filtered.length === 1 ? 'change' : 'changes'}
        </span>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col gap-3 rounded-[24px] bg-[var(--nfq-bg-surface)] p-5">
          <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--nfq-bg-elevated)]" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-11 w-full animate-pulse rounded-lg bg-[var(--nfq-bg-elevated)]" />
          ))}
        </div>
      )}

      {/* Same snapshot warning */}
      {fromId === toId && !isLoading && (
        <div className="rounded-[22px] bg-[var(--nfq-bg-surface)] px-6 py-12 text-center text-sm text-[color:var(--nfq-text-muted)]">
          Select two different snapshots to compare.
        </div>
      )}

      {/* Diff table */}
      {!isLoading && fromId !== toId && (
        <div className="overflow-auto rounded-[22px] bg-[var(--nfq-bg-surface)]">
          <table className="w-full min-w-[680px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-[var(--nfq-bg-elevated)]">
              <tr>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--nfq-text-muted)]">
                  {t.productType ?? 'Product'}
                </th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--nfq-text-muted)]">
                  Segment
                </th>
                <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--nfq-text-muted)]">
                  Tenor
                </th>
                <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--nfq-text-muted)]">
                  {t.currency}
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--nfq-text-muted)]">
                  FTP diff
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--nfq-text-muted)]">
                  Margin diff
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--nfq-text-muted)]">
                  RAROC diff
                </th>
                <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--nfq-text-muted)]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d: GridDiff, idx: number) => (
                <tr
                  key={`${d.product}-${d.segment}-${d.tenorBucket}-${d.currency}-${idx}`}
                  className="transition-colors hover:bg-[var(--nfq-bg-elevated)] even:bg-[var(--nfq-bg-surface)] odd:bg-[var(--nfq-bg-root)]"
                >
                  <td className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-xs font-bold text-[color:var(--nfq-text-primary)]">
                    {d.product}
                  </td>
                  <td className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-xs text-[color:var(--nfq-text-secondary)]">
                    {d.segment}
                  </td>
                  <td className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-center font-mono text-xs text-[color:var(--nfq-text-tertiary)] [font-variant-numeric:tabular-nums]">
                    {d.tenorBucket}
                  </td>
                  <td className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-center text-xs text-[color:var(--nfq-text-secondary)]">
                    {d.currency}
                  </td>
                  <td className={`whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono text-xs font-bold [font-variant-numeric:tabular-nums] ${diffColor(d.ftpDiffBps, 'bad')}`}>
                    {fmtDiffBps(d.ftpDiffBps)}
                  </td>
                  <td className={`whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono text-xs font-bold [font-variant-numeric:tabular-nums] ${diffColor(d.marginDiffBps)}`}>
                    {fmtDiffBps(d.marginDiffBps)}
                  </td>
                  <td className={`whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono text-xs font-bold [font-variant-numeric:tabular-nums] ${diffColor(d.rarocDiffPp)}`}>
                    {fmtDiffPp(d.rarocDiffPp)}
                  </td>
                  <td className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-center">
                    {d.isNew && (
                      <span className="rounded-full bg-[var(--nfq-info)]/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--nfq-info)]">
                        New
                      </span>
                    )}
                    {d.isRemoved && (
                      <span className="rounded-full bg-[var(--nfq-danger)]/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--nfq-danger)]">
                        Removed
                      </span>
                    )}
                    {!d.isNew && !d.isRemoved && d.isSignificant && (
                      <span className="rounded-full bg-[var(--nfq-warning)]/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--nfq-warning)]">
                        Changed
                      </span>
                    )}
                    {!d.isNew && !d.isRemoved && !d.isSignificant && (
                      <span className="text-[9px] text-[color:var(--nfq-text-faint)]">&mdash;</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-sm text-[color:var(--nfq-text-muted)]">
                    {onlySignificant
                      ? 'No significant changes between these snapshots.'
                      : 'No differences found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SnapshotDiffView;
