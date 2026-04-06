import React from 'react';
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

export const AuditLogTable: React.FC<Props> = ({ entries, selectedId, onSelect }) => {
  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full min-w-[980px] text-left text-xs">
        <thead className="sticky top-0 z-10 bg-[var(--nfq-bg-surface)]">
          <tr>
            <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Timestamp</th>
            <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">User</th>
            <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Action</th>
            <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Module</th>
            <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Description</th>
            <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Payload</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const hasPayload = formatAuditDetails(entry.details) !== 'No additional payload.';
            const isSelected = selectedId === entry.id;

            return (
              <tr
                key={entry.id}
                onClick={() => onSelect(entry)}
                className={`cursor-pointer transition-colors even:bg-[var(--nfq-bg-surface)] odd:bg-[var(--nfq-bg-root)] ${
                  isSelected
                    ? 'bg-[var(--nfq-accent-subtle)]'
                    : 'hover:bg-[var(--nfq-bg-elevated)]'
                }`}
              >
                <td className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 font-mono text-[color:var(--nfq-text-muted)] [font-variant-numeric:tabular-nums]">
                  {formatAuditTimestamp(entry.timestamp)}
                </td>
                <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2">
                  <div className="font-medium text-[color:var(--nfq-text-primary)]">
                    {entry.userName}
                  </div>
                  <div className="text-[10px] text-[color:var(--nfq-text-muted)]">
                    {entry.userEmail}
                  </div>
                </td>
                <td className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2">
                  <span className={`font-mono text-[10px] font-bold ${getAuditActionTextClass(entry.action)}`}>
                    {entry.action}
                  </span>
                </td>
                <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2">
                  <Badge variant={getAuditBadgeVariant(entry.action)}>{entry.module}</Badge>
                </td>
                <td className="max-w-sm border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-[color:var(--nfq-text-secondary)]">
                  <div className="line-clamp-2">{entry.description}</div>
                </td>
                <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] text-[color:var(--nfq-text-muted)]">
                      {hasPayload ? 'Open payload' : 'No payload'}
                    </span>
                    <ArrowRight size={14} className="text-[color:var(--nfq-text-muted)]" />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
