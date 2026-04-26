import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plug,
  PlugZap,
  PlugZap2,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Building2,
  Users,
  TrendingUp,
} from 'lucide-react';
import * as observability from '../../api/observability';
import type { AdapterHealthEntry, AdapterHealthResponse, AdapterKind } from '../../api/observability';
import { createLogger } from '../../utils/logger';

const log = createLogger('AdapterHealthPanel');

const KIND_LABEL: Record<AdapterKind, string> = {
  core_banking: 'Core Banking',
  crm: 'CRM',
  market_data: 'Market Data',
};

const KIND_ICON: Record<AdapterKind, React.ComponentType<{ className?: string }>> = {
  core_banking: Building2,
  crm: Users,
  market_data: TrendingUp,
};

function overallStatus(adapters: AdapterHealthEntry[]): 'ok' | 'degraded' | 'empty' {
  if (adapters.length === 0) return 'empty';
  return adapters.every((a) => a.ok) ? 'ok' : 'degraded';
}

function formatLatency(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1) return '<1 ms';
  return `${ms.toFixed(0)} ms`;
}

function formatCheckedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Relative for the last minute, absolute otherwise.
  const ageMs = Date.now() - d.getTime();
  if (ageMs < 60_000) return `${Math.max(1, Math.round(ageMs / 1000))}s ago`;
  return d.toISOString().slice(11, 19);
}

export const AdapterHealthPanel: React.FC = () => {
  const [data, setData] = useState<AdapterHealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await observability.getAdapterHealth();
      setData(next);
    } catch (error) {
      log.warn('Failed to load adapter health', { error: String(error) });
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const status = useMemo(() => overallStatus(data?.adapters ?? []), [data]);
  const adapters = data?.adapters ?? [];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {status === 'ok' ? (
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
          ) : status === 'degraded' ? (
            <ShieldAlert className="h-5 w-5 text-rose-400" />
          ) : (
            <Plug className="h-5 w-5 text-slate-500" />
          )}
          <h3 className="font-mono text-xs font-medium text-white">
            Integration Adapters
          </h3>
          {data?.generatedAt && (
            <span className="nfq-label text-[10px] text-slate-400">
              {formatCheckedAt(data.generatedAt)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={isLoading}
          className="nfq-btn-ghost px-3 py-1.5 text-xs"
        >
          <RefreshCw className={`h-3 w-3 mr-1 inline ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {adapters.length === 0 ? (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] px-6 py-8 text-center">
          <Plug className="h-8 w-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400">
            {data === null
              ? 'Adapter registry is unavailable.'
              : 'No adapters registered for this deployment.'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Configure <code className="font-mono">ADAPTER_CRM</code> and{' '}
            <code className="font-mono">ADAPTER_MARKET_DATA</code> to wire real integrations.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="nfq-label text-[10px] text-left px-4 py-2">Kind</th>
                <th className="nfq-label text-[10px] text-left px-4 py-2">Name</th>
                <th className="nfq-label text-[10px] text-left px-4 py-2">Status</th>
                <th className="nfq-label text-[10px] text-right px-4 py-2">Latency</th>
                <th className="nfq-label text-[10px] text-left px-4 py-2">Checked</th>
                <th className="nfq-label text-[10px] text-left px-4 py-2">Message</th>
              </tr>
            </thead>
            <tbody>
              {adapters.map((a) => {
                const Icon = KIND_ICON[a.kind];
                const FlagIcon = a.ok ? PlugZap : PlugZap2;
                return (
                  <tr key={`${a.kind}:${a.name}`} className="border-b border-white/5">
                    <td className="px-4 py-2 text-slate-300">
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-slate-500" />
                        <span className="font-mono text-xs">{KIND_LABEL[a.kind]}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-white">{a.name}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <FlagIcon className={`h-3.5 w-3.5 ${a.ok ? 'text-emerald-400' : 'text-rose-400'}`} />
                        <span className={`font-mono text-xs ${a.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {a.ok ? 'Online' : 'Down'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-slate-300 tabular-nums">
                      {formatLatency(a.latencyMs)}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-400">
                      {formatCheckedAt(a.checkedAt)}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-400 max-w-md truncate" title={a.message ?? ''}>
                      {a.message ?? ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default AdapterHealthPanel;
