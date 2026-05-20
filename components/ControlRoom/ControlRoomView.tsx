import React, { useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertTriangle,
  ArrowRight,
  BarChart4,
  Bell,
  CheckCircle2,
  DatabaseZap,
  FileText,
  Plus,
  TimerReset,
  GitPullRequestArrow,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { viewToPath } from '../../appNavigation';
import EmptyStateBanner from '../ui/EmptyStateBanner';
import type { Transaction } from '../../types';

function exposure(deals: Transaction[]): number {
  return deals.reduce((sum, deal) => sum + (Number.isFinite(deal.amount) ? deal.amount : 0), 0);
}

function formatMoney(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}bn`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  return `${Math.round(value).toLocaleString('en-US')}`;
}

function isStaleSource(lastSyncAt: string | undefined): boolean {
  if (!lastSyncAt) return true;
  const ts = Date.parse(lastSyncAt);
  return !Number.isFinite(ts) || Date.now() - ts > 24 * 60 * 60 * 1000;
}

const ControlRoomView: React.FC = () => {
  const data = useData();
  const { t, workspaceMode } = useUI();
  const navigate = useNavigate();

  const pending = data.deals.filter((deal) => deal.status === 'Pending_Approval');
  const review = data.deals.filter((deal) => deal.status === 'Review' || deal.status === 'Pending');
  const rejected = data.deals.filter((deal) => deal.status === 'Rejected');
  const pendingApprovalTasks = data.approvalTasks.filter((task) => task.status === 'Pending');
  const overdueApprovalTasks = pendingApprovalTasks.filter((task) => {
    if (!task.dueAt) return false;
    return Date.parse(task.dueAt) < Date.now();
  });
  const pendingMethodologyChanges = data.methodologyChangeRequests.filter((request) => request.status === 'Pending_Review');
  const actionDeals = [...pending, ...review].slice(0, 5);
  const activeSources = data.marketDataSources.filter((source) => source.status === 'Active');
  const staleSources = data.marketDataSources.filter((source) => isStaleSource(source.lastSyncAt));

  const recommended = useMemo(() => {
    if (workspaceMode === 'Risk') {
      return [
        { label: t.controlRoomStressPricing, path: viewToPath('STRESS_PRICING'), icon: TrendingUp },
        { label: t.controlRoomDiscipline, path: viewToPath('DISCIPLINE'), icon: BarChart4 },
        { label: t.controlRoomApprovals, path: viewToPath('APPROVALS'), icon: ShieldCheck },
      ];
    }
    if (workspaceMode === 'Admin') {
      return [
        { label: t.controlRoomMarketData, path: viewToPath('MARKET_DATA'), icon: DatabaseZap },
        { label: t.controlRoomMethodology, path: viewToPath('METHODOLOGY'), icon: FileText },
        { label: t.controlRoomHealth, path: viewToPath('HEALTH'), icon: Bell },
      ];
    }
    return [
      { label: t.controlRoomNewQuote, path: viewToPath('CALCULATOR'), icon: GitPullRequestArrow },
      { label: t.controlRoomPipeline, path: viewToPath('PIPELINE'), icon: Users },
      { label: t.controlRoomApprovals, path: viewToPath('APPROVALS'), icon: ShieldCheck },
    ];
  }, [t, workspaceMode]);

  return (
    <div data-testid="control-room-view" className="flex min-h-0 flex-1 flex-col gap-4">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Kpi label={t.controlRoomActionQueue} value={pending.length + review.length + pendingApprovalTasks.length} sublabel={t.controlRoomActionQueueSub} tone="amber" />
        <Kpi label={t.controlRoomExposure} value={formatMoney(exposure(data.deals))} sublabel={t.controlRoomExposureSub} tone="cyan" />
        <Kpi label={t.controlRoomDataFreshness} value={staleSources.length} sublabel={t.controlRoomDataFreshnessSub} tone={staleSources.length ? 'amber' : 'emerald'} />
        <Kpi label={t.controlRoomExceptions} value={rejected.length} sublabel={t.controlRoomExceptionsSub} tone={rejected.length ? 'rose' : 'emerald'} />
      </section>

      <section className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div data-testid="control-room-decision-queue" className="min-h-0 rounded-lg bg-[var(--nfq-bg-surface)] p-4 shadow-[var(--nfq-shadow-soft)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="nfq-eyebrow">{t.controlRoomToday}</div>
              <h2 className="mt-2 text-xl font-semibold text-[color:var(--nfq-text-primary)]">{t.controlRoomDecisions}</h2>
            </div>
            <button className="nfq-button nfq-button-secondary" onClick={() => navigate(viewToPath('BLOTTER'))}>
              {t.controlRoomOpenBlotter}
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="space-y-2">
            {actionDeals.length ? actionDeals.map((deal) => (
              <button
                key={deal.id ?? `${deal.clientId}-${deal.productType}`}
                type="button"
                onClick={() => navigate(deal.id ? `/deals/${encodeURIComponent(deal.id)}/timeline` : viewToPath('CALCULATOR'))}
                className="grid w-full gap-3 rounded-lg border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] p-3 text-left transition-colors hover:border-[color:rgba(var(--nfq-accent-rgb),0.38)] md:grid-cols-[1fr_auto]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-[color:var(--nfq-accent)]">{deal.id ?? t.commandDraftDeal}</span>
                    <span className="rounded-full bg-[var(--nfq-warning)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--nfq-warning)]">
                      {deal.status ?? 'Draft'}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-sm font-medium text-[color:var(--nfq-text-primary)]">
                    {deal.clientId} · {deal.productType} · {deal.currency}
                  </div>
                </div>
                <div className="font-mono text-sm font-semibold text-[color:var(--nfq-text-primary)]">
                  {formatMoney(deal.amount)}
                </div>
              </button>
            )) : (
              <EmptyStateBanner
                variant="no-snapshot"
                title={t.controlRoomNoActionsTitle}
                body={t.controlRoomNoActions}
                data-testid="controlroom-no-actions"
                actions={[
                  {
                    label: t.controlRoomOpenBlotter,
                    onClick: () => navigate('/blotter'),
                    variant: 'primary',
                  },
                  {
                    label: t.controlRoomNoActionsCta,
                    onClick: () => navigate('/pricing'),
                    icon: Plus,
                    variant: 'ghost',
                  },
                ]}
              />
            )}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-lg bg-[var(--nfq-bg-surface)] p-4 shadow-[var(--nfq-shadow-soft)]">
            <div className="nfq-eyebrow">{t.controlRoomRecommended}</div>
            <div className="mt-3 grid gap-2">
              {recommended.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => navigate(item.path)}
                    className="flex items-center justify-between rounded-lg border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] px-3 py-3 text-sm text-[color:var(--nfq-text-primary)] transition-colors hover:border-[color:rgba(var(--nfq-accent-rgb),0.38)]"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon size={16} />
                      {item.label}
                    </span>
                    <ArrowRight size={14} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg bg-[var(--nfq-bg-surface)] p-4 shadow-[var(--nfq-shadow-soft)]">
            <div className="nfq-eyebrow">{t.controlRoomMarketReadiness}</div>
            <div className="mt-3 space-y-2 text-sm">
              <ReadinessRow ok={activeSources.length > 0} label={t.controlRoomActiveSources} value={String(activeSources.length)} />
              <ReadinessRow ok={data.yieldCurves.length > 0} label={t.controlRoomYieldCurvePoints} value={String(data.yieldCurves.length)} />
              <ReadinessRow ok={data.liquidityCurves.length > 0} label={t.controlRoomLiquidityCurves} value={String(data.liquidityCurves.length)} />
              <ReadinessRow ok={data.pricingDossiers.length > 0} label={t.controlRoomDossiers} value={String(data.pricingDossiers.length)} />
            </div>
          </div>

          <div className="rounded-lg bg-[var(--nfq-bg-surface)] p-4 shadow-[var(--nfq-shadow-soft)]">
            <div className="nfq-eyebrow">{t.controlRoomOperationalSignals}</div>
            <div className="mt-3 space-y-2 text-sm">
              <ReadinessRow ok={pendingApprovalTasks.length === 0} label={t.controlRoomPendingApprovals} value={String(pendingApprovalTasks.length)} />
              <ReadinessRow ok={overdueApprovalTasks.length === 0} label={t.controlRoomOverdueApprovals} value={String(overdueApprovalTasks.length)} />
              <ReadinessRow ok={pendingMethodologyChanges.length === 0} label={t.controlRoomMethodologyChanges} value={String(pendingMethodologyChanges.length)} />
              <ReadinessRow ok={data.syncStatus === 'synced' || data.syncStatus === 'mock'} label={t.controlRoomSyncState} value={data.syncStatus} icon={TimerReset} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

function Kpi({ label, value, sublabel, tone }: { label: string; value: React.ReactNode; sublabel: string; tone: 'amber' | 'cyan' | 'emerald' | 'rose' }) {
  const toneClass = {
    amber: 'text-[color:var(--nfq-warning)]',
    cyan: 'text-[color:var(--nfq-accent)]',
    emerald: 'text-[color:var(--nfq-success)]',
    rose: 'text-[color:var(--nfq-danger)]',
  }[tone];
  return (
    <div className="rounded-lg bg-[var(--nfq-bg-surface)] p-4 shadow-[var(--nfq-shadow-soft)]">
      <div className="nfq-label">{label}</div>
      <div className={`font-mono-nums mt-3 text-3xl font-semibold ${toneClass}`}>{value}</div>
      <div className="mt-1 text-xs text-[color:var(--nfq-text-muted)]">{sublabel}</div>
    </div>
  );
}

function ReadinessRow({ ok, label, value, icon: IconOverride }: { ok: boolean; label: string; value: string; icon?: typeof TimerReset }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-[var(--nfq-bg-elevated)] px-3 py-2">
      <span className="inline-flex min-w-0 items-center gap-2 text-[color:var(--nfq-text-secondary)]">
        {IconOverride ? (
          <IconOverride size={15} className={ok ? 'text-[color:var(--nfq-success)]' : 'text-[color:var(--nfq-warning)]'} />
        ) : ok ? (
          <CheckCircle2 size={15} className="text-[color:var(--nfq-success)]" />
        ) : (
          <AlertTriangle size={15} className="text-[color:var(--nfq-warning)]" />
        )}
        {label}
      </span>
      <span className="font-mono text-[color:var(--nfq-text-primary)]">{value}</span>
    </div>
  );
}

export default ControlRoomView;
