import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowRight } from 'lucide-react';
import type { AuditEntry } from '../../types';
import { Badge } from '../ui/LayoutComponents';
import {
  formatAuditDetails,
  formatAuditTimestamp,
  getAuditActionTextClass,
  getAuditBadgeVariant,
} from './auditLogUtils';

interface Props {
  entries: AuditEntry[];
  selectedId: string | null;
  onSelect: (entry: AuditEntry) => void;
}

const VIRTUAL_THRESHOLD = 120;

export const AuditLogTable: React.FC<Props> = ({ entries, selectedId, onSelect }) => {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const useVirtual = entries.length > VIRTUAL_THRESHOLD;
  const rowVirtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 68,
    overscan: 8,
    enabled: useVirtual,
  });

  const renderRow = (entry: AuditEntry, index: number, style?: React.CSSProperties) => {
    const hasPayload = formatAuditDetails(entry.details) !== 'No additional payload.';
    const isSelected = selectedId === entry.id;

    return (
      <button
        key={entry.id}
        type="button"
        onClick={() => onSelect(entry)}
        className={`grid w-full grid-cols-[160px_220px_120px_140px_minmax(260px,1fr)_140px] cursor-pointer text-left text-xs transition-colors ${
          isSelected
            ? 'bg-[var(--nfq-accent-subtle)]'
            : index % 2 === 0
              ? 'bg-[var(--nfq-bg-root)] hover:bg-[var(--nfq-bg-elevated)]'
              : 'bg-[var(--nfq-bg-surface)] hover:bg-[var(--nfq-bg-elevated)]'
        }`}
        style={style}
      >
        <div className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-3 font-mono text-[color:var(--nfq-text-muted)] [font-variant-numeric:tabular-nums]">
          {formatAuditTimestamp(entry.timestamp)}
        </div>
        <div className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-3">
          <div className="font-medium text-[color:var(--nfq-text-primary)]">{entry.userName}</div>
          <div className="text-[10px] text-[color:var(--nfq-text-muted)]">{entry.userEmail}</div>
        </div>
        <div className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-3">
          <span className={`font-mono text-[10px] font-bold ${getAuditActionTextClass(entry.action)}`}>
            {entry.action}
          </span>
        </div>
        <div className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-3">
          <Badge variant={getAuditBadgeVariant(entry.action)}>{entry.module}</Badge>
        </div>
        <div className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-3 text-[color:var(--nfq-text-secondary)]">
          <div className="line-clamp-2">{entry.description}</div>
        </div>
        <div className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] text-[color:var(--nfq-text-muted)]">
              {hasPayload ? 'Open payload' : 'No payload'}
            </span>
            <ArrowRight size={14} className="text-[color:var(--nfq-text-muted)]" />
          </div>
        </div>
      </button>
    );
  };

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="overflow-x-auto border-b border-[color:var(--nfq-border)]">
        <div className="grid min-w-[980px] grid-cols-[160px_220px_120px_140px_minmax(260px,1fr)_140px] bg-[var(--nfq-bg-surface)] text-left text-xs">
          <div className="px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Timestamp</div>
          <div className="px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">User</div>
          <div className="px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Action</div>
          <div className="px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Module</div>
          <div className="px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Description</div>
          <div className="px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Payload</div>
        </div>
      </div>

      <div ref={parentRef} className="flex-1 overflow-auto">
        {!useVirtual || virtualRows.length === 0 ? (
          <div className="min-w-[980px]">
            {entries.map((entry, index) => renderRow(entry, index))}
          </div>
        ) : (
          <div className="relative min-w-[980px]" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
            {virtualRows.map((virtualRow) => {
              const entry = entries[virtualRow.index];
              if (!entry) return null;
              return renderRow(entry, virtualRow.index, {
                position: 'absolute',
                left: 0,
                transform: `translateY(${virtualRow.start}px)`,
              });
            })}
          </div>
        )}
      </div>
    </div>
  );
};
