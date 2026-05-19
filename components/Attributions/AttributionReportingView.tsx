import React, { useState } from 'react';
import { BarChart4, AlertTriangle, GitFork, Timer, RefreshCw } from 'lucide-react';
import { useUI } from '../../contexts/UIContext';
import { attributionsTranslations } from '../../translations/index';
import { useAttributionReportingQuery } from '../../hooks/queries/useAttributionsQueries';
import type { AttributionReportingSummary, ByUserEntry, DriftSignal } from '../../utils/attributions/attributionReporter';

type Tab = 'volume' | 'drift' | 'funnel' | 'time';

const fmtBps  = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)} bps`;
const fmtPp   = (v: number) => `${v.toFixed(1)} pp`;
const fmtPct  = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmtEur  = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

/**
 * Attribution Reporting View (Ola 8 Bloque C).
 *
 * 4 tabs sobre el resumen de `/api/attributions/reporting/summary`:
 *   - Volume:  agregados por nivel + decision count breakdown.
 *   - Drift:   señales de patrón sistemático por usuario (warning/breached).
 *   - Funnel:  cuántas decisiones aprobadas/rechazadas/escaladas/etc.
 *   - Time:    placeholder hasta que el server provea pairs (open → resolved).
 */
const AttributionReportingView: React.FC = () => {
  const { language } = useUI();
  const t = attributionsTranslations(language);

  const [windowDays, setWindowDays] = useState<30 | 90 | 180>(90);
  const [tab, setTab] = useState<Tab>('volume');

  const { data, isLoading, isFetching, refetch, isError } = useAttributionReportingQuery(windowDays);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart4 className="h-5 w-5 text-[color:var(--nfq-cat-d)]" />
          <div>
            <h1 className="nfq-headline">
              {t.reportingView}
            </h1>
            <p className="text-xs text-[color:var(--nfq-text-muted)]">{t.reportingSubtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <WindowToggle value={windowDays} onChange={setWindowDays} t={t} />
          <button
            type="button"
            onClick={() => refetch()}
            className="flex items-center gap-1 rounded-md border border-[color:var(--nfq-border-ghost)] bg-transparent px-2 py-1 text-xs text-[color:var(--nfq-text-secondary)] hover:bg-white/5"
          >
            <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
            <span>{t.retry}</span>
          </button>
        </div>
      </header>

      {/* Total decisions summary */}
      <section className="grid gap-3 md:grid-cols-4">
        <Stat label={t.reportingTotalDecisions} value={data ? String(data.totalDecisions) : '—'} />
        <Stat label={t.reportingFunnelApproved}  value={data ? `${data.funnel.approved} (${fmtPct(data.funnel.approvedRate)})` : '—'} />
        <Stat label={t.reportingFunnelRejected}  value={data ? String(data.funnel.rejected)  : '—'} />
        <Stat label={t.reportingFunnelEscalated} value={data ? String(data.funnel.escalated) : '—'} />
      </section>

      {/* Tabs */}
      <nav className="flex flex-wrap gap-1 border-b border-[color:var(--nfq-border-ghost)]">
        <TabButton active={tab === 'volume'} icon={BarChart4} label={t.reportingTabVolume}        onClick={() => setTab('volume')} />
        <TabButton active={tab === 'drift'}  icon={AlertTriangle} label={t.reportingTabDrift}     onClick={() => setTab('drift')} />
        <TabButton active={tab === 'funnel'} icon={GitFork}    label={t.reportingTabFunnel}        onClick={() => setTab('funnel')} />
        <TabButton active={tab === 'time'}   icon={Timer}      label={t.reportingTabTimeToDecision} onClick={() => setTab('time')} />
      </nav>

      {/* Body */}
      <section className="rounded-xl border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)]/40 p-4">
        {isLoading && <div className="py-6 text-center text-xs text-[color:var(--nfq-text-muted)]">{t.loading}</div>}
        {isError && <div className="py-6 text-center text-xs text-[color:var(--nfq-danger)]">{t.cockpitErrorLoading}</div>}
        {data && tab === 'volume' && <VolumeTab summary={data} t={t} />}
        {data && tab === 'drift'  && <DriftTab  drift={data.drift}  byUser={data.byUser} t={t} />}
        {data && tab === 'funnel' && <FunnelTab summary={data} t={t} />}
        {data && tab === 'time'   && <TimeTab   summary={data} t={t} />}
      </section>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

interface TabContentProps {
  summary: AttributionReportingSummary;
  t: ReturnType<typeof attributionsTranslations>;
}

const VolumeTab: React.FC<TabContentProps> = ({ summary, t }) => (
  <div className="space-y-4">
    <h3 className="font-mono text-[10px] uppercase tracking-wide text-[color:var(--nfq-text-muted)]">{t.reportingByLevelTitle}</h3>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-[color:var(--nfq-border-ghost)] text-[10px] uppercase tracking-wide text-[color:var(--nfq-text-muted)]">
          <tr>
            <th className="px-2 py-1">Nivel</th>
            <th className="px-2 py-1 text-right">N</th>
            <th className="px-2 py-1 text-right">Vol total</th>
            <th className="px-2 py-1 text-right">Vol medio</th>
            <th className="px-2 py-1 text-right">RAROC medio</th>
            <th className="px-2 py-1 text-right">Δbps medio</th>
          </tr>
        </thead>
        <tbody>
          {summary.byLevel.map((entry) => (
            <tr key={entry.levelId} className="border-b border-[color:var(--nfq-border-ghost)]">
              <td className="px-2 py-1 text-[color:var(--nfq-text-secondary)]">{entry.level?.name ?? entry.levelId}</td>
              <td className="px-2 py-1 text-right font-mono text-[color:var(--nfq-text-secondary)]">{entry.stats.count}</td>
              <td className="px-2 py-1 text-right font-mono text-[color:var(--nfq-text-secondary)]">{fmtEur(entry.stats.totalEur)}</td>
              <td className="px-2 py-1 text-right font-mono text-[color:var(--nfq-text-secondary)]">{fmtEur(entry.stats.meanEur)}</td>
              <td className="px-2 py-1 text-right font-mono text-[color:var(--nfq-text-secondary)]">{fmtPp(entry.stats.meanRarocPp)}</td>
              <td className="px-2 py-1 text-right font-mono text-[color:var(--nfq-text-secondary)]">{fmtBps(entry.stats.meanDeviationBps)}</td>
            </tr>
          ))}
          {summary.byLevel.length === 0 && (
            <tr><td colSpan={6} className="px-2 py-3 text-center text-[color:var(--nfq-text-faint)]">—</td></tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

interface DriftTabProps {
  drift: DriftSignal[];
  byUser: ByUserEntry[];
  t: ReturnType<typeof attributionsTranslations>;
}

const DriftTab: React.FC<DriftTabProps> = ({ drift, byUser, t }) => {
  if (drift.length === 0) {
    return (
      <div className="rounded-md bg-[var(--nfq-success)]/10 p-3 text-xs text-emerald-200">{t.reportingDriftEmpty}</div>
    );
  }
  const usersById = new Map(byUser.map((u) => [u.userId, u]));
  return (
    <div className="space-y-3">
      <h3 className="font-mono text-[10px] uppercase tracking-wide text-[color:var(--nfq-text-muted)]">{t.reportingByUserTitle}</h3>
      <div className="space-y-2">
        {drift.map((s) => {
          const user = usersById.get(s.userId);
          const tone = s.severity === 'breached' ? 'rose' : 'amber';
          return (
            <article
              key={s.userId}
              className={`rounded-md border p-3 text-xs ${
                tone === 'rose'
                  ? 'border-[color:var(--nfq-danger)]/30 bg-[var(--nfq-danger)]/10'
                  : 'border-[color:var(--nfq-warning)]/30 bg-[var(--nfq-warning)]/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[color:var(--nfq-text-primary)]">{s.userId}</span>
                <span className={`font-mono uppercase ${tone === 'rose' ? 'text-[color:var(--nfq-danger)]' : 'text-[color:var(--nfq-warning)]'}`}>
                  {tone === 'rose' ? t.reportingDriftSeverityBreached : t.reportingDriftSeverityWarning}
                </span>
              </div>
              <div className="mt-1 grid gap-1 text-[11px] text-[color:var(--nfq-text-secondary)] md:grid-cols-3">
                <div>n = {s.count}</div>
                <div>Δbps medio = {fmtBps(s.meanDeviationBps)}</div>
                <div>% al límite = {fmtPct(s.pctAtLimit)}</div>
              </div>
              <ul className="mt-2 list-disc pl-4 text-[11px] text-[color:var(--nfq-text-muted)]">
                {s.reasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
              {user && (
                <div className="mt-2 text-[10px] text-[color:var(--nfq-text-faint)]">
                  Approved rate: {fmtPct(user.approvedRate)}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
};

const FunnelTab: React.FC<TabContentProps> = ({ summary, t }) => {
  const { funnel } = summary;
  if (funnel.total === 0) {
    return <div className="text-xs text-[color:var(--nfq-text-muted)]">{t.reportingFunnelEmpty}</div>;
  }
  const rows: Array<{ label: string; value: number; rate: number }> = [
    { label: t.reportingFunnelApproved,  value: funnel.approved,  rate: funnel.approvedRate },
    { label: t.reportingFunnelRejected,  value: funnel.rejected,  rate: funnel.rejectedRate },
    { label: t.reportingFunnelEscalated, value: funnel.escalated, rate: funnel.total > 0 ? funnel.escalated / funnel.total : 0 },
    { label: t.reportingFunnelExpired,   value: funnel.expired,   rate: funnel.expiredRate },
    { label: t.reportingFunnelReverted,  value: funnel.reverted,  rate: funnel.total > 0 ? funnel.reverted / funnel.total : 0 },
  ];
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-3">
          <span className="w-32 font-mono text-[10px] uppercase tracking-wide text-[color:var(--nfq-text-muted)]">
            {row.label}
          </span>
          <div className="relative h-5 flex-1 overflow-hidden rounded bg-[var(--nfq-bg-root)]/40">
            <div
              className="absolute inset-y-0 left-0 bg-[var(--nfq-success)]/40"
              style={{ width: `${Math.min(100, row.rate * 100)}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-end pr-2 font-mono text-[11px] text-[color:var(--nfq-text-primary)]">
              {row.value} · {fmtPct(row.rate)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

const TimeTab: React.FC<TabContentProps> = ({ summary, t }) => {
  if (!summary.timeToDecision) {
    return <div className="text-xs text-[color:var(--nfq-text-muted)]">{t.reportingTimeNotAvailable}</div>;
  }
  const { meanMs, medianMs, p95Ms, count, byLevel } = summary.timeToDecision;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="N"          value={String(count)} />
        <Stat label="Media"      value={fmtMs(meanMs)} />
        <Stat label="Mediana"    value={fmtMs(medianMs)} />
        <Stat label="p95"        value={fmtMs(p95Ms)} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[color:var(--nfq-border-ghost)] text-[10px] uppercase tracking-wide text-[color:var(--nfq-text-muted)]">
            <tr>
              <th className="px-2 py-1">Nivel</th>
              <th className="px-2 py-1 text-right">N</th>
              <th className="px-2 py-1 text-right">Mediana</th>
              <th className="px-2 py-1 text-right">p95</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(byLevel).map(([levelId, entry]) => (
              <tr key={levelId} className="border-b border-[color:var(--nfq-border-ghost)]">
                <td className="px-2 py-1 text-[color:var(--nfq-text-secondary)]">{levelId}</td>
                <td className="px-2 py-1 text-right font-mono text-[color:var(--nfq-text-secondary)]">{entry.count}</td>
                <td className="px-2 py-1 text-right font-mono text-[color:var(--nfq-text-secondary)]">{fmtMs(entry.medianMs)}</td>
                <td className="px-2 py-1 text-right font-mono text-[color:var(--nfq-text-secondary)]">{fmtMs(entry.p95Ms)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components + helpers
// ---------------------------------------------------------------------------

function fmtMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(1)} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} d`;
}

interface StatProps { label: string; value: string }
const Stat: React.FC<StatProps> = ({ label, value }) => (
  <div className="rounded-md border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)]/40 px-4 py-3">
    <div className="font-mono text-[10px] uppercase tracking-wide text-[color:var(--nfq-text-muted)]">{label}</div>
    <div className="font-mono text-lg font-semibold text-[color:var(--nfq-text-primary)]">{value}</div>
  </div>
);

interface TabButtonProps { active: boolean; icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }
const TabButton: React.FC<TabButtonProps> = ({ active, icon: Icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-1 rounded-t-md px-3 py-1.5 text-xs ${
      active
        ? 'border-b-2 border-[color:var(--nfq-success)] text-[color:var(--nfq-success)]'
        : 'text-[color:var(--nfq-text-muted)] hover:text-[color:var(--nfq-text-secondary)]'
    }`}
  >
    <Icon className="h-3 w-3" />
    {label}
  </button>
);

interface WindowToggleProps {
  value: 30 | 90 | 180;
  onChange: (v: 30 | 90 | 180) => void;
  t: ReturnType<typeof attributionsTranslations>;
}
const WindowToggle: React.FC<WindowToggleProps> = ({ value, onChange, t }) => {
  const opts: Array<{ value: 30 | 90 | 180; label: string }> = [
    { value: 30,  label: t.reportingWindow30 },
    { value: 90,  label: t.reportingWindow90 },
    { value: 180, label: t.reportingWindow180 },
  ];
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-[color:var(--nfq-border-ghost)]">
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 text-xs font-mono ${
            value === o.value ? 'bg-[var(--nfq-success)]/20 text-emerald-200' : 'text-[color:var(--nfq-text-muted)] hover:text-[color:var(--nfq-text-secondary)]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
};

export default AttributionReportingView;
export { fmtMs };
