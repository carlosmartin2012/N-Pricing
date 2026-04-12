import React from 'react';
import { CheckSquare, Download, RotateCcw, X } from 'lucide-react';

interface Props {
  selectedCount: number;
  onClear: () => void;
  onExport: () => void;
  onBatchReprice: () => void;
  canReprice: boolean;
}

export const BulkActionBar: React.FC<Props> = ({
  selectedCount,
  onClear,
  onExport,
  onBatchReprice,
  canReprice,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-3 border-b border-[var(--nfq-border-ghost)] bg-[rgba(6,182,212,0.06)] px-4 py-2 animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-2">
        <CheckSquare size={14} className="text-[var(--nfq-accent)]" />
        <span className="font-mono text-xs font-semibold text-[var(--nfq-accent)]">
          {selectedCount} selected
        </span>
      </div>

      <div className="h-4 w-px bg-[var(--nfq-border-ghost)]" />

      <button
        onClick={onExport}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-[var(--nfq-text-secondary)] transition-colors hover:bg-[var(--nfq-bg-elevated)] hover:text-[var(--nfq-text-primary)]"
      >
        <Download size={12} />
        Export
      </button>

      {canReprice && (
        <button
          onClick={onBatchReprice}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-[var(--nfq-text-secondary)] transition-colors hover:bg-[var(--nfq-bg-elevated)] hover:text-[var(--nfq-text-primary)]"
        >
          <RotateCcw size={12} />
          Reprice
        </button>
      )}

      <div className="flex-1" />

      <button
        onClick={onClear}
        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] text-[var(--nfq-text-muted)] transition-colors hover:bg-[var(--nfq-bg-elevated)] hover:text-[var(--nfq-text-secondary)]"
      >
        <X size={12} />
        Clear
      </button>
    </div>
  );
};
