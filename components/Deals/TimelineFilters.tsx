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
        className="nfq-label rounded border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-highest)]/40 px-2 py-1 text-[10px] text-[color:var(--nfq-text-secondary)] hover:border-[color:var(--nfq-accent)]/40 hover:text-[color:var(--nfq-accent)]"
      >
        All
      </button>
      <button
        type="button"
        onClick={onNone}
        className="nfq-label rounded border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-highest)]/40 px-2 py-1 text-[10px] text-[color:var(--nfq-text-muted)] hover:border-rose-500/40 hover:text-[color:var(--nfq-danger)]"
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
                ? 'border border-[color:var(--nfq-accent)]/40 bg-[var(--nfq-accent)]/10 text-[color:var(--nfq-accent)]'
                : 'border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-highest)]/30 text-[color:var(--nfq-text-faint)] hover:text-[color:var(--nfq-text-secondary)]'
            }`}
          >
            <span>{EVENT_LABEL[kind]}</span>
            <span className="font-mono-nums text-[9px] text-[color:var(--nfq-text-muted)]">{count}</span>
          </button>
        );
      })}
    </div>
  );
};

export default TimelineFilters;
