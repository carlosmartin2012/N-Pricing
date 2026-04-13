import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import type { MethodologySnapshot } from '../../types';
import { useUI } from '../../contexts/UIContext';

interface Props {
  snapshots: MethodologySnapshot[];
  selectedId: string;
  onSelect: (id: string) => void;
  compareMode?: boolean;
  compareId?: string;
  onCompareSelect?: (id: string) => void;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

const SnapshotDropdown: React.FC<{
  label: string;
  snapshots: MethodologySnapshot[];
  selectedId: string;
  onSelect: (id: string) => void;
}> = ({ label, snapshots, selectedId, onSelect }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = snapshots.find((s) => s.id === selectedId);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="nfq-input flex items-center gap-2 py-2 pr-8 text-xs font-semibold"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate max-w-[180px]">
          {selected ? `${label}: v${selected.version}` : `${label}: Select...`}
        </span>
        <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--nfq-text-muted)]" />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-30 mt-1 max-h-64 w-72 overflow-auto rounded-[16px] border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] py-1 shadow-xl"
        >
          {snapshots.length === 0 && (
            <li className="px-4 py-3 text-xs text-[color:var(--nfq-text-muted)]">
              No snapshots available.
            </li>
          )}
          {snapshots.map((snap) => (
            <li
              key={snap.id}
              role="option"
              aria-selected={snap.id === selectedId}
              onClick={() => {
                onSelect(snap.id);
                setOpen(false);
              }}
              className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 text-xs transition-colors hover:bg-[var(--nfq-bg-highest)] ${
                snap.id === selectedId ? 'bg-[var(--nfq-bg-highest)]' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[color:var(--nfq-text-primary)]">
                    v{snap.version}
                  </span>
                  {snap.isCurrent && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--nfq-success)]/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--nfq-success)]">
                      Current
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[10px] text-[color:var(--nfq-text-muted)]">
                  {formatDate(snap.approvedAt)}
                  {snap.approvedBy && <> &middot; {snap.approvedBy}</>}
                </div>
                {snap.notes && (
                  <div className="mt-0.5 max-w-[220px] truncate text-[10px] text-[color:var(--nfq-text-faint)]">
                    {snap.notes}
                  </div>
                )}
              </div>
              {snap.id === selectedId && (
                <Check size={14} className="shrink-0 text-[var(--nfq-accent)]" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const SnapshotSelector: React.FC<Props> = ({
  snapshots,
  selectedId,
  onSelect,
  compareMode,
  compareId,
  onCompareSelect,
}) => {
  const { t } = useUI();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <SnapshotDropdown
        label={compareMode ? 'From' : 'Snapshot'}
        snapshots={snapshots}
        selectedId={selectedId}
        onSelect={onSelect}
      />

      {compareMode && onCompareSelect && (
        <>
          <span className="text-[10px] font-mono uppercase tracking-widest text-[color:var(--nfq-text-faint)]">
            vs
          </span>
          <SnapshotDropdown
            label="To"
            snapshots={snapshots}
            selectedId={compareId ?? ''}
            onSelect={onCompareSelect}
          />
        </>
      )}
    </div>
  );
};

export default SnapshotSelector;
