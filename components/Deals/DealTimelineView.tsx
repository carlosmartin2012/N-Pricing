import React, { useEffect, useMemo, useRef, useState } from 'react';
import { History } from 'lucide-react';
import { useDealTimelineQuery } from '../../hooks/queries/useDealTimelineQuery';
import type { DealTimelineEventKind } from '../../types/dealTimeline';
import TimelineEventCard from './TimelineEventCard';
import TimelineFilters from './TimelineFilters';

const ALL_KINDS: DealTimelineEventKind[] = [
  'deal_created',
  'deal_repriced',
  'escalation_opened',
  'escalation_resolved',
  'escalation_expired',
  'dossier_signed',
];

interface Props {
  dealId: string;
  /** Optional event id to scroll-into-view + highlight on mount. Used by
   *  deep-links from /escalations and /dossiers (`?focus=<eventId>`). */
  focusEventId?: string;
  /** Wired in A.6 to navigate to the snapshot replay flow. */
  onReplaySnapshot?: (snapshotId: string) => void;
}

const DealTimelineView: React.FC<Props> = ({ dealId, focusEventId, onReplaySnapshot }) => {
  const { data: timeline, isLoading, isError } = useDealTimelineQuery(dealId);

  const [enabledKinds, setEnabledKinds] = useState<Set<DealTimelineEventKind>>(
    () => new Set(ALL_KINDS),
  );

  const focusRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!focusEventId) return;
    const el = document.getElementById(`tl-${focusEventId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusEventId, timeline?.events.length]);

  const visibleEvents = useMemo(() => {
    if (!timeline) return [];
    return timeline.events.filter((ev) => enabledKinds.has(ev.kind));
  }, [timeline, enabledKinds]);

  const countsByKind = useMemo(() => {
    const out: Partial<Record<DealTimelineEventKind, number>> = {};
    if (!timeline) return out;
    for (const ev of timeline.events) {
      out[ev.kind] = (out[ev.kind] ?? 0) + 1;
    }
    return out;
  }, [timeline]);

  const toggleKind = (kind: DealTimelineEventKind) => {
    setEnabledKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  if (!dealId) {
    return (
      <p className="p-6 text-xs text-slate-400">
        No deal selected. Open a deal from the blotter or escalations to see its timeline.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-xs text-slate-400" role="status">
        <History className="h-4 w-4 animate-pulse" />
        Loading timeline…
      </div>
    );
  }

  if (isError || !timeline) {
    return (
      <p className="p-6 text-xs text-rose-300">
        Could not load timeline for this deal. It may have been deleted or you may not have access.
      </p>
    );
  }

  return (
    <div ref={focusRef} className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="nfq-label flex items-center gap-2 text-[10px] text-slate-400">
            <History className="h-3.5 w-3.5" />
            Deal timeline
          </div>
          <h2 className="font-mono text-sm font-bold uppercase tracking-tight text-white">
            {timeline.dealId}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Status:{' '}
            <span className="font-mono-nums text-slate-200">{timeline.currentStatus}</span>
          </p>
        </div>
        <dl className="flex items-end gap-6">
          <KpiTile label="Repricings"  value={timeline.counts.repricings} />
          <KpiTile label="Escalations" value={timeline.counts.escalations} />
          <KpiTile label="Dossiers"    value={timeline.counts.dossiers} />
        </dl>
      </header>

      <TimelineFilters
        enabled={enabledKinds}
        onToggle={toggleKind}
        onAll={() => setEnabledKinds(new Set(ALL_KINDS))}
        onNone={() => setEnabledKinds(new Set())}
        counts={countsByKind}
      />

      {visibleEvents.length === 0 ? (
        <p className="rounded border border-slate-700/40 bg-slate-900/30 p-6 text-center text-xs text-slate-400">
          {timeline.events.length === 0
            ? 'No events recorded yet for this deal.'
            : 'All event kinds are filtered out — toggle "All" to see them again.'}
        </p>
      ) : (
        <ol className="relative space-y-3 border-l border-slate-700/40 pl-4">
          {visibleEvents.map((ev) => (
            <li key={ev.id}>
              <TimelineEventCard
                event={ev}
                onReplaySnapshot={onReplaySnapshot}
                focused={ev.id === focusEventId}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

interface KpiTileProps { label: string; value: number }
const KpiTile: React.FC<KpiTileProps> = ({ label, value }) => (
  <div className="text-right">
    <dt className="nfq-label text-[10px] text-slate-400">{label}</dt>
    <dd className="font-mono-nums text-lg font-bold text-slate-100">{value}</dd>
  </div>
);

export default DealTimelineView;
