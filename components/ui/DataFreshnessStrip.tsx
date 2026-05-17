import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, DatabaseZap, RadioTower, ShieldCheck } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useEntity } from '../../contexts/EntityContext';
import { useUI } from '../../contexts/UIContext';

function ageLabel(iso: string | undefined, unavailable: string): string {
  if (!iso) return unavailable;
  const ts = parseTimestamp(iso);
  if (!Number.isFinite(ts)) return unavailable;
  const minutes = Math.max(0, Math.round((Date.now() - ts) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function parseTimestamp(iso: string | undefined): number {
  if (!iso) return Number.NaN;
  const ts = Date.parse(iso);
  return Number.isFinite(ts) ? ts : Number.NaN;
}

export const DataFreshnessStrip: React.FC = () => {
  const data = useData();
  const { activeEntity } = useEntity();
  const { t, workspaceMode } = useUI();

  const latestSource = useMemo(() => {
    const synced = data.marketDataSources
      .filter((source) => source.lastSyncAt)
      .sort((a, b) => Date.parse(b.lastSyncAt ?? '') - Date.parse(a.lastSyncAt ?? ''))[0];
    return synced ?? data.marketDataSources[0] ?? null;
  }, [data.marketDataSources]);

  const activeSourceCount = data.marketDataSources.filter((source) => source.status === 'Active').length;
  const curveTenorCount = data.yieldCurves.length;
  const liquidityCount = data.liquidityCurves.reduce((count, curve) => count + curve.points.length, 0);
  const latestSyncTs = parseTimestamp(latestSource?.lastSyncAt);
  const stale = !Number.isFinite(latestSyncTs) || Date.now() - latestSyncTs > 24 * 60 * 60 * 1000;
  const fallback = data.dataMode === 'demo' || data.syncStatus === 'mock';
  const workspaceModeLabel = {
    Trader: t.workspaceModeTrader,
    Risk: t.workspaceModeRisk,
    Admin: t.workspaceModeAdmin,
  }[workspaceMode];

  return (
    <div data-testid="data-freshness-strip" className="border-b border-[color:var(--nfq-border-ghost)] bg-[color:rgba(8,12,18,0.82)] px-3 py-2 backdrop-blur md:px-5 xl:px-6">
      <div className="flex flex-col gap-2 text-[11px] text-[color:var(--nfq-text-secondary)] lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-mono uppercase tracking-[0.14em] ${
            stale || fallback
              ? 'bg-amber-500/10 text-amber-300'
              : 'bg-emerald-500/10 text-emerald-300'
          }`}>
            {stale || fallback ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
            {fallback ? t.freshnessFallback : stale ? t.freshnessStale : t.freshnessReady}
          </span>
          <span className="inline-flex items-center gap-1">
            <DatabaseZap size={13} />
            {t.freshnessCurves}: {curveTenorCount} / {liquidityCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <RadioTower size={13} />
            {t.freshnessSources}: {activeSourceCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock3 size={13} />
            {t.freshnessLastSync}: {ageLabel(latestSource?.lastSyncAt, t.freshnessUnavailable)}
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate">{activeEntity?.shortCode ?? activeEntity?.name ?? t.activeEntity}</span>
          <span className="text-[color:var(--nfq-text-faint)]">/</span>
          <span className="inline-flex items-center gap-1">
            <ShieldCheck size={13} />
            {t.workspaceMode}: {workspaceModeLabel}
          </span>
          <span className="text-[color:var(--nfq-text-faint)]">/</span>
          <span>{data.dataMode === 'demo' ? t.workspaceDemoBook : t.workspaceLiveBook}</span>
        </div>
      </div>
    </div>
  );
};
