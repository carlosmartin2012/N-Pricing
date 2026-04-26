import React from 'react';
import type { AuditEntry } from '../../types';
import { Drawer } from '../ui/Drawer';
import { Badge } from '../ui/LayoutComponents';
import {
  formatAuditDetails,
  formatAuditTimestamp,
  getAuditActionTextClass,
  getAuditBadgeVariant,
} from './auditLogUtils';

interface Props {
  entry: AuditEntry | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AuditEntryDrawer: React.FC<Props> = ({ entry, isOpen, onClose }) => {
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Audit Event Detail"
      footer={
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="rounded border border-[color:var(--nfq-border-ghost)] px-4 py-2 text-xs text-[color:var(--nfq-text-secondary)] transition-colors hover:text-[color:var(--nfq-text-primary)]"
          >
            Close
          </button>
        </div>
      }
    >
      {entry && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-[var(--nfq-radius-card)] border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] p-4">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--nfq-text-muted)]">
                Timestamp
              </div>
              <div className="mt-2 font-mono text-sm text-[color:var(--nfq-text-primary)]">
                {formatAuditTimestamp(entry.timestamp)}
              </div>
            </div>
            <div className="rounded-[var(--nfq-radius-card)] border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] p-4">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--nfq-text-muted)]">
                User
              </div>
              <div className="mt-2 text-sm font-semibold text-[color:var(--nfq-text-primary)]">
                {entry.userName}
              </div>
              <div className="text-xs text-[color:var(--nfq-text-muted)]">{entry.userEmail}</div>
            </div>
          </div>

          <div className="rounded-[var(--nfq-radius-card)] border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getAuditBadgeVariant(entry.action)}>{entry.module}</Badge>
              <span className={`font-mono text-xs font-bold ${getAuditActionTextClass(entry.action)}`}>
                {entry.action}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[color:var(--nfq-text-secondary)]">
              {entry.description}
            </p>
          </div>

          <div className="rounded-[var(--nfq-radius-card)] border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] p-4">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--nfq-text-muted)]">
              Payload
            </div>
            <pre className="mt-3 overflow-auto rounded-[var(--nfq-radius-card)] bg-slate-950/70 p-4 text-xs leading-relaxed text-[color:var(--nfq-text-secondary)]">
              {formatAuditDetails(entry.details)}
            </pre>
          </div>
        </div>
      )}
    </Drawer>
  );
};
