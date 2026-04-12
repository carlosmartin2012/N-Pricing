import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Edit, FileText, RotateCcw, Send, ShieldCheck, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import * as auditApi from '../../api/audit';
import type { AuditEntry } from '../../types';

interface Props {
  dealId: string;
}

const ACTION_CONFIG: Record<string, { icon: LucideIcon; color: string }> = {
  CREATE_DEAL: { icon: FileText, color: 'text-cyan-400 bg-cyan-500/15' },
  EDIT_DEAL: { icon: Edit, color: 'text-amber-400 bg-amber-500/15' },
  SUBMIT_APPROVAL: { icon: Send, color: 'text-violet-400 bg-violet-500/15' },
  APPROVE_DEAL: { icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-500/15' },
  REJECT_DEAL: { icon: XCircle, color: 'text-rose-400 bg-rose-500/15' },
  BOOK_DEAL: { icon: ShieldCheck, color: 'text-emerald-400 bg-emerald-500/15' },
  REPRICE_DEAL: { icon: RotateCcw, color: 'text-cyan-400 bg-cyan-500/15' },
  WORKFLOW_ACTION: { icon: Send, color: 'text-violet-400 bg-violet-500/15' },
};

const DEFAULT_CONFIG = { icon: Clock, color: 'text-slate-400 bg-slate-500/15' };

function formatTimestamp(ts: string): { date: string; time: string } {
  const d = new Date(ts);
  return {
    date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  };
}

export const AuditTimeline: React.FC<Props> = ({ dealId }) => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    auditApi
      .listAuditLog()
      .then((all) => {
        const dealEntries = all.filter(
          (e) => e.description?.includes(dealId) || (e.details as Record<string, unknown> | undefined)?.dealId === dealId,
        );
        setEntries(dealEntries.slice(0, 50));
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [dealId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-[var(--nfq-text-muted)]">
        <Clock size={14} className="animate-spin" />
        Loading timeline...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Clock size={24} className="text-[var(--nfq-text-muted)] opacity-40" />
        <p className="text-sm text-[var(--nfq-text-muted)]">No audit trail for this deal yet</p>
      </div>
    );
  }

  return (
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-[var(--nfq-border-ghost)]" />

      <div className="space-y-4">
        {entries.map((entry, idx) => {
          const config = ACTION_CONFIG[entry.action] || DEFAULT_CONFIG;
          const Icon = config.icon;
          const ts = formatTimestamp(entry.timestamp);

          return (
            <div key={entry.id || idx} className="relative flex gap-3">
              {/* Node */}
              <div className={`absolute -left-6 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${config.color}`}>
                <Icon size={12} />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-[var(--nfq-text-primary)]">
                    {entry.action.replace(/_/g, ' ')}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--nfq-text-faint)]">
                    {ts.date} {ts.time}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-[var(--nfq-text-muted)] leading-snug">
                  {entry.description}
                </p>
                <span className="mt-0.5 inline-block text-[10px] text-[var(--nfq-text-faint)]">
                  by {entry.userName || entry.userEmail}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
