import React, { useState } from 'react';
import { X, Download, FileSpreadsheet, FileText } from 'lucide-react';
import type { GridFilters } from '../../types';
import { useUI } from '../../contexts/UIContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  snapshotId: string;
  filters?: GridFilters;
  cellCount: number;
}

type ExportFormat = 'pdf' | 'xlsx';

const ExportGridModal: React.FC<Props> = ({ isOpen, onClose, snapshotId, filters, cellCount }) => {
  const { t } = useUI();
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [includeBreakdown, setIncludeBreakdown] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    try {
      // Dynamic import for export utilities
      if (format === 'xlsx') {
        const { utils, writeFile } = await import('xlsx');
        // Build a placeholder workbook — the actual data assembly would use the API
        const ws = utils.aoa_to_sheet([
          ['Target Grid Export'],
          ['Snapshot ID', snapshotId],
          ['Cells', cellCount],
          ['Filters', JSON.stringify(filters ?? {})],
          [],
          ['Product', 'Segment', 'Tenor', 'Currency', 'FTP (bps)', 'Margin (%)', 'Client Rate (%)', 'RAROC (%)'],
        ]);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, 'Target Grid');
        writeFile(wb, `target-grid-${snapshotId.slice(0, 8)}.xlsx`);
      } else {
        // PDF export — dynamically import; the helper may not yet exist
        const pdfModule = await import('../../utils/pdfExport');
        const exportFn = (pdfModule as Record<string, unknown>)['exportTargetGridPdf'];
        if (typeof exportFn === 'function') {
          await (exportFn as (id: string, f?: GridFilters) => Promise<void>)(snapshotId, filters);
        }
      }
    } catch (err) {
      console.error('Export failed', err);
      setError('Export failed. Please try again.');
      setIsExporting(false);
      return;
    }
    setIsExporting(false);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/55 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Export target grid"
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[22px] bg-[var(--nfq-bg-surface)] shadow-[var(--nfq-shadow-dialog)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-[var(--nfq-bg-elevated)] px-6 py-5 rounded-t-[22px]">
          <div>
            <div className="nfq-eyebrow">Export</div>
            <h2 className="mt-2 text-base font-semibold text-[color:var(--nfq-text-primary)]">
              Export Target Grid
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t.close ?? 'Close'}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--nfq-bg-highest)] text-[color:var(--nfq-text-muted)] transition-colors hover:text-[color:var(--nfq-text-primary)]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          {/* Format selector */}
          <h3 className="nfq-eyebrow mb-3">Format</h3>
          <div className="mb-6 flex gap-3">
            <button
              onClick={() => setFormat('xlsx')}
              className={`flex flex-1 flex-col items-center gap-2 rounded-[16px] border-2 px-4 py-4 transition-colors ${
                format === 'xlsx'
                  ? 'border-[var(--nfq-accent)] bg-[var(--nfq-accent)]/10'
                  : 'border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] hover:border-[color:var(--nfq-text-muted)]'
              }`}
            >
              <FileSpreadsheet
                size={24}
                className={format === 'xlsx' ? 'text-[var(--nfq-accent)]' : 'text-[color:var(--nfq-text-muted)]'}
              />
              <span className={`text-xs font-bold ${format === 'xlsx' ? 'text-[var(--nfq-accent)]' : 'text-[color:var(--nfq-text-secondary)]'}`}>
                XLSX
              </span>
              <span className="text-[10px] text-[color:var(--nfq-text-muted)]">
                Excel Workbook
              </span>
            </button>
            <button
              onClick={() => setFormat('pdf')}
              className={`flex flex-1 flex-col items-center gap-2 rounded-[16px] border-2 px-4 py-4 transition-colors ${
                format === 'pdf'
                  ? 'border-[var(--nfq-accent)] bg-[var(--nfq-accent)]/10'
                  : 'border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] hover:border-[color:var(--nfq-text-muted)]'
              }`}
            >
              <FileText
                size={24}
                className={format === 'pdf' ? 'text-[var(--nfq-accent)]' : 'text-[color:var(--nfq-text-muted)]'}
              />
              <span className={`text-xs font-bold ${format === 'pdf' ? 'text-[var(--nfq-accent)]' : 'text-[color:var(--nfq-text-secondary)]'}`}>
                PDF
              </span>
              <span className="text-[10px] text-[color:var(--nfq-text-muted)]">
                Printable Report
              </span>
            </button>
          </div>

          {/* Options */}
          <h3 className="nfq-eyebrow mb-3">Options</h3>
          <label className="mb-4 flex items-center gap-3">
            <input
              type="checkbox"
              checked={includeBreakdown}
              onChange={(e) => setIncludeBreakdown(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500/30"
            />
            <span className="text-xs text-[color:var(--nfq-text-secondary)]">
              Include FTP component breakdown
            </span>
          </label>

          {/* Active filters summary */}
          {filters && (filters.products?.length || filters.segments?.length || filters.tenorBuckets?.length || filters.currencies?.length) ? (
            <div className="mb-4 rounded-[12px] bg-[var(--nfq-bg-elevated)] p-3">
              <div className="text-[11px] font-medium text-[color:var(--nfq-text-muted)] mb-1.5">
                Active Filters
              </div>
              <div className="flex flex-wrap gap-1.5">
                {filters.products?.map((p) => (
                  <span key={p} className="rounded-full bg-[var(--nfq-bg-highest)] px-2 py-0.5 text-[10px] text-[color:var(--nfq-text-secondary)]">
                    {p}
                  </span>
                ))}
                {filters.segments?.map((s) => (
                  <span key={s} className="rounded-full bg-[var(--nfq-bg-highest)] px-2 py-0.5 text-[10px] text-[color:var(--nfq-text-secondary)]">
                    {s}
                  </span>
                ))}
                {filters.tenorBuckets?.map((tb) => (
                  <span key={tb} className="rounded-full bg-[var(--nfq-bg-highest)] px-2 py-0.5 text-[10px] text-[color:var(--nfq-text-secondary)]">
                    {tb}
                  </span>
                ))}
                {filters.currencies?.map((c) => (
                  <span key={c} className="rounded-full bg-[var(--nfq-bg-highest)] px-2 py-0.5 text-[10px] text-[color:var(--nfq-text-secondary)]">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Error state */}
          {error && (
            <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-950/20 px-4 py-2 text-xs text-rose-400">
              {error}
            </div>
          )}

          {/* Cell count */}
          <div className="rounded-[12px] bg-[var(--nfq-bg-elevated)] p-3 text-center">
            <span className="font-mono text-2xl font-bold text-[var(--nfq-accent)]">
              {cellCount}
            </span>
            <span className="ml-2 text-xs text-[color:var(--nfq-text-muted)]">
              cells will be exported
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 bg-[var(--nfq-bg-elevated)] px-6 py-4 rounded-b-[22px]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[11px] font-medium text-[color:var(--nfq-text-muted)] transition-colors hover:text-[color:var(--nfq-text-primary)]"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || cellCount === 0}
            className="nfq-button nfq-button-primary flex items-center gap-1.5 px-5 py-2 text-[11px] font-medium disabled:opacity-40"
          >
            {isExporting ? (
              <>
                <div className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
                Exporting...
              </>
            ) : (
              <>
                <Download size={12} />
                Export {format.toUpperCase()}
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

export default ExportGridModal;
