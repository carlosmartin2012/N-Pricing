import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { CheckCircle2, XCircle, ArrowUpRight, Inbox, ShieldCheck, AlertTriangle, RefreshCw } from 'lucide-react';
import { useUI } from '../../contexts/UIContext';
import { attributionsTranslations } from '../../translations/index';
import {
  useAttributionDecisionsQuery,
  useAttributionMatrixQuery,
  useRecordDecisionMutation,
} from '../../hooks/queries/useAttributionsQueries';
import type {
  AttributionDecision,
  AttributionDecisionStatus,
  AttributionLevel,
} from '../../types/attributions';

const fmtBps = (v: number): string => `${v >= 0 ? '+' : ''}${v.toFixed(1)} bps`;
const fmtPp = (v: number): string => `${v.toFixed(1)} pp`;
const fmtEur = (v: number): string =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
const fillDeal = (template: string, dealId: string): string => template.replace('{deal}', dealId);

interface PendingItem {
  decision: AttributionDecision;
  requiredLevel: AttributionLevel | null;
}

/**
 * Approval Cockpit (Ola 8 Bloque B) — bandeja por figura comercial.
 *
 * Lista decisiones pendientes (decision='escalated') con KPIs agregados y
 * acciones inline. La aprobación está deshabilitada si la decisión cae bajo
 * el hard floor regulatorio (`routingMetadata.deviationBps` cruza el floor;
 * preventivamente — la verdad final está en el motor server-side).
 *
 * Filtros:
 *   - levelId opcional: bandeja específica de un nivel (e.g. "lo que me toca
 *     a mí como Director Oficina"). Si no se pasa, lista todo lo escalado.
 */
const ApprovalCockpit: React.FC = () => {
  const { language } = useUI();
  const t = attributionsTranslations(language);
  const [searchParams] = useSearchParams();
  const focusParam = searchParams.get('focus')?.trim() || null;

  const matrixQuery = useAttributionMatrixQuery();
  const decisionsQuery = useAttributionDecisionsQuery({ limit: 200 });
  const recordDecision = useRecordDecisionMutation();

  // Map level_id → AttributionLevel para enriquecer pending items.
  const levelsById = useMemo(() => {
    const map = new Map<string, AttributionLevel>();
    if (matrixQuery.data) {
      for (const l of matrixQuery.data.levels) map.set(l.id, l);
    }
    return map;
  }, [matrixQuery.data]);

  const pending: PendingItem[] = useMemo(() => {
    const items = decisionsQuery.data?.items ?? [];
    return items
      .filter((d) => d.decision === 'escalated')
      .map((d) => ({
        decision: d,
        requiredLevel: levelsById.get(d.requiredLevelId) ?? null,
      }));
  }, [decisionsQuery.data, levelsById]);

  // KPIs agregados sobre la bandeja
  const kpis = useMemo(() => {
    if (pending.length === 0) {
      return { count: 0, volume: 0, meanRaroc: 0, meanDriftBps: 0 };
    }
    const totalVol = pending.reduce((acc, p) => acc + (p.decision.routingMetadata.volumeEur ?? 0), 0);
    const totalRaroc = pending.reduce((acc, p) => acc + (p.decision.routingMetadata.rarocPp ?? 0), 0);
    const totalDrift = pending.reduce((acc, p) => acc + (p.decision.routingMetadata.deviationBps ?? 0), 0);
    return {
      count:        pending.length,
      volume:       totalVol,
      meanRaroc:    totalRaroc / pending.length,
      meanDriftBps: totalDrift / pending.length,
    };
  }, [pending]);

  const isLoading = decisionsQuery.isLoading || matrixQuery.isLoading;
  const error = decisionsQuery.isError;

  const focusedItem = useMemo(() => {
    if (!focusParam) return null;
    return pending.find((p) =>
      p.decision.dealId === focusParam || p.decision.id === focusParam,
    ) ?? null;
  }, [focusParam, pending]);
  const focusedDecisionId = focusedItem?.decision.id ?? null;

  useEffect(() => {
    if (!focusedDecisionId) return;
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>('[data-approval-focus-target]'),
    ).filter((el) => el.dataset.approvalFocusTarget === focusedDecisionId);
    const visibleTarget = targets.find((el) => el.offsetParent !== null || el.getClientRects().length > 0)
      ?? targets[0];
    if (visibleTarget && typeof visibleTarget.scrollIntoView === 'function') {
      visibleTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusedDecisionId, pending.length]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Inbox className="h-5 w-5 text-[color:var(--nfq-cat-d)]" />
          <div>
            <h2 className="font-mono text-sm font-bold uppercase tracking-tight text-[color:var(--nfq-text-primary)]">
              {t.cockpitTitle}
            </h2>
            <p className="text-xs text-[color:var(--nfq-text-muted)]">{t.cockpitSubtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => decisionsQuery.refetch()}
          className="flex items-center gap-1 rounded-md border border-[color:var(--nfq-border-ghost)] bg-transparent px-2 py-1 text-xs text-[color:var(--nfq-text-secondary)] hover:bg-white/5"
        >
          <RefreshCw className={`h-3 w-3 ${decisionsQuery.isFetching ? 'animate-spin' : ''}`} />
          <span>{t.retry}</span>
        </button>
      </header>

      {/* KPIs */}
      <section className="grid gap-3 md:grid-cols-4">
        <Kpi label={t.cockpitPendingCount}     value={String(kpis.count)} />
        <Kpi label={t.cockpitAggregateVolume}  value={fmtEur(kpis.volume)} />
        <Kpi label={t.cockpitMeanRaroc}        value={fmtPp(kpis.meanRaroc)} />
        <Kpi label={t.cockpitMeanDrift}        value={fmtBps(kpis.meanDriftBps)} />
      </section>

      {focusParam && !isLoading && !error && (
        <div
          data-testid="approval-focus-status"
          className={`rounded-md border px-3 py-2 text-xs ${
            focusedItem
              ? 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100'
              : 'border-amber-400/30 bg-amber-500/10 text-amber-100'
          }`}
          role="status"
        >
          {fillDeal(
            focusedItem ? t.cockpitFocusFound : t.cockpitFocusMissing,
            focusParam,
          )}
        </div>
      )}

      {/* Bandeja */}
      <section className="rounded-xl border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)]/40">
        {isLoading && (
          <div className="p-6 text-center text-xs text-[color:var(--nfq-text-muted)]">{t.loading}</div>
        )}
        {error && (
          <div className="p-6 text-center text-xs text-[color:var(--nfq-danger)]">{t.cockpitErrorLoading}</div>
        )}
        {!isLoading && !error && pending.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <ShieldCheck className="h-6 w-6 text-[color:var(--nfq-success)]" />
            <p className="text-sm text-[color:var(--nfq-text-secondary)]">{t.cockpitEmpty}</p>
          </div>
        )}
        {!isLoading && !error && pending.length > 0 && (
          <>
            {/* Desktop: tabla. Mobile: oculta — cards debajo. */}
            <table className="hidden w-full text-left text-sm md:table" role="table">
              <thead className="border-b border-[color:var(--nfq-border-ghost)] text-[10px] uppercase tracking-wide text-[color:var(--nfq-text-muted)]">
                <tr>
                  <th className="px-4 py-2">{t.cockpitDeal}</th>
                  <th className="px-4 py-2 text-right">{t.cockpitDeviation}</th>
                  <th className="px-4 py-2 text-right">{t.cockpitRaroc}</th>
                  <th className="px-4 py-2 text-right">{t.cockpitVolume}</th>
                  <th className="px-4 py-2">{t.simulatorRequiredLevel}</th>
                  <th className="px-4 py-2 text-right">{t.cockpitAction}</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => (
                  <PendingRow
                    key={p.decision.id}
                    item={p}
                    focused={p.decision.id === focusedDecisionId}
                    onDecide={(decision, reason) =>
                      recordDecision.mutate({
                        dealId: p.decision.dealId,
                        input: {
                          requiredLevelId:     p.decision.requiredLevelId,
                          decidedByLevelId:    p.decision.requiredLevelId,
                          decision,
                          reason,
                          pricingSnapshotHash: p.decision.pricingSnapshotHash,
                          routingMetadata:     p.decision.routingMetadata,
                        },
                      })
                    }
                    pending={recordDecision.isPending}
                    t={t}
                  />
                ))}
              </tbody>
            </table>

            {/* Mobile cards (Ola 10 Bloque C): apilados, sin scroll horizontal. */}
            <div className="space-y-2 p-2 md:hidden" data-testid="approval-cockpit-mobile-cards">
              {pending.map((p) => (
                <PendingCard
                  key={p.decision.id}
                  item={p}
                  focused={p.decision.id === focusedDecisionId}
                  onDecide={(decision, reason) =>
                    recordDecision.mutate({
                      dealId: p.decision.dealId,
                      input: {
                        requiredLevelId:     p.decision.requiredLevelId,
                        decidedByLevelId:    p.decision.requiredLevelId,
                        decision,
                        reason,
                        pricingSnapshotHash: p.decision.pricingSnapshotHash,
                        routingMetadata:     p.decision.routingMetadata,
                      },
                    })
                  }
                  pending={recordDecision.isPending}
                  t={t}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface KpiProps { label: string; value: string }
const Kpi: React.FC<KpiProps> = ({ label, value }) => (
  <div className="rounded-md border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)]/40 px-4 py-3">
    <div className="font-mono text-[10px] uppercase tracking-wide text-[color:var(--nfq-text-muted)]">{label}</div>
    <div className="font-mono text-lg font-semibold text-[color:var(--nfq-text-primary)]">{value}</div>
  </div>
);

interface PendingRowProps {
  item: PendingItem;
  pending: boolean;
  focused?: boolean;
  t: ReturnType<typeof attributionsTranslations>;
  onDecide: (decision: AttributionDecisionStatus, reason: string) => void;
}

const PendingRow: React.FC<PendingRowProps> = ({ item, pending, focused = false, t, onDecide }) => {
  const [confirming, setConfirming] = useState<AttributionDecisionStatus | null>(null);
  const [reason, setReason] = useState('');
  const meta = item.decision.routingMetadata;
  const belowFloor = (meta.deviationBps ?? 0) <= -100;

  const submit = (decision: AttributionDecisionStatus) => {
    onDecide(decision, reason);
    setConfirming(null);
    setReason('');
  };

  return (
    <>
      <tr
        data-testid={focused ? 'approval-focused-row' : undefined}
        data-focused={focused ? 'true' : undefined}
        data-approval-focus-target={item.decision.id}
        tabIndex={focused ? -1 : undefined}
        className={`scroll-mt-24 border-b border-[color:var(--nfq-border-ghost)] hover:bg-white/[0.02] ${
          focused ? 'bg-cyan-500/10 outline outline-1 outline-cyan-400/50' : ''
        }`}
      >
        <td className="px-4 py-2 font-mono text-xs text-[color:var(--nfq-text-secondary)]">{item.decision.dealId}</td>
        <td className={`px-4 py-2 text-right font-mono text-xs ${meta.deviationBps < 0 ? 'text-[color:var(--nfq-warning)]' : 'text-[color:var(--nfq-text-secondary)]'}`}>
          {fmtBps(meta.deviationBps)}
        </td>
        <td className="px-4 py-2 text-right font-mono text-xs text-[color:var(--nfq-text-secondary)]">{fmtPp(meta.rarocPp)}</td>
        <td className="px-4 py-2 text-right font-mono text-xs text-[color:var(--nfq-text-secondary)]">{fmtEur(meta.volumeEur)}</td>
        <td className="px-4 py-2 text-xs text-[color:var(--nfq-text-secondary)]">
          {item.requiredLevel?.name ?? <span className="text-[color:var(--nfq-text-faint)]">—</span>}
        </td>
        <td className="px-4 py-2 text-right">
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              disabled={pending || belowFloor}
              onClick={() => setConfirming('approved')}
              title={belowFloor ? t.cockpitBelowFloorBlocked : t.cockpitApprove}
              className="rounded border border-emerald-500/30 bg-emerald-500/10 p-1 text-[color:var(--nfq-success)] hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={t.cockpitApprove}
            >
              <CheckCircle2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming('rejected')}
              title={t.cockpitReject}
              className="rounded border border-rose-500/30 bg-rose-500/10 p-1 text-[color:var(--nfq-danger)] hover:bg-rose-500/20 disabled:opacity-40"
              aria-label={t.cockpitReject}
            >
              <XCircle className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming('escalated')}
              title={t.cockpitEscalate}
              className="rounded border border-[color:var(--nfq-border-ghost)] bg-white/5 p-1 text-[color:var(--nfq-text-secondary)] hover:bg-white/10 disabled:opacity-40"
              aria-label={t.cockpitEscalate}
            >
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
      {confirming && (
        <tr className="border-b border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-root)]/40">
          <td colSpan={6} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              {belowFloor && confirming === 'approved' && (
                <span className="flex items-center gap-1 text-xs text-[color:var(--nfq-danger)]">
                  <AlertTriangle className="h-3 w-3" />
                  {t.cockpitBelowFloorBlocked}
                </span>
              )}
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t.cockpitDecisionReason}
                className="flex-1 min-w-[220px] rounded border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)]/60 px-2 py-1 text-xs text-[color:var(--nfq-text-primary)] placeholder:text-[color:var(--nfq-text-faint)]"
              />
              <button
                type="button"
                onClick={() => submit(confirming)}
                disabled={pending || (belowFloor && confirming === 'approved')}
                className="rounded bg-emerald-500/80 px-3 py-1 text-xs font-medium text-[color:var(--nfq-text-primary)] hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-[var(--nfq-bg-bright)]"
              >
                {confirming === 'approved' && t.cockpitConfirmApprove}
                {confirming === 'rejected' && t.cockpitConfirmReject}
                {confirming === 'escalated' && t.cockpitConfirmEscalate}
              </button>
              <button
                type="button"
                onClick={() => { setConfirming(null); setReason(''); }}
                className="rounded border border-[color:var(--nfq-border-ghost)] px-3 py-1 text-xs text-[color:var(--nfq-text-secondary)] hover:bg-white/5"
              >
                {t.matrixCancel}
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// PendingCard (Ola 10 Bloque C — mobile-first)
// ---------------------------------------------------------------------------

interface PendingCardProps {
  item: PendingItem;
  pending: boolean;
  focused?: boolean;
  t: ReturnType<typeof attributionsTranslations>;
  onDecide: (decision: AttributionDecisionStatus, reason: string) => void;
}

const PendingCard: React.FC<PendingCardProps> = ({ item, pending, focused = false, t, onDecide }) => {
  const [confirming, setConfirming] = useState<AttributionDecisionStatus | null>(null);
  const [reason, setReason] = useState('');
  const meta = item.decision.routingMetadata;
  const belowFloor = (meta.deviationBps ?? 0) <= -100;

  const submit = (decision: AttributionDecisionStatus) => {
    onDecide(decision, reason);
    setConfirming(null);
    setReason('');
  };

  return (
    <article
      data-testid="approval-cockpit-card"
      data-focused={focused ? 'true' : undefined}
      data-approval-focus-target={item.decision.id}
      tabIndex={focused ? -1 : undefined}
      className={`scroll-mt-24 rounded-xl border bg-[var(--nfq-bg-elevated)]/40 p-3 text-sm ${
        focused ? 'border-cyan-400/50 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.35)]' : 'border-[color:var(--nfq-border-ghost)]'
      }`}
    >
      <header className="flex items-center justify-between">
        <span className="font-mono text-xs text-[color:var(--nfq-text-secondary)]">{item.decision.dealId}</span>
        {item.requiredLevel && (
          <span className="rounded-full border border-[color:var(--nfq-border-ghost)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[color:var(--nfq-text-secondary)]">
            {item.requiredLevel.name}
          </span>
        )}
      </header>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="font-mono text-[9px] uppercase tracking-wide text-[color:var(--nfq-text-muted)]">{t.cockpitDeviation}</dt>
          <dd className={`font-mono ${meta.deviationBps < 0 ? 'text-[color:var(--nfq-warning)]' : 'text-[color:var(--nfq-text-secondary)]'}`}>
            {fmtBps(meta.deviationBps)}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[9px] uppercase tracking-wide text-[color:var(--nfq-text-muted)]">{t.cockpitRaroc}</dt>
          <dd className="font-mono text-[color:var(--nfq-text-secondary)]">{fmtPp(meta.rarocPp)}</dd>
        </div>
        <div>
          <dt className="font-mono text-[9px] uppercase tracking-wide text-[color:var(--nfq-text-muted)]">{t.cockpitVolume}</dt>
          <dd className="font-mono text-[color:var(--nfq-text-secondary)]">{fmtEur(meta.volumeEur)}</dd>
        </div>
      </dl>

      {/* Botones grandes touch-friendly */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          disabled={pending || belowFloor}
          onClick={() => setConfirming('approved')}
          className="flex items-center justify-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-2 text-xs text-[color:var(--nfq-success)] hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={t.cockpitApprove}
        >
          <CheckCircle2 className="h-4 w-4" />
          {t.cockpitApprove}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming('rejected')}
          className="flex items-center justify-center gap-1 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-2 text-xs text-[color:var(--nfq-danger)] hover:bg-rose-500/20 disabled:opacity-40"
          aria-label={t.cockpitReject}
        >
          <XCircle className="h-4 w-4" />
          {t.cockpitReject}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming('escalated')}
          className="flex items-center justify-center gap-1 rounded border border-[color:var(--nfq-border-ghost)] bg-white/5 px-2 py-2 text-xs text-[color:var(--nfq-text-secondary)] hover:bg-white/10 disabled:opacity-40"
          aria-label={t.cockpitEscalate}
        >
          <ArrowUpRight className="h-4 w-4" />
          {t.cockpitEscalate}
        </button>
      </div>

      {confirming && (
        <div className="mt-3 space-y-2 rounded-md border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-root)]/40 p-3">
          {belowFloor && confirming === 'approved' && (
            <span className="flex items-center gap-1 text-xs text-[color:var(--nfq-danger)]">
              <AlertTriangle className="h-3 w-3" />
              {t.cockpitBelowFloorBlocked}
            </span>
          )}
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t.cockpitDecisionReason}
            className="w-full rounded border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)]/60 px-2 py-2 text-xs text-[color:var(--nfq-text-primary)] placeholder:text-[color:var(--nfq-text-faint)]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => submit(confirming)}
              disabled={pending || (belowFloor && confirming === 'approved')}
              className="flex-1 rounded bg-emerald-500/80 px-3 py-2 text-xs font-medium text-[color:var(--nfq-text-primary)] hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-[var(--nfq-bg-bright)]"
            >
              {confirming === 'approved' && t.cockpitConfirmApprove}
              {confirming === 'rejected' && t.cockpitConfirmReject}
              {confirming === 'escalated' && t.cockpitConfirmEscalate}
            </button>
            <button
              type="button"
              onClick={() => { setConfirming(null); setReason(''); }}
              className="flex-1 rounded border border-[color:var(--nfq-border-ghost)] px-3 py-2 text-xs text-[color:var(--nfq-text-secondary)] hover:bg-white/5"
            >
              {t.matrixCancel}
            </button>
          </div>
        </div>
      )}
    </article>
  );
};

export default ApprovalCockpit;
