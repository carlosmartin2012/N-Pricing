import React, { useState, useMemo, useCallback } from 'react';
import { Download, Filter, Grid, Table, Eye, X } from 'lucide-react';
import type { TargetGridCell, GridFilters, TenorBucket } from '../../types';
import { TENOR_BUCKETS } from '../../types';
import { useSnapshotsQuery, useGridCellsQuery } from '../../hooks/queries/useTargetGridQueries';
import { useUI } from '../../contexts/UIContext';
import { useEntity } from '../../contexts/EntityContext';
import SnapshotSelector from './SnapshotSelector';
import TargetGridTable from './TargetGridTable';
import TargetGridHeatmap from './TargetGridHeatmap';
import GridCellDetailPanel from './GridCellDetailPanel';
import ExportGridModal from './ExportGridModal';

type ViewMode = 'table' | 'heatmap';

const TargetGridView: React.FC = () => {
  const { t } = useUI();
  const { activeEntity } = useEntity();
  const entityId = activeEntity?.id;

  // ------ snapshot & filter state ------
  const { data: snapshots = [], isLoading: snapshotsLoading } = useSnapshotsQuery(entityId);

  const currentSnapshot = useMemo(
    () => snapshots.find((s) => s.isCurrent) ?? snapshots[0],
    [snapshots],
  );

  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>('');
  const effectiveSnapshotId = selectedSnapshotId || currentSnapshot?.id || '';

  const [filters, setFilters] = useState<GridFilters>({});
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedCell, setSelectedCell] = useState<TargetGridCell | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const { data: cells = [], isLoading: cellsLoading } = useGridCellsQuery(
    effectiveSnapshotId,
    { ...filters, entityId },
  );

  // ------ derived dimension options ------
  const allProducts = useMemo(() => [...new Set(cells.map((c) => c.product))].sort(), [cells]);
  const allSegments = useMemo(() => [...new Set(cells.map((c) => c.segment))].sort(), [cells]);
  const allCurrencies = useMemo(() => [...new Set(cells.map((c) => c.currency))].sort(), [cells]);

  // ------ filter chip helpers ------
  const toggleFilter = useCallback(
    (dim: 'products' | 'segments' | 'tenorBuckets' | 'currencies', value: string) => {
      setFilters((prev) => {
        const arr = (prev[dim] ?? []) as string[];
        const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
        return { ...prev, [dim]: next.length > 0 ? next : undefined };
      });
    },
    [],
  );

  const clearFilters = useCallback(() => setFilters({}), []);

  const hasActiveFilters =
    (filters.products?.length ?? 0) > 0 ||
    (filters.segments?.length ?? 0) > 0 ||
    (filters.tenorBuckets?.length ?? 0) > 0 ||
    (filters.currencies?.length ?? 0) > 0;

  // ------ loading state ------
  const isLoading = snapshotsLoading || cellsLoading;

  return (
    <div className="flex flex-col gap-4">
      {/* ============ Header row ============ */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Snapshot selector */}
        <SnapshotSelector
          snapshots={snapshots}
          selectedId={effectiveSnapshotId}
          onSelect={setSelectedSnapshotId}
        />

        {/* View mode toggle */}
        <div className="flex rounded-[12px] bg-[var(--nfq-bg-elevated)] p-0.5">
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              viewMode === 'table'
                ? 'bg-[var(--nfq-bg-highest)] text-[var(--nfq-accent)]'
                : 'text-[color:var(--nfq-text-muted)] hover:text-[color:var(--nfq-text-primary)]'
            }`}
            aria-pressed={viewMode === 'table'}
          >
            <Table size={12} />
            Table
          </button>
          <button
            onClick={() => setViewMode('heatmap')}
            className={`flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              viewMode === 'heatmap'
                ? 'bg-[var(--nfq-bg-highest)] text-[var(--nfq-accent)]'
                : 'text-[color:var(--nfq-text-muted)] hover:text-[color:var(--nfq-text-primary)]'
            }`}
            aria-pressed={viewMode === 'heatmap'}
          >
            <Grid size={12} />
            Heatmap
          </button>
        </div>

        <div className="flex-1" />

        {/* Export button */}
        <button
          onClick={() => setExportOpen(true)}
          disabled={cells.length === 0}
          className="nfq-button flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[color:var(--nfq-text-muted)] transition-colors hover:text-[color:var(--nfq-text-primary)] disabled:opacity-40"
        >
          <Download size={12} />
          Export
        </button>
      </div>

      {/* ============ Filter chips ============ */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter size={12} className="text-[var(--nfq-text-muted)]" />

        {/* Products */}
        {allProducts.map((p) => (
          <button
            key={`p-${p}`}
            onClick={() => toggleFilter('products', p)}
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
              filters.products?.includes(p)
                ? 'bg-[var(--nfq-accent)]/20 text-[var(--nfq-accent)]'
                : 'bg-[var(--nfq-bg-elevated)] text-[color:var(--nfq-text-muted)] hover:text-[color:var(--nfq-text-primary)]'
            }`}
          >
            {p}
          </button>
        ))}

        {/* Segments */}
        {allSegments.map((s) => (
          <button
            key={`s-${s}`}
            onClick={() => toggleFilter('segments', s)}
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
              filters.segments?.includes(s)
                ? 'bg-[var(--nfq-info)]/20 text-[var(--nfq-info)]'
                : 'bg-[var(--nfq-bg-elevated)] text-[color:var(--nfq-text-muted)] hover:text-[color:var(--nfq-text-primary)]'
            }`}
          >
            {s}
          </button>
        ))}

        {/* Tenors */}
        {TENOR_BUCKETS.map((tb: TenorBucket) => (
          <button
            key={`tb-${tb}`}
            onClick={() => toggleFilter('tenorBuckets', tb)}
            className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold transition-colors ${
              filters.tenorBuckets?.includes(tb)
                ? 'bg-[var(--nfq-warning)]/20 text-[var(--nfq-warning)]'
                : 'bg-[var(--nfq-bg-elevated)] text-[color:var(--nfq-text-muted)] hover:text-[color:var(--nfq-text-primary)]'
            }`}
          >
            {tb}
          </button>
        ))}

        {/* Currencies */}
        {allCurrencies.map((c) => (
          <button
            key={`c-${c}`}
            onClick={() => toggleFilter('currencies', c)}
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
              filters.currencies?.includes(c)
                ? 'bg-[var(--nfq-success)]/20 text-[var(--nfq-success)]'
                : 'bg-[var(--nfq-bg-elevated)] text-[color:var(--nfq-text-muted)] hover:text-[color:var(--nfq-text-primary)]'
            }`}
          >
            {c}
          </button>
        ))}

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 rounded-full bg-[var(--nfq-danger)]/10 px-2.5 py-1 text-[10px] font-bold text-[var(--nfq-danger)] transition-colors hover:bg-[var(--nfq-danger)]/20"
          >
            <X size={10} />
            Clear
          </button>
        )}
      </div>

      {/* ============ Body ============ */}
      {viewMode === 'table' ? (
        <TargetGridTable
          cells={cells}
          onCellSelect={setSelectedCell}
          isLoading={isLoading}
        />
      ) : (
        <TargetGridHeatmap
          cells={cells}
          onCellSelect={setSelectedCell}
        />
      )}

      {/* Empty state (non-loading) */}
      {!isLoading && cells.length === 0 && snapshots.length > 0 && (
        <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 rounded-[24px] bg-[var(--nfq-bg-surface)] px-8 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--nfq-bg-elevated)]">
            <Eye size={28} className="text-[var(--nfq-text-muted)] opacity-60" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--nfq-text-primary)]">
              No target grid cells
            </h3>
            <p className="mt-1.5 max-w-sm text-sm text-[var(--nfq-text-muted)]">
              {hasActiveFilters
                ? 'No cells match the current filters. Try removing some filter criteria.'
                : 'Run a grid computation for the selected snapshot to populate target rates.'}
            </p>
          </div>
        </div>
      )}

      {/* No snapshots at all */}
      {!isLoading && snapshots.length === 0 && (
        <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 rounded-[24px] bg-[var(--nfq-bg-surface)] px-8 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--nfq-bg-elevated)]">
            <Grid size={28} className="text-[var(--nfq-text-muted)] opacity-60" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--nfq-text-primary)]">
              No methodology snapshots
            </h3>
            <p className="mt-1.5 max-w-sm text-sm text-[var(--nfq-text-muted)]">
              Approve a methodology configuration to create the first snapshot and compute target rates.
            </p>
          </div>
        </div>
      )}

      {/* ============ Detail panel ============ */}
      {selectedCell && (
        <GridCellDetailPanel
          cell={selectedCell}
          onClose={() => setSelectedCell(null)}
        />
      )}

      {/* ============ Export modal ============ */}
      <ExportGridModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        snapshotId={effectiveSnapshotId}
        filters={filters}
        cellCount={cells.length}
      />
    </div>
  );
};

export default TargetGridView;
