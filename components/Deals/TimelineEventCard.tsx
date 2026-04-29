import React from 'react';
import {
  CircleCheck, CircleDot, CircleSlash, FileSignature, GitCommitHorizontal,
  ShieldAlert, RotateCcw,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  DealTimelineEvent,
  DealTimelineEventKind,
} from '../../types/dealTimeline';
import {
  EVENT_LABEL, formatRelative, formatTimestamp, summarizePayload, toneClass,
} from './timelineFormatters';

const ICON_BY_KIND: Record<DealTimelineEventKind, LucideIcon> = {
  deal_created:        CircleDot,
  deal_repriced:       GitCommitHorizontal,
  escalation_opened:   ShieldAlert,
  escalation_resolved: CircleCheck,
  escalation_expired:  CircleSlash,
  dossier_signed:      FileSignature,
};

interface Props {
  event: DealTimelineEvent;
  /** Called when user clicks the "Replay snapshot" affordance.
   *  Only rendered when `event.snapshotId` is present. */
  onReplaySnapshot?: (snapshotId: string) => void;
  /** Stable id used by ?focus= deep-links + scroll-into-view. */
  focused?: boolean;
}

const TimelineEventCard: React.FC<Props> = ({ event, onReplaySnapshot, focused }) => {
  const Icon = ICON_BY_KIND[event.kind];
  const tone = toneClass(event.kind);
  const actor = event.actor.email ?? 'system';

  return (
    <article
      id={`tl-${event.id}`}
      data-event-kind={event.kind}
      className={`relative rounded-lg border bg-slate-900/40 px-4 py-3 ${
        focused ? 'border-cyan-500/60 ring-1 ring-cyan-500/40' : 'border-slate-700/40'
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${tone}`} />
          <span className={`nfq-label text-[10px] font-medium ${tone}`}>
            {EVENT_LABEL[event.kind]}
          </span>
        </div>
        <time
          className="font-mono-nums text-[10px] text-slate-500"
          dateTime={event.occurredAt}
          title={formatTimestamp(event.occurredAt)}
        >
          {formatRelative(event.occurredAt)}
        </time>
      </header>

      <p className="mt-2 font-mono text-xs text-slate-200">
        {summarizePayload(event)}
      </p>

      <footer className="mt-2 flex items-center justify-between gap-3 text-[10px] text-slate-400">
        <span className="truncate">by {actor}</span>
        {event.snapshotId && onReplaySnapshot && (
          <button
            type="button"
            onClick={() => onReplaySnapshot(event.snapshotId!)}
            className="flex items-center gap-1 rounded border border-slate-700/60 bg-slate-800/60 px-2 py-0.5 text-[10px] text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300"
            aria-label={`Replay snapshot ${event.snapshotId}`}
          >
            <RotateCcw className="h-3 w-3" />
            Replay
          </button>
        )}
      </footer>
    </article>
  );
};

export default TimelineEventCard;
