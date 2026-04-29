import React from 'react';
import { ArrowRight, History, Info } from 'lucide-react';

/**
 * Deprecation banner for views that the unified Deal Timeline (Ola 7
 * Bloque A) replaces. Renders a soft amber notice at the top of
 * EscalationsView and DossiersView during the 30-day deprecation window
 * decided in `docs/ola-7-collaborative-ux.md` §7.
 *
 * The banner does not link to a specific deal — these views are list
 * views across many deals. It points users at the per-deal timeline by
 * explaining the new affordance (History icon in the Blotter row).
 */

interface Props {
  /** Where the user came from. Tunes the copy. */
  surface: 'escalations' | 'dossiers';
}

const SURFACE_COPY: Record<Props['surface'], { title: string; body: string }> = {
  escalations: {
    title: 'This view is being replaced by Deal Timeline',
    body:
      'For full deal context — pricing snapshots, escalations and signed dossiers in one chronology — open any deal from the Blotter and click the History icon. This page will move out of the sidebar after 30 days; deep-links keep working for 90 more.',
  },
  dossiers: {
    title: 'This view is being replaced by Deal Timeline',
    body:
      'Signed dossiers now also appear in the unified Deal Timeline alongside pricing snapshots and escalations. Open any deal from the Blotter and click the History icon for the full lifecycle. This page will move out of the sidebar after 30 days.',
  },
};

const TimelineDeprecationBanner: React.FC<Props> = ({ surface }) => {
  const { title, body } = SURFACE_COPY[surface];
  return (
    <aside
      role="note"
      aria-label="Deal Timeline deprecation notice"
      data-testid="timeline-deprecation-banner"
      className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs"
    >
      <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" aria-hidden="true" />
      <div className="flex-1 text-amber-100/90">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200">
          {title}
        </p>
        <p className="mt-1 leading-relaxed text-amber-100/80">{body}</p>
        <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.12em] text-amber-300">
          <History className="h-3 w-3" />
          History icon
          <ArrowRight className="h-3 w-3" />
          Deal Timeline
        </p>
      </div>
    </aside>
  );
};

export default TimelineDeprecationBanner;
