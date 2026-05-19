import React, { useMemo } from 'react';
import type { Transaction } from '../../types';

interface Props {
  deals: Transaction[];
  committeeSummary?: {
    pendingReview: number;
    readyToBook: number;
    aiSupported: number;
    openTasks: number;
  };
}

const formatCompactVolume = (value: number) => {
  const v = Number.isFinite(value) ? value : 0;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

const BlotterFooter: React.FC<Props> = ({ deals, committeeSummary }) => {
  const stats = useMemo(() => {
    const totalVolume = deals.reduce((sum, deal) => sum + (deal.amount || 0), 0);
    const avgMargin =
      deals.length > 0 ? deals.reduce((sum, deal) => sum + (deal.marginTarget || 0), 0) / deals.length : 0;
    const bookedCount = deals.filter((deal) => deal.status === 'Booked').length;

    return { totalVolume, avgMargin, bookedCount };
  }, [deals]);

  return (
    <div className="flex flex-wrap justify-end gap-x-6 gap-y-2 border-t border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-root)] p-2 font-mono-nums text-[10px] uppercase tracking-[0.16em] text-[color:var(--nfq-text-faint)]">
      <div>
        TOTAL VOL: <span className="text-[color:var(--nfq-text-secondary)]">{formatCompactVolume(stats.totalVolume)}</span>
      </div>
      <div>
        AVG MARGIN: <span className="text-[color:var(--nfq-text-secondary)]">{stats.avgMargin.toFixed(2)}%</span>
      </div>
      <div>
        BOOKED: <span className="text-[color:var(--nfq-success)]">{stats.bookedCount}</span>
      </div>
      <div>
        ROWS: <span className="text-[color:var(--nfq-text-secondary)]">{deals.length}</span>
      </div>
      {committeeSummary && (
        <>
          <div>
            COMMITTEE PENDING: <span className="text-[color:var(--nfq-warning)]">{committeeSummary.pendingReview}</span>
          </div>
          <div>
            READY TO BOOK: <span className="text-[color:var(--nfq-accent)]">{committeeSummary.readyToBook}</span>
          </div>
          <div>
            AI DOSSIERS: <span className="text-[color:var(--nfq-cat-d)]">{committeeSummary.aiSupported}</span>
          </div>
          <div>
            OPEN TASKS: <span className="text-[color:var(--nfq-text-secondary)]">{committeeSummary.openTasks}</span>
          </div>
        </>
      )}
    </div>
  );
};

export default BlotterFooter;
