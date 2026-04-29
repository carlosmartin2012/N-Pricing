import type {
  DealTimelineEvent,
  DealTimelineEventKind,
} from '../../types/dealTimeline';

/**
 * Formatting helpers for Deal Timeline UI. Pure — no React, no I/O.
 * Tested independently in __tests__/timelineFormatters.test.ts.
 */

const ABS_DATE = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
});

export function formatTimestamp(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return ABS_DATE.format(d);
}

export function formatRelative(iso: string, now: Date = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const past = diffSec >= 0;
  const abs = Math.abs(diffSec);
  if (abs < 60)            return past ? 'just now'              : 'in seconds';
  if (abs < 3600)          return past ? `${Math.round(abs / 60)} min ago`   : `in ${Math.round(abs / 60)} min`;
  if (abs < 86_400)        return past ? `${Math.round(abs / 3600)} h ago`   : `in ${Math.round(abs / 3600)} h`;
  if (abs < 86_400 * 30)   return past ? `${Math.round(abs / 86_400)} d ago` : `in ${Math.round(abs / 86_400)} d`;
  return formatTimestamp(iso);
}

export const EVENT_LABEL: Record<DealTimelineEventKind, string> = {
  deal_created:         'Deal created',
  deal_repriced:        'Repriced',
  escalation_opened:    'Escalation opened',
  escalation_resolved:  'Escalation resolved',
  escalation_expired:   'Escalation expired',
  dossier_signed:       'Dossier signed',
};

export type EventTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export const EVENT_TONE: Record<DealTimelineEventKind, EventTone> = {
  deal_created:         'neutral',
  deal_repriced:        'info',
  escalation_opened:    'warning',
  escalation_resolved:  'success',
  escalation_expired:   'danger',
  dossier_signed:       'success',
};

const TONE_CLASS: Record<EventTone, string> = {
  neutral: 'text-slate-300',
  info:    'text-cyan-300',
  warning: 'text-amber-300',
  success: 'text-emerald-300',
  danger:  'text-rose-300',
};

export function toneClass(kind: DealTimelineEventKind): string {
  return TONE_CLASS[EVENT_TONE[kind]];
}

export function summarizePayload(ev: DealTimelineEvent): string {
  switch (ev.payload.kind) {
    case 'deal_created':
      return `Status: ${ev.payload.status}`;
    case 'deal_repriced':
      return `FTP ${ev.payload.ftpPct.toFixed(2)}% · Rate ${ev.payload.finalClientRatePct.toFixed(2)}% · RAROC ${ev.payload.rarocPct.toFixed(1)}%`;
    case 'escalation_opened':
      return `Level ${ev.payload.level} · due ${formatTimestamp(ev.payload.dueAt)}`;
    case 'escalation_resolved':
      return `Level ${ev.payload.level} · resolved ${formatRelative(ev.payload.resolvedAt)}`;
    case 'escalation_expired':
      return `Level ${ev.payload.level} · expired at deadline`;
    case 'dossier_signed':
      return `Hash ${ev.payload.payloadHash.slice(0, 12)}…`;
  }
}
