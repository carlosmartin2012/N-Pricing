import React from 'react';
import type { DealTimelineEventKind } from '../../types/dealTimeline';
import { EVENT_LABEL } from './timelineFormatters';

const ORDER: DealTimelineEventKind[] = [
  'deal_created',
  'deal_repriced',
  'escalation_opened',
  'escalation_resolved',
  'escalation_expired',
  'dossier_signed',
];

interface Props {
  /** Set of currently *enabled* kinds. Empty set = nothing visible. */
  enabled: ReadonlySet<DealTimelineEventKind>;
  onToggle: (kind: DealTimelineEventKind) => void;
  onAll: () => void;
  onNone: () => void;
  /** Per-kind counts (rendered as suffix). */
  counts: Partial<Record<DealTimelineEventKind, number>>;
}

const TimelineFilters: React.FC<Props> = ({ enabled, onToggle, onAll, onNone, counts }) => {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter timeline events">
      <button
        type="button"
        onClick={onAll}
        className="nfq-label rounded border border-slate-700/60 bg-slate-800/40 px-2 py-1 text-[10px] text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300"
      >
        All
      </button>
      <button
        type="button"
        onClick={onNone}
        className="nfq-label rounded border border-slate-700/60 bg-slate-800/40 px-2 py-1 text-[10px] text-slate-400 hover:border-rose-500/40 hover:text-rose-300"
      >
        None
      </button>
      <span className="text-slate-700">·</span>
      {ORDER.map((kind) => {
        const isOn = enabled.has(kind);
        const count = counts[kind] ?? 0;
        return (
          <button
            key={kind}
            type="button"
            aria-pressed={isOn}
            onClick={() => onToggle(kind)}
            className={`nfq-label flex items-center gap-1 rounded px-2 py-1 text-[10px] transition-colors ${
              isOn
                ? 'border border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
                : 'border border-slate-700/60 bg-slate-800/30 text-slate-500 hover:text-slate-300'
            }`}
          >
            <span>{EVENT_LABEL[kind]}</span>
            <span className="font-mono-nums text-[9px] text-slate-400">{count}</span>
          </button>
        );
      })}
    </div>
  );
};

export default TimelineFilters;
