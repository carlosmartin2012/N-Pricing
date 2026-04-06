import React, { useState, useEffect, useCallback } from 'react';
import { Activity, AlertTriangle, BarChart4, Clock, RefreshCw, Zap } from 'lucide-react';
import { useEntity } from '../../contexts/EntityContext';
import * as observability from '../../api/observability';
import type { AlertRule } from '../../types/alertRule';

const HealthDashboard: React.FC = () => {
  const { activeEntity } = useEntity();
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!activeEntity) return;
    setIsLoading(true);
    try {
      const rules = await observability.listAlertRules(activeEntity.id);
      setAlertRules(rules);
    } finally {
      setIsLoading(false);
    }
  }, [activeEntity]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Placeholder metrics (in production these come from the metrics table)
  const systemMetrics = [
    { label: 'Pricing Latency P50', value: '45ms', icon: Zap, color: '#10b981', status: 'healthy' },
    { label: 'Pricing Latency P95', value: '180ms', icon: Clock, color: '#06b6d4', status: 'healthy' },
    { label: 'Error Rate (24h)', value: '0.2%', icon: AlertTriangle, color: '#10b981', status: 'healthy' },
    { label: 'Active Deals', value: '—', icon: BarChart4, color: '#F48B4A', status: 'info' },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-cyan-400" />
          <h2 className="text-sm font-bold tracking-tight text-white uppercase font-mono">
            System Health
          </h2>
          {activeEntity && (
            <span className="nfq-label text-[10px] text-slate-400">{activeEntity.shortCode}</span>
          )}
        </div>
        <button
          onClick={() => void loadData()}
          disabled={isLoading}
          className="nfq-btn-ghost px-3 py-1.5 text-xs"
        >
          <RefreshCw className={`h-3 w-3 mr-1 inline ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
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
        <h3 className="nfq-label text-[10px] mb-3">ALERT RULES ({alertRules.length})</h3>
        {alertRules.length === 0 ? (
          <div className="rounded-lg border border-white/5 bg-white/[0.02] px-6 py-8 text-center">
            <AlertTriangle className="h-8 w-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No alert rules configured</p>
            <p className="text-xs text-slate-500 mt-1">
              Alert rules will trigger notifications when metrics cross thresholds
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="nfq-label text-[10px] text-left px-4 py-2">Name</th>
                  <th className="nfq-label text-[10px] text-left px-4 py-2">Metric</th>
                  <th className="nfq-label text-[10px] text-left px-4 py-2">Condition</th>
                  <th className="nfq-label text-[10px] text-left px-4 py-2">Active</th>
                </tr>
              </thead>
              <tbody>
                {alertRules.map((rule) => (
                  <tr key={rule.id} className="border-b border-white/5">
                    <td className="px-4 py-2 text-white">{rule.name}</td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-300">{rule.metricName}</td>
                    <td className="px-4 py-2 font-mono text-xs text-amber-400">
                      {rule.operator} {rule.threshold}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          rule.isActive ? 'bg-emerald-400' : 'bg-slate-600'
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
    </div>
  );
};

export default HealthDashboard;
