import React, { useMemo } from 'react';
import {
  History,
  CircleDollarSign,
  AlertTriangle,
  Handshake,
  Phone,
  RefreshCw,
  Sparkles,
  Gavel,
  XCircle,
  MessageSquareWarning,
} from 'lucide-react';
import { useClientTimelineQuery } from '../../hooks/queries/useClvQueries';
import { useUI } from '../../contexts/UIContext';
import { clvTranslations } from '../../translations/index';
import type { ClientEvent, ClientEventType } from '../../types/clv';

const EVENT_META: Record<ClientEventType, { icon: React.ComponentType<{ className?: string }>; tone: string; label: string }> = {
  onboarding:        { icon: Sparkles,           tone: 'text-[color:var(--nfq-cat-a)]',     label: 'Onboarding' },
  deal_booked:       { icon: CircleDollarSign,   tone: 'text-[color:var(--nfq-success)]', label: 'Deal booked' },
  deal_cancelled:    { icon: XCircle,            tone: 'text-[color:var(--nfq-danger)]',    label: 'Deal cancelled' },
  crosssell_attempt: { icon: Handshake,          tone: 'text-[color:var(--nfq-warning)]',   label: 'Crosssell attempt' },
  crosssell_won:     { icon: Handshake,          tone: 'text-[color:var(--nfq-success)]', label: 'Crosssell won' },
  claim:             { icon: AlertTriangle,      tone: 'text-[color:var(--nfq-danger)]',    label: 'Claim' },
  churn_signal:      { icon: MessageSquareWarning, tone: 'text-[color:var(--nfq-danger)]',  label: 'Churn signal' },
  contact:           { icon: Phone,              tone: 'text-[color:var(--nfq-text-secondary)]',   label: 'Contact' },
  price_review:      { icon: RefreshCw,          tone: 'text-[color:var(--nfq-cat-d)]',  label: 'Price review' },
  committee_review:  { icon: Gavel,              tone: 'text-[color:var(--nfq-cat-d)]',  label: 'Committee review' },
  nba_generated:     { icon: Sparkles,           tone: 'text-[color:var(--nfq-cat-a)]',     label: 'NBA generated' },
  nba_consumed:      { icon: Handshake,          tone: 'text-[color:var(--nfq-success)]', label: 'NBA consumed' },
};

interface Props { clientId: string }

const fmtEur = (v: number | null): string =>
  v === null ? '' : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

const ClientTimeline: React.FC<Props> = ({ clientId }) => {
  const { language } = useUI();
  const t = clvTranslations(language);
  const { data: events = [], isLoading: loading } = useClientTimelineQuery(clientId);

  const grouped = useMemo(() => {
    const byMonth = new Map<string, ClientEvent[]>();
    for (const e of events) {
      const month = (e.eventTs ?? '').slice(0, 7);
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month)!.push(e);
    }
    return Array.from(byMonth.entries());
  }, [events]);

  return (
    <div className="rounded-lg border border-[color:var(--nfq-border-ghost)] bg-white/[0.02] p-4">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-[color:var(--nfq-cat-a)]" />
          <span className="nfq-label text-[10px] text-[color:var(--nfq-text-secondary)]">{t.clvTimelineTitle}</span>
        </div>
        <span className="font-mono text-[10px] text-[color:var(--nfq-text-faint)]">{events.length} events</span>
      </header>

      {!loading && events.length === 0 && (
        <p className="text-center text-xs text-[color:var(--nfq-text-muted)]">
          {t.clvTimelineEmpty}
        </p>
      )}

      <ul className="space-y-6">
        {grouped.map(([month, batch]) => (
          <li key={month}>
            <div className="nfq-label mb-2 text-[9px] text-[color:var(--nfq-text-faint)]">{month || 'unknown'}</div>
            <ul className="space-y-2 border-l border-[color:var(--nfq-border-ghost)] pl-4">
              {batch.map((e) => {
                const meta = EVENT_META[e.eventType] ?? { icon: History, tone: 'text-[color:var(--nfq-text-secondary)]', label: e.eventType };
                const Icon = meta.icon;
                return (
                  <li key={e.id} className="relative flex items-start gap-3">
                    <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-white/30" />
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.tone}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-mono text-[color:var(--nfq-text-secondary)]">{meta.label}</span>
                        <span className="font-mono text-[10px] text-[color:var(--nfq-text-faint)]">{(e.eventTs ?? '').slice(0, 10)}</span>
                      </div>
                      {e.amountEur !== null && (
                        <div className="font-mono text-[11px] text-[color:var(--nfq-text-muted)]">{fmtEur(e.amountEur)}</div>
                      )}
                      {Object.keys(e.payload).length > 0 && (
                        <div className="mt-1 font-mono text-[10px] text-[color:var(--nfq-text-faint)] break-all">
                          {summarisePayload(e.payload)}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
};

function summarisePayload(p: Record<string, unknown>): string {
  const keys = Object.keys(p).slice(0, 3);
  return keys.map((k) => `${k}=${stringify(p[k])}`).join(' · ');
}
function stringify(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v.length > 24 ? `${v.slice(0, 24)}…` : v;
  return JSON.stringify(v).slice(0, 40);
}

export default ClientTimeline;
