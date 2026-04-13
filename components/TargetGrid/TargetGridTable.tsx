import React, { useRef, useMemo, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowUpDown, Search } from 'lucide-react';
import type { TargetGridCell } from '../../types';
import { useUI } from '../../contexts/UIContext';

type SortKey = 'product' | 'segment' | 'tenorBucket' | 'currency' | 'ftp' | 'targetMargin' | 'targetClientRate' | 'targetRaroc';
type SortDir = 'asc' | 'desc';

interface Props {
  cells: TargetGridCell[];
  onCellSelect: (cell: TargetGridCell) => void;
  isLoading: boolean;
}

const VIRTUAL_THRESHOLD = 40;
const ROW_HEIGHT = 44;

const TENOR_ORDER: Record<string, number> = {
  '0-1Y': 0,
  '1-3Y': 1,
  '3-5Y': 2,
  '5-10Y': 3,
  '10Y+': 4,
};

function formatRate(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatBps(value: number): string {
  return `${Math.round(value * 10000)}bp`;
}

function formatRaroc(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function rarocColor(value: number): string {
  const pct = value * 100;
  if (pct >= 12) return 'text-[var(--nfq-success)]';
  if (pct >= 8) return 'text-[var(--nfq-warning)]';
  return 'text-[var(--nfq-danger)]';
}

const COLUMNS: { key: SortKey; label: string; align?: string }[] = [
  { key: 'product', label: 'Product' },
  { key: 'segment', label: 'Segment' },
  { key: 'tenorBucket', label: 'Tenor' },
  { key: 'currency', label: 'Currency' },
  { key: 'ftp', label: 'FTP', align: 'right' },
  { key: 'targetMargin', label: 'Margin', align: 'right' },
  { key: 'targetClientRate', label: 'Client Rate', align: 'right' },
  { key: 'targetRaroc', label: 'RAROC', align: 'right' },
];

const TargetGridTable: React.FC<Props> = ({ cells, onCellSelect, isLoading }) => {
  const { t } = useUI();
  const parentRef = useRef<HTMLDivElement>(null);
  const [sortKey, setSortKey] = useState<SortKey>('product');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [search, setSearch] = useState('');

  const handleSort = useCallback((key: SortKey) => {
    setSortDir((prev) => (sortKey === key ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'));
    setSortKey(key);
  }, [sortKey]);

  const filtered = useMemo(() => {
    if (!search.trim()) return cells;
    const q = search.toLowerCase();
    return cells.filter(
      (c) =>
        c.product.toLowerCase().includes(q) ||
        c.segment.toLowerCase().includes(q) ||
        c.tenorBucket.toLowerCase().includes(q) ||
        c.currency.toLowerCase().includes(q),
    );
  }, [cells, search]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let cmp: number;
      if (sortKey === 'tenorBucket') {
        cmp = (TENOR_ORDER[a.tenorBucket] ?? 99) - (TENOR_ORDER[b.tenorBucket] ?? 99);
      } else {
        const va = a[sortKey];
        const vb = b[sortKey];
        if (typeof va === 'number' && typeof vb === 'number') {
          cmp = va - vb;
        } else {
          cmp = String(va).localeCompare(String(vb));
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const useVirtual = sorted.length > VIRTUAL_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    enabled: useVirtual,
  });

  const renderRow = (cell: TargetGridCell, style?: React.CSSProperties) => (
    <tr
      key={cell.id}
      style={style}
      onClick={() => onCellSelect(cell)}
      className="group cursor-pointer transition-colors hover:bg-[var(--nfq-bg-elevated)] even:bg-[var(--nfq-bg-surface)] odd:bg-[var(--nfq-bg-root)]"
    >
      <td className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-xs font-bold text-[color:var(--nfq-text-primary)]">
        {cell.product}
      </td>
      <td className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-xs text-[color:var(--nfq-text-secondary)]">
        {cell.segment}
      </td>
      <td className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-center font-mono text-xs text-[color:var(--nfq-text-tertiary)] [font-variant-numeric:tabular-nums]">
        {cell.tenorBucket}
      </td>
      <td className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-center text-xs font-semibold text-[color:var(--nfq-text-secondary)]">
        {cell.currency}
      </td>
      <td className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono text-xs text-[color:var(--nfq-text-secondary)] [font-variant-numeric:tabular-nums]">
        {formatBps(cell.ftp)}
      </td>
      <td className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono text-xs text-[var(--nfq-success)] [font-variant-numeric:tabular-nums]">
        +{formatRate(cell.targetMargin)}
      </td>
      <td className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono text-xs font-bold text-[var(--nfq-accent)] [font-variant-numeric:tabular-nums]">
        {formatRate(cell.targetClientRate)}
      </td>
      <td className={`whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono text-xs font-bold [font-variant-numeric:tabular-nums] ${rarocColor(cell.targetRaroc)}`}>
        {formatRaroc(cell.targetRaroc)}
      </td>
    </tr>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 rounded-[24px] bg-[var(--nfq-bg-surface)] p-5">
        <div className="flex items-center gap-3">
          <div className="h-9 w-64 animate-pulse rounded-lg bg-[var(--nfq-bg-elevated)]" />
        </div>
        <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--nfq-bg-elevated)]" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-11 w-full animate-pulse rounded-lg bg-[var(--nfq-bg-elevated)]" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--nfq-text-muted)]" />
          <input
            type="text"
            placeholder={'Search cells...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="nfq-input w-full pl-9 pr-3 py-2 text-xs"
          />
        </div>
        <span className="text-[10px] font-mono uppercase tracking-widest text-[color:var(--nfq-text-muted)]">
          {sorted.length} {sorted.length === 1 ? 'cell' : 'cells'}
        </span>
      </div>

      {/* Table */}
      <div
        ref={parentRef}
        className="overflow-auto rounded-[22px] bg-[var(--nfq-bg-surface)]"
        style={useVirtual ? { maxHeight: 600 } : undefined}
      >
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-[var(--nfq-bg-elevated)]">
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`cursor-pointer select-none whitespace-nowrap px-4 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--nfq-text-muted)] transition-colors hover:text-[color:var(--nfq-text-primary)] ${col.align === 'right' ? 'text-right' : ''}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    <ArrowUpDown
                      size={10}
                      className={sortKey === col.key ? 'text-[var(--nfq-accent)]' : 'opacity-30'}
                    />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {useVirtual ? (
              <>
                {virtualizer.getVirtualItems().length > 0 && (
                  <tr>
                    <td
                      colSpan={COLUMNS.length}
                      style={{ height: virtualizer.getVirtualItems()[0].start, padding: 0 }}
                    />
                  </tr>
                )}
                {virtualizer.getVirtualItems().map((vRow) =>
                  renderRow(sorted[vRow.index], { height: ROW_HEIGHT }),
                )}
                {virtualizer.getVirtualItems().length > 0 && (
                  <tr>
                    <td
                      colSpan={COLUMNS.length}
                      style={{
                        height:
                          virtualizer.getTotalSize() -
                          (virtualizer.getVirtualItems().at(-1)?.end ?? 0),
                        padding: 0,
                      }}
                    />
                  </tr>
                )}
              </>
            ) : (
              sorted.map((cell) => renderRow(cell))
            )}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="flex items-center justify-center py-16 text-sm text-[color:var(--nfq-text-muted)]">
            {search ? 'No cells match your search.' : 'No target grid cells available.'}
          </div>
        )}
      </div>
    </div>
  );
};

export default TargetGridTable;
