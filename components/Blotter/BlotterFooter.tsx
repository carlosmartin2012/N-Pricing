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
    <div className="flex flex-wrap justify-end gap-x-6 gap-y-2 border-t border-slate-800 bg-slate-950 p-2 font-mono-nums text-[10px] uppercase tracking-[0.16em] text-slate-500">
      <div>
        TOTAL VOL: <span className="text-slate-300">{formatCompactVolume(stats.totalVolume)}</span>
      </div>
      <div>
        AVG MARGIN: <span className="text-slate-300">{stats.avgMargin.toFixed(2)}%</span>
      </div>
      <div>
        BOOKED: <span className="text-emerald-400">{stats.bookedCount}</span>
      </div>
      <div>
        ROWS: <span className="text-slate-300">{deals.length}</span>
      </div>
      {committeeSummary && (
        <>
          <div>
            COMMITTEE PENDING: <span className="text-amber-400">{committeeSummary.pendingReview}</span>
          </div>
          <div>
            READY TO BOOK: <span className="text-cyan-400">{committeeSummary.readyToBook}</span>
          </div>
          <div>
            AI DOSSIERS: <span className="text-indigo-400">{committeeSummary.aiSupported}</span>
          </div>
          <div>
            OPEN TASKS: <span className="text-slate-300">{committeeSummary.openTasks}</span>
          </div>
        </>
      )}
    </div>
  );
};

export default BlotterFooter;
