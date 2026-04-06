import React from 'react';
import { Download, Filter, Search } from 'lucide-react';
import { useUI } from '../../contexts/UIContext';

interface Props {
  searchTerm: string;
  filterStatus: string;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: string) => void;
  onExportCsv: () => void;
  onExportExcel: () => void;
}

const BlotterToolbar: React.FC<Props> = ({
  searchTerm,
  filterStatus,
  onSearchChange,
  onFilterChange,
  onExportCsv,
  onExportExcel,
}) => {
  const { t } = useUI();
  return (
  <div className="flex flex-col items-start justify-between gap-3 border-b border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] p-3 md:p-4 sm:flex-row sm:items-center">
    <div className="relative w-full sm:w-64">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--nfq-text-muted)]" size={16} />
      <input
        type="text"
        placeholder={t.searchClientOrId}
        className="nfq-input-field pl-10 pr-4 text-xs"
        value={searchTerm}
        onChange={(event) => onSearchChange(event.target.value)}
      />
    </div>

    <div className="scrollbar-none flex w-full items-center gap-4 overflow-x-auto pb-1 sm:w-auto sm:pb-0">
      <div className="flex shrink-0 items-center gap-2">
        <Filter size={14} className="text-[color:var(--nfq-text-muted)]" />
        <select
          className="cursor-pointer border-none bg-transparent py-1 text-xs font-bold text-[color:var(--nfq-text-muted)] outline-none font-mono"
          value={filterStatus}
          onChange={(event) => onFilterChange(event.target.value)}
        >
          <option value="All">{t.allStatus}</option>
          <option value="Draft">Draft</option>
          <option value="Pending">Pending</option>
          <option value="Pending_Approval">Pending Approval</option>
          <option value="Approved">Approved</option>
          <option value="Booked">Booked</option>
          <option value="Rejected">Rejected</option>
          <option value="Review">Review</option>
        </select>
      </div>

      <button
        onClick={onExportCsv}
        className="flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase text-slate-500 transition-colors hover:text-slate-900 dark:hover:text-slate-300"
      >
        <Download size={14} /> CSV
      </button>
      <button
        onClick={onExportExcel}
        className="flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase text-slate-500 transition-colors hover:text-emerald-500 dark:hover:text-emerald-400"
      >
        <Download size={14} /> Excel
      </button>
    </div>
  </div>
  );
};

export default BlotterToolbar;
