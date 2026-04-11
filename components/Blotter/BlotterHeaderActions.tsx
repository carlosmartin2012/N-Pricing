import React from 'react';
import { FileUp, Plus, RefreshCw, Upload } from 'lucide-react';

interface Props {
  isRepricing: boolean;
  repriceCount: number;
  onDownloadTemplate: () => void;
  onOpenImport: () => void;
  onBatchReprice: () => void;
  onNewDeal: () => void;
}

const BlotterHeaderActions: React.FC<Props> = ({
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
      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded border border-slate-700 text-xs flex items-center gap-1 transition-colors"
      title="Download ID Modification Template"
    >
      <FileUp size={14} /> <span className="hidden sm:inline">ID Template</span>
    </button>
    <button
      onClick={onOpenImport}
      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded border border-slate-700 text-xs flex items-center gap-1 transition-colors"
    >
      <Upload size={14} /> <span className="hidden sm:inline">Import Excel</span>
    </button>
    <button
      onClick={onBatchReprice}
      disabled={isRepricing}
      className={`px-3 py-1.5 rounded border text-xs flex items-center gap-1 transition-colors font-bold ${
        repriceCount > 0
          ? 'bg-emerald-900/30 border-emerald-700 text-emerald-400'
          : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-400'
      }`}
    >
      <RefreshCw size={14} className={isRepricing ? 'animate-spin' : ''} />
      <span className="hidden sm:inline">{repriceCount > 0 ? `${repriceCount} Repriced` : 'Batch Reprice'}</span>
    </button>
    <button
      onClick={onNewDeal}
      className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs flex items-center gap-1 transition-colors font-bold shadow-lg shadow-cyan-900/20"
    >
      <Plus size={14} /> <span className="hidden sm:inline">New Deal</span>
    </button>
  </div>
);

export default BlotterHeaderActions;
