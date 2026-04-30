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
  onboarding:        { icon: Sparkles,           tone: 'text-sky-300',     label: 'Onboarding' },
  deal_booked:       { icon: CircleDollarSign,   tone: 'text-emerald-300', label: 'Deal booked' },
  deal_cancelled:    { icon: XCircle,            tone: 'text-rose-300',    label: 'Deal cancelled' },
  crosssell_attempt: { icon: Handshake,          tone: 'text-amber-300',   label: 'Crosssell attempt' },
  crosssell_won:     { icon: Handshake,          tone: 'text-emerald-300', label: 'Crosssell won' },
  claim:             { icon: AlertTriangle,      tone: 'text-rose-300',    label: 'Claim' },
  churn_signal:      { icon: MessageSquareWarning, tone: 'text-rose-300',  label: 'Churn signal' },
  contact:           { icon: Phone,              tone: 'text-slate-300',   label: 'Contact' },
  price_review:      { icon: RefreshCw,          tone: 'text-violet-300',  label: 'Price review' },
  committee_review:  { icon: Gavel,              tone: 'text-violet-300',  label: 'Committee review' },
  nba_generated:     { icon: Sparkles,           tone: 'text-sky-300',     label: 'NBA generated' },
  nba_consumed:      { icon: Handshake,          tone: 'text-emerald-300', label: 'NBA consumed' },
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
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-sky-400" />
          <span className="nfq-label text-[10px] text-slate-300">{t.clvTimelineTitle}</span>
        </div>
        <span className="font-mono text-[10px] text-slate-500">{events.length} events</span>
      </header>

      {!loading && events.length === 0 && (
        <p className="text-center text-xs text-slate-400">
          {t.clvTimelineEmpty}
        </p>
      )}

      <ul className="space-y-6">
        {grouped.map(([month, batch]) => (
          <li key={month}>
            <div className="nfq-label mb-2 text-[9px] text-slate-500">{month || 'unknown'}</div>
            <ul className="space-y-2 border-l border-white/10 pl-4">
              {batch.map((e) => {
                const meta = EVENT_META[e.eventType] ?? { icon: History, tone: 'text-slate-300', label: e.eventType };
                const Icon = meta.icon;
                return (
                  <li key={e.id} className="relative flex items-start gap-3">
                    <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-white/30" />
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.tone}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-mono text-slate-200">{meta.label}</span>
                        <span className="font-mono text-[10px] text-slate-500">{(e.eventTs ?? '').slice(0, 10)}</span>
                      </div>
                      {e.amountEur !== null && (
                        <div className="font-mono text-[11px] text-slate-400">{fmtEur(e.amountEur)}</div>
                      )}
                      {Object.keys(e.payload).length > 0 && (
                        <div className="mt-1 font-mono text-[10px] text-slate-500 break-all">
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
