import React from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';

interface OfflineBadgeProps {
  pendingCount: number;
  isSyncing: boolean;
  onSync: () => void;
}

export const OfflineBadge: React.FC<OfflineBadgeProps> = ({ pendingCount, isSyncing, onSync }) => {
  if (pendingCount === 0) return null;

  return (
    <button
      data-testid="offline-badge"
      onClick={onSync}
      className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-xs text-amber-400 transition-colors hover:bg-amber-500/20"
      title={`${pendingCount} pending changes — click to sync`}
    >
      {isSyncing ? (
        <RefreshCw className="h-3 w-3 animate-spin" />
      ) : (
        <CloudOff className="h-3 w-3" />
      )}
      <span className="font-mono font-bold">{pendingCount}</span>
      <span className="hidden sm:inline">pending</span>
    </button>
  );
};
