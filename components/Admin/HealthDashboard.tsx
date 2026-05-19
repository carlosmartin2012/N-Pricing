import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Activity, AlertTriangle, BarChart4, Clock, RefreshCw, Zap } from 'lucide-react';
import { useEntity } from '../../contexts/EntityContext';
import { useUI } from '../../contexts/UIContext';
import * as observability from '../../api/observability';
import type { AlertRule } from '../../types/alertRule';
import { createLogger } from '../../utils/logger';
import { useChartTokens } from '../../hooks/useChartTokens';
import SLOPanel from './SLOPanel';
import AdapterHealthPanel from './AdapterHealthPanel';

const log = createLogger('HealthDashboard');

const HealthDashboard: React.FC = () => {
  const { activeEntity } = useEntity();
  const { t } = useUI();
  const tokens = useChartTokens();
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [summary, setSummary] = useState<observability.HealthSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!activeEntity) return;
    setIsLoading(true);
    try {
      const [rules, nextSummary] = await Promise.all([
        observability.listAlertRules(activeEntity.id),
        observability.getHealthSummary(activeEntity.id),
      ]);
      setAlertRules(rules);
      setSummary(nextSummary);
    } catch (error) {
      log.warn('Failed to load health dashboard data', { entity: activeEntity?.id, error: String(error) });
      setAlertRules([]);
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, [activeEntity]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const systemMetrics = useMemo(() => [
    {
      label: t.pricingLatencyP50,
      value: summary?.pricingLatencyP50Ms != null ? `${summary.pricingLatencyP50Ms.toFixed(0)}ms` : '—',
      icon: Zap,
      color:
        summary?.pricingLatencyP50Ms == null
          ? tokens.axis
          : summary.pricingLatencyP50Ms <= 75
            ? tokens.success
            : tokens.warning,
    },
    {
      label: t.pricingLatencyP95,
      value: summary?.pricingLatencyP95Ms != null ? `${summary.pricingLatencyP95Ms.toFixed(0)}ms` : '—',
      icon: Clock,
      color:
        summary?.pricingLatencyP95Ms == null
          ? tokens.axis
          : summary.pricingLatencyP95Ms <= 250
            ? tokens.accent
            : tokens.warning,
    },
    {
      label: t.errorEvents24h,
      value: String(summary?.errorEvents24h ?? 0),
      icon: AlertTriangle,
      color: (summary?.errorEvents24h ?? 0) === 0 ? tokens.success : tokens.warning,
    },
    {
      label: t.activeDeals,
      value: String(summary?.dealCount ?? 0),
      icon: BarChart4,
      color: tokens.catB, // amber category — NFQ amber-ish, replaces hardcoded #F48B4A
    },
  ], [summary, t.activeDeals, t.errorEvents24h, t.pricingLatencyP50, t.pricingLatencyP95, tokens]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-[color:var(--nfq-accent)]" />
          <h2 className="text-sm font-bold tracking-tight text-[color:var(--nfq-text-primary)] uppercase font-mono">
            {t.systemHealth}
          </h2>
          {activeEntity && (
            <span className="nfq-label text-[10px] text-[color:var(--nfq-text-muted)]">{activeEntity.shortCode}</span>
          )}
        </div>
        <button
          onClick={() => void loadData()}
          disabled={isLoading}
          className="nfq-button nfq-button-ghost px-3 py-1.5 text-xs"
        >
          <RefreshCw className={`h-3 w-3 mr-1 inline ${isLoading ? 'animate-spin' : ''}`} />
          {t.refresh}
        </button>
      </div>

      <div className="rounded-lg border border-[color:var(--nfq-border-ghost)] bg-white/[0.02] px-4 py-3 text-xs text-[color:var(--nfq-text-muted)]">
        {summary?.latencySampleCount24h
          ? `${t.healthMetricsWindow} ${summary.latencySampleCount24h} ${t.healthLatencySamples}.`
          : t.noHealthMetrics}
      </div>

      {/* System Metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {systemMetrics.map((m) => (
          <div key={m.label} className="nfq-kpi-card group relative overflow-hidden">
            <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <m.icon size={40} style={{ color: m.color }} />
            </div>
            <div className="nfq-kpi-label mb-2">{m.label}</div>
            <div className="nfq-kpi-value" style={{ color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Alert Rules */}
      <div>
        <h3 className="nfq-label text-[10px] mb-3">
          {t.alertRules.toUpperCase()} ({alertRules.length})
          {summary ? ` · ${summary.activeAlertRules} ${t.active.toLowerCase()}` : ''}
        </h3>
        {alertRules.length === 0 ? (
          <div className="rounded-lg border border-[color:var(--nfq-border-ghost)] bg-white/[0.02] px-6 py-8 text-center">
            <AlertTriangle className="h-8 w-8 text-[color:var(--nfq-text-faint)] mx-auto mb-2" />
            <p className="text-sm text-[color:var(--nfq-text-muted)]">{t.noAlertRules}</p>
            <p className="text-xs text-[color:var(--nfq-text-faint)] mt-1">
              {t.alertRulesHint}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-[color:var(--nfq-border-ghost)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[color:var(--nfq-border-ghost)] bg-white/[0.02]">
                  <th className="nfq-label text-[10px] text-left px-4 py-2">{t.name}</th>
                  <th className="nfq-label text-[10px] text-left px-4 py-2">{t.metric}</th>
                  <th className="nfq-label text-[10px] text-left px-4 py-2">{t.condition}</th>
                  <th className="nfq-label text-[10px] text-left px-4 py-2">{t.active}</th>
                </tr>
              </thead>
              <tbody>
                {alertRules.map((rule) => (
                  <tr key={rule.id} className="border-b border-[color:var(--nfq-border-ghost)]">
                    <td className="px-4 py-2 text-[color:var(--nfq-text-primary)]">{rule.name}</td>
                    <td className="px-4 py-2 font-mono text-xs text-[color:var(--nfq-text-secondary)]">{rule.metricName}</td>
                    <td className="px-4 py-2 font-mono text-xs text-[color:var(--nfq-warning)]">
                      {rule.operator} {rule.threshold}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          rule.isActive ? 'bg-emerald-400' : 'bg-[var(--nfq-bg-bright)]'
                        }`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Phase 0 — SLO Summary */}
      <SLOPanel />

      {/* Phase 4 follow-up — Integration adapters */}
      <AdapterHealthPanel />
    </div>
  );
};

export default HealthDashboard;
