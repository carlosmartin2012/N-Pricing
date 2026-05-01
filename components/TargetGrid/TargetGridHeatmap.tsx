import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { TargetGridCell, TenorBucket } from '../../types';
import { TENOR_BUCKETS } from '../../types';

interface Props {
  cells: TargetGridCell[];
  onCellSelect: (cell: TargetGridCell) => void;
}

/**
 * Map a RAROC value (0..1) to a color on a red-yellow-green scale.
 * Red for low RAROC, yellow mid-range, green for high.
 */
function rarocToColor(value: number): string {
  const pct = value * 100;
  if (pct >= 14) return 'rgba(34,197,94,0.55)';
  if (pct >= 12) return 'rgba(34,197,94,0.35)';
  if (pct >= 10) return 'rgba(234,179,8,0.35)';
  if (pct >= 8) return 'rgba(234,179,8,0.25)';
  if (pct >= 5) return 'rgba(239,68,68,0.25)';
  return 'rgba(239,68,68,0.45)';
}

function rarocTextColor(value: number): string {
  const pct = value * 100;
  if (pct >= 12) return 'var(--nfq-success)';
  if (pct >= 8) return 'var(--nfq-warning)';
  return 'var(--nfq-danger)';
}

const TargetGridHeatmap: React.FC<Props> = ({ cells, onCellSelect }) => {
  // Derive unique products and currencies from cells
  const products = useMemo(() => [...new Set(cells.map((c) => c.product))].sort(), [cells]);
  const currencies = useMemo(() => [...new Set(cells.map((c) => c.currency))].sort(), [cells]);
  const segments = useMemo(() => [...new Set(cells.map((c) => c.segment))].sort(), [cells]);

  const [selectedProduct, setSelectedProduct] = useState<string>(products[0] ?? '');
  const [selectedCurrency, setSelectedCurrency] = useState<string>(currencies[0] ?? '');

  // Keep selections valid when cells change
  React.useEffect(() => {
    if (products.length > 0 && !products.includes(selectedProduct)) {
      setSelectedProduct(products[0]);
    }
  }, [products, selectedProduct]);

  React.useEffect(() => {
    if (currencies.length > 0 && !currencies.includes(selectedCurrency)) {
      setSelectedCurrency(currencies[0]);
    }
  }, [currencies, selectedCurrency]);

  // Build a lookup: segment -> tenorBucket -> cell
  const matrix = useMemo(() => {
    const filtered = cells.filter(
      (c) => c.product === selectedProduct && c.currency === selectedCurrency,
    );
    const map = new Map<string, Map<TenorBucket, TargetGridCell>>();
    for (const cell of filtered) {
      if (!map.has(cell.segment)) map.set(cell.segment, new Map());
      map.get(cell.segment)!.set(cell.tenorBucket, cell);
    }
    return map;
  }, [cells, selectedProduct, selectedCurrency]);

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Product selector */}
        <div className="relative">
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            className="nfq-input appearance-none pr-8 py-2 text-xs font-semibold"
          >
            {products.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--nfq-text-muted)]" />
        </div>

        {/* Currency selector */}
        <div className="relative">
          <select
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value)}
            className="nfq-input appearance-none pr-8 py-2 text-xs font-semibold"
          >
            {currencies.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--nfq-text-muted)]" />
        </div>

        {/* Legend */}
        <div className="ml-auto flex items-center gap-2 text-[10px] text-[color:var(--nfq-text-muted)]">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded" style={{ background: 'rgba(239,68,68,0.45)' }} />
            {'Low'}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded" style={{ background: 'rgba(234,179,8,0.3)' }} />
            {'Mid'}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded" style={{ background: 'rgba(34,197,94,0.45)' }} />
            {'High'}
          </span>
          <span className="ml-1">RAROC</span>
        </div>
      </div>

      {/* Matrix */}
      <div className="overflow-auto rounded-[22px] bg-[var(--nfq-bg-surface)]">
        <table className="w-full min-w-[600px] border-collapse">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--nfq-text-muted)] bg-[var(--nfq-bg-elevated)]">
                Segment / Tenor
              </th>
              {TENOR_BUCKETS.map((tb) => (
                <th
                  key={tb}
                  className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--nfq-text-muted)] bg-[var(--nfq-bg-elevated)]"
                >
                  {tb}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {segments.map((seg) => (
              <tr key={seg}>
                <td className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-3 text-xs font-semibold text-[color:var(--nfq-text-primary)]">
                  {seg}
                </td>
                {TENOR_BUCKETS.map((tb) => {
                  const cell = matrix.get(seg)?.get(tb);
                  if (!cell) {
                    return (
                      <td
                        key={tb}
                        className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-3 text-center text-[10px] text-[color:var(--nfq-text-faint)]"
                      >
                        --
                      </td>
                    );
                  }
                  return (
                    <td
                      key={tb}
                      onClick={() => onCellSelect(cell)}
                      className="cursor-pointer border-b border-[color:var(--nfq-border-ghost)] px-4 py-3 text-center transition-transform hover:scale-105"
                      style={{ backgroundColor: rarocToColor(cell.targetRaroc) }}
                    >
                      <span
                        className="font-mono text-sm font-bold [font-variant-numeric:tabular-nums]"
                        style={{ color: rarocTextColor(cell.targetRaroc) }}
                      >
                        {(cell.targetRaroc * 100).toFixed(1)}%
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
            {segments.length === 0 && (
              <tr>
                <td
                  colSpan={TENOR_BUCKETS.length + 1}
                  className="py-16 text-center text-sm text-[color:var(--nfq-text-muted)]"
                >
                  No data for the selected product and currency.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TargetGridHeatmap;
