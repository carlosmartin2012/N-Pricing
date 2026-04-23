import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Gauge, ShieldCheck, ShieldAlert, AlertOctagon, RefreshCw, Lock } from 'lucide-react';
import { useEntity } from '../../contexts/EntityContext';
import * as observability from '../../api/observability';
import type {
  SLOSummaryResponse,
  SLOStatus,
  TenancyViolationsResponse,
} from '../../api/observability';
import { createLogger } from '../../utils/logger';

const log = createLogger('SLOPanel');

const STATUS_COLOR: Record<SLOStatus, string> = {
  ok: '#10b981',
  warning: '#f59e0b',
  breached: '#f43f5e',
};

const STATUS_ICON: Record<SLOStatus, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  ok: ShieldCheck,
  warning: ShieldAlert,
  breached: AlertOctagon,
};

function formatValue(name: string, value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (name.endsWith('_total')) return value.toFixed(0);
  if (name === 'mock_fallback_rate') return `${(value * 100).toFixed(1)}%`;
  if (name.endsWith('_ms') || name.endsWith('_per_deal')) return `${value.toFixed(0)} ms`;
  return value.toFixed(2);
}

function formatTarget(name: string, target: number): string {
  if (name === 'mock_fallback_rate') return `< ${(target * 100).toFixed(0)}%`;
  if (name.endsWith('_ms') || name.endsWith('_per_deal')) return `< ${target} ms`;
  return `≤ ${target}`;
}

const SLOPanel: React.FC = () => {
  const { activeEntity } = useEntity();
  const [summary, setSummary] = useState<SLOSummaryResponse | null>(null);
  const [violations, setViolations] = useState<TenancyViolationsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!activeEntity) return;
    setIsLoading(true);
    try {
      const [nextSummary, nextViolations] = await Promise.all([
        observability.getSLOSummary(activeEntity.id),
        observability.getTenancyViolations(activeEntity.id, 60),
      ]);
      setSummary(nextSummary);
      setViolations(nextViolations);
    } catch (error) {
      log.warn('Failed to load SLO summary', { entity: activeEntity?.id, error: String(error) });
      setSummary(null);
      setViolations(null);
    } finally {
      setIsLoading(false);
    }
  }, [activeEntity]);

  useEffect(() => { void load(); }, [load]);

  const overallStatus: SLOStatus = useMemo(() => {
    if (!summary?.slos?.length) return 'ok';
    if (summary.slos.some((s) => s.status === 'breached')) return 'breached';
    if (summary.slos.some((s) => s.status === 'warning')) return 'warning';
    return 'ok';
  }, [summary]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Gauge className="h-5 w-5" style={{ color: STATUS_COLOR[overallStatus] }} />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
            SLO Summary
          </h3>
          <span className="nfq-label text-[10px] text-slate-400">
            window {summary?.window ?? '—'}
          </span>
        </div>
        <button
          onClick={() => void load()}
          disabled={isLoading}
          className="nfq-btn-ghost px-3 py-1.5 text-xs"
        >
          <RefreshCw className={`mr-1 inline h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {!summary && !isLoading && (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3 text-xs text-slate-400">
          SLO endpoint not available yet — apply migration <code className="font-mono">20260602000005_slo_metrics</code> and emit at least one metric.
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {summary.slos.map((slo, idx) => {
            const Icon = STATUS_ICON[slo.status];
            const color = STATUS_COLOR[slo.status];
            return (
              <article
                key={`${slo.name}-${idx}`}
                className="rounded-lg border border-white/5 bg-white/[0.02] p-4"
                style={{ boxShadow: `inset 0 0 0 1px ${color}22` }}
              >
                <header className="mb-3 flex items-center gap-2">
                  <Icon className="h-4 w-4" style={{ color }} />
                  <span className="font-mono text-[11px] uppercase tracking-wider text-slate-300">
                    {slo.name}
                  </span>
                </header>
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-2xl font-semibold tabular-nums" style={{ color }}>
                    {formatValue(slo.name, slo.current)}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    target {formatTarget(slo.name, slo.target)}
                  </span>
                </div>
                {slo.percentiles && (
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                    {(['p50', 'p95', 'p99'] as const).map((p) => (
                      <div key={p}>
                        <dt className="font-mono uppercase tracking-wider text-slate-500">{p}</dt>
                        <dd className="font-mono tabular-nums text-slate-200">
                          {formatValue(slo.name, slo.percentiles![p])}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                {slo.sampleCount !== undefined && (
                  <p className="mt-2 font-mono text-[10px] text-slate-500">
                    samples: {slo.sampleCount}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}

      {violations && (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
          <header className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock
                className="h-4 w-4"
                style={{ color: violations.total === 0 ? STATUS_COLOR.ok : STATUS_COLOR.breached }}
              />
              <h4 className="font-mono text-[11px] uppercase tracking-wider text-slate-300">
                Tenancy violations · last {violations.windowMinutes}m
              </h4>
            </div>
            <span
              className="font-mono text-2xl font-semibold tabular-nums"
              style={{ color: violations.total === 0 ? STATUS_COLOR.ok : STATUS_COLOR.breached }}
              data-testid="tenancy-violations-total"
            >
              {violations.total}
            </span>
          </header>
          {violations.total === 0 ? (
            <p className="font-mono text-[10px] text-slate-500">
              Clean window. Safe to hold TENANCY_STRICT flip observation.
            </p>
          ) : (
            <ul className="space-y-1">
              {violations.topEndpoints.map((row, idx) => (
                <li
                  key={`${row.endpoint}-${row.errorCode}-${idx}`}
                  className="flex items-center justify-between rounded border border-white/5 bg-black/20 px-3 py-1.5 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <code className="truncate font-mono text-slate-200">{row.endpoint}</code>
                    <span
                      className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-rose-300"
                      style={{ background: 'rgba(244,63,94,0.08)' }}
                    >
                      {row.errorCode}
                    </span>
                  </div>
                  <span className="font-mono tabular-nums text-slate-200">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {summary && summary.activeAlerts.length > 0 && (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
          <h4 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-slate-300">
            Active alerts
          </h4>
          <ul className="space-y-2">
            {summary.activeAlerts.map((a) => (
              <li
                key={a.ruleId}
                className="flex items-center justify-between rounded border border-white/5 bg-black/20 px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                    style={{
                      color: a.severity === 'critical' || a.severity === 'page' ? '#f43f5e' : '#f59e0b',
                      background: 'rgba(255,255,255,0.04)',
                    }}
                  >
                    {a.severity}
                  </span>
                  <span className="text-slate-200">{a.name}</span>
                  <code className="font-mono text-[10px] text-slate-500">{a.sli}</code>
                </div>
                <span className="font-mono text-[10px] text-slate-500">
                  {a.lastTriggeredAt ? new Date(a.lastTriggeredAt).toLocaleString() : 'never triggered'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default SLOPanel;
