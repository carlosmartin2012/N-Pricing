import React from 'react';
import { FileUp, Plus, RefreshCw, Upload } from 'lucide-react';

interface Props {
  canMutate: boolean;
  isRepricing: boolean;
  repriceCount: number;
  onDownloadTemplate: () => void;
  onOpenImport: () => void;
  onBatchReprice: () => void;
  onNewDeal: () => void;
}

const BlotterHeaderActions: React.FC<Props> = ({
  canMutate,
  isRepricing,
  repriceCount,
  onDownloadTemplate,
  onOpenImport,
  onBatchReprice,
  onNewDeal,
}) => (
  <div className="flex gap-2">
    <button
      onClick={onDownloadTemplate}
      disabled={!canMutate}
      className="px-3 py-1.5 bg-[var(--nfq-bg-highest)] hover:bg-[var(--nfq-bg-highest)] text-[color:var(--nfq-warning)] rounded border border-[color:var(--nfq-border-ghost)] text-xs flex items-center gap-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      title="Download ID Modification Template"
    >
      <FileUp size={14} /> <span className="hidden sm:inline">ID Template</span>
    </button>
    <button
      onClick={onOpenImport}
      disabled={!canMutate}
      className="px-3 py-1.5 bg-[var(--nfq-bg-highest)] hover:bg-[var(--nfq-bg-highest)] text-[color:var(--nfq-accent)] rounded border border-[color:var(--nfq-border-ghost)] text-xs flex items-center gap-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Upload size={14} /> <span className="hidden sm:inline">Import Excel</span>
    </button>
    <button
      onClick={onBatchReprice}
      disabled={isRepricing || !canMutate}
      className={`px-3 py-1.5 rounded border text-xs flex items-center gap-1 transition-colors font-bold ${
        repriceCount > 0
          ? 'bg-[var(--nfq-success)]/30 border-emerald-700 text-[color:var(--nfq-success)]'
          : 'bg-[var(--nfq-bg-highest)] hover:bg-[var(--nfq-bg-highest)] border-[color:var(--nfq-border-ghost)] text-[color:var(--nfq-warning)]'
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <RefreshCw size={14} className={isRepricing ? 'animate-spin' : ''} />
      <span className="hidden sm:inline">{repriceCount > 0 ? `${repriceCount} Repriced` : 'Batch Reprice'}</span>
    </button>
    <button
      onClick={onNewDeal}
      disabled={!canMutate}
      className="px-3 py-1.5 bg-[var(--nfq-accent)] hover:bg-[var(--nfq-accent-hover)] text-[color:var(--nfq-text-primary)] rounded text-xs flex items-center gap-1 transition-colors font-bold shadow-lg shadow-[color:var(--nfq-accent)]/30 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Plus size={14} /> <span className="hidden sm:inline">New Deal</span>
    </button>
  </div>
);

export default BlotterHeaderActions;
