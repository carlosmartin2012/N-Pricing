import React, { useMemo } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import type { Transaction } from '../../types';

interface ConflictModalProps {
  isOpen: boolean;
  onAcceptMine: () => void;
  onAcceptServer: () => void;
  onCancel: () => void;
  myVersion: Transaction;
  serverVersion: Transaction;
}

// Fields to show in conflict diff
const DIFF_FIELDS: { key: keyof Transaction; label: string }[] = [
  { key: 'amount', label: 'Amount' },
  { key: 'marginTarget', label: 'Margin Target' },
  { key: 'currency', label: 'Currency' },
  { key: 'durationMonths', label: 'Duration (months)' },
  { key: 'status', label: 'Status' },
  { key: 'productType', label: 'Product' },
  { key: 'riskWeight', label: 'Risk Weight' },
  { key: 'transitionRisk', label: 'ESG Transition' },
  { key: 'physicalRisk', label: 'ESG Physical' },
];

export const ConflictModal: React.FC<ConflictModalProps> = ({
  isOpen,
  onAcceptMine,
  onAcceptServer,
  onCancel,
  myVersion,
  serverVersion,
}) => {
  const diffs = useMemo(() => {
    return DIFF_FIELDS.filter((f) => {
      const mine = myVersion[f.key];
      const server = serverVersion[f.key];
      return mine !== server;
    });
  }, [myVersion, serverVersion]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[var(--nfq-radius-card)] border border-amber-500/30 bg-[var(--nfq-bg-surface)] p-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="h-6 w-6 text-amber-400" />
          <h3 className="text-lg font-bold text-white">Conflict Detected</h3>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          This deal was modified by another user while you were editing. Review the differences below.
        </p>

        {diffs.length > 0 ? (
          <div className="rounded-lg border border-white/10 overflow-hidden mb-6">
            <div className="grid grid-cols-3 gap-0 bg-white/5 px-4 py-2">
              <span className="nfq-label text-[10px]">Field</span>
              <span className="nfq-label text-[10px] text-cyan-400">Your Version</span>
              <span className="nfq-label text-[10px] text-amber-400">Server Version</span>
            </div>
            {diffs.map((diff) => (
              <div key={diff.key} className="grid grid-cols-3 gap-0 px-4 py-2 border-t border-white/5">
                <span className="text-xs text-slate-300">{diff.label}</span>
                <span className="text-xs font-mono text-cyan-400">
                  {String(myVersion[diff.key] ?? '—')}
                </span>
                <span className="text-xs font-mono text-amber-400">
                  {String(serverVersion[diff.key] ?? '—')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 mb-6">No visible field differences (internal version conflict).</p>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="nfq-btn-ghost px-4 py-2 text-sm">
            <X className="h-4 w-4 mr-1 inline" />
            Cancel
          </button>
          <button onClick={onAcceptServer} className="nfq-btn-ghost px-4 py-2 text-sm text-amber-400 border-amber-500/30">
            <Check className="h-4 w-4 mr-1 inline" />
            Use Server Version
          </button>
          <button onClick={onAcceptMine} className="nfq-btn-primary px-4 py-2 text-sm">
            <Check className="h-4 w-4 mr-1 inline" />
            Use My Version
          </button>
        </div>
      </div>
    </div>
  );
};
