import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldAlert, RefreshCw, CheckCircle2, Settings2, Clock, ArrowUpRight } from 'lucide-react';
import * as escalationsApi from '../../api/escalations';
import type {
  ApprovalEscalation,
  ApprovalEscalationConfig,
  EscalationLevel,
  EscalationStatus,
} from '../../types/governance';
import { createLogger } from '../../utils/logger';

const log = createLogger('EscalationsView');

const LEVEL_COLOR: Record<EscalationLevel, string> = {
  L1: 'bg-cyan-500/10 text-cyan-300',
  L2: 'bg-amber-500/10 text-amber-300',
  Committee: 'bg-rose-500/10 text-rose-300',
};

const STATUS_COLOR: Record<EscalationStatus, string> = {
  open: 'bg-emerald-500/10 text-emerald-300',
  resolved: 'bg-slate-500/10 text-slate-300',
  escalated: 'bg-amber-500/10 text-amber-300',
  expired: 'bg-rose-500/10 text-rose-300',
};

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-ES', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function relativeTo(iso: string, now: Date = new Date()): string {
  const ms = new Date(iso).getTime() - now.getTime();
  const abs = Math.abs(ms);
  const hours = Math.floor(abs / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  const sign = ms < 0 ? '−' : '+';
  if (hours > 24) return `${sign}${Math.floor(hours / 24)}d ${hours % 24}h`;
  return `${sign}${hours}h ${minutes}m`;
}

const EscalationsView: React.FC = () => {
  const [list, setList] = useState<ApprovalEscalation[]>([]);
  const [configs, setConfigs] = useState<Partial<Record<EscalationLevel, ApprovalEscalationConfig>>>({});
  const [loading, setLoading] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [statusFilter, setStatusFilter] = useState<EscalationStatus | 'all'>('open');
  const [error, setError] = useState<string | null>(null);
  const [showConfigs, setShowConfigs] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [items, cfgs] = await Promise.all([
        escalationsApi.listEscalations(statusFilter === 'all' ? undefined : statusFilter),
        escalationsApi.listConfigs(),
      ]);
      setList(items);
      setConfigs(cfgs);
    } catch (e) {
      log.warn('load failed', { err: String(e) });
      setError(e instanceof Error ? e.message : String(e));
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const handleSweep = async () => {
    setSweeping(true);
    setError(null);
    try {
      const { summary } = await escalationsApi.runSweep();
      log.info('sweep done', { ...summary });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSweeping(false);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await escalationsApi.resolveEscalation(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const counts = useMemo(() => {
    const c = { open: 0, overdue: 0, escalated: 0, resolved: 0, expired: 0 };
    const now = Date.now();
    for (const e of list) {
      if (e.status === 'open') {
        c.open += 1;
        if (new Date(e.dueAt).getTime() < now) c.overdue += 1;
      } else if (e.status === 'escalated') c.escalated += 1;
      else if (e.status === 'resolved') c.resolved += 1;
      else if (e.status === 'expired') c.expired += 1;
    }
    return c;
  }, [list]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-[color:var(--nfq-text-primary)]">
            <ShieldAlert size={22} className="text-[color:var(--nfq-accent)]" />
            Approval Escalations
          </h1>
          <p className="mt-1 text-sm text-[color:var(--nfq-text-secondary)]">
            L1 → L2 → Committee · timeouts configurables por entidad · sweeper idempotente
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfigs((s) => !s)}
            className="flex items-center gap-1.5 rounded-lg border border-[color:var(--nfq-border-subtle)] bg-transparent px-3 py-2 text-sm text-[color:var(--nfq-text-secondary)] transition hover:bg-[rgba(255,255,255,0.03)]"
          >
            <Settings2 size={14} /> Configs
          </button>
          <button
            onClick={handleSweep}
            disabled={sweeping}
            className="flex items-center gap-1.5 rounded-lg bg-[color:var(--nfq-accent)] px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            <RefreshCw size={14} className={sweeping ? 'animate-spin' : ''} />
            {sweeping ? 'Sweeping…' : 'Run sweep'}
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {([
          ['Open',      counts.open,      'text-emerald-300'],
          ['Overdue',   counts.overdue,   'text-rose-300'],
          ['Escalated', counts.escalated, 'text-amber-300'],
          ['Resolved',  counts.resolved,  'text-slate-300'],
          ['Expired',   counts.expired,   'text-rose-400'],
        ] as const).map(([label, value, color]) => (
          <div
            key={label}
            className="rounded-xl border border-[color:var(--nfq-border-subtle)] bg-[color:var(--nfq-bg-surface)] p-4"
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--nfq-text-muted)]">
              {label}
            </div>
            <div className={`mt-1 font-mono text-2xl font-semibold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Configs panel */}
      {showConfigs && (
        <section className="rounded-xl border border-[color:var(--nfq-border-subtle)] bg-[color:var(--nfq-bg-surface)] p-4">
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--nfq-text-muted)]">
            Timeout configuration · per level
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {(['L1', 'L2', 'Committee'] as EscalationLevel[]).map((lvl) => {
              const cfg = configs[lvl];
              return (
                <div key={lvl} className="rounded-lg border border-[color:var(--nfq-border-subtle)] p-3">
                  <div className={`mb-2 inline-flex rounded px-2 py-0.5 text-xs font-medium ${LEVEL_COLOR[lvl]}`}>{lvl}</div>
                  {cfg ? (
                    <dl className="space-y-1 font-mono text-xs text-[color:var(--nfq-text-secondary)]">
                      <div className="flex justify-between"><dt>Timeout</dt><dd>{cfg.timeoutHours}h</dd></div>
                      <div className="flex justify-between"><dt>Notify before</dt><dd>{cfg.notifyBeforeHours}h</dd></div>
                      <div className="flex justify-between"><dt>Channel</dt><dd>{cfg.channelType}</dd></div>
                      <div className="flex justify-between"><dt>Active</dt><dd>{cfg.isActive ? 'yes' : 'no'}</dd></div>
                    </dl>
                  ) : (
                    <p className="font-mono text-xs text-[color:var(--nfq-text-muted)]">no config · fallback 24h</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Filter + table */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--nfq-text-muted)]">
            Filter
          </span>
          {(['all', 'open', 'escalated', 'resolved', 'expired'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-2 py-1 text-xs ${
                statusFilter === s
                  ? 'bg-[color:var(--nfq-accent)] text-black'
                  : 'text-[color:var(--nfq-text-secondary)] hover:bg-[rgba(255,255,255,0.04)]'
              }`}
            >
              {s}
            </button>
          ))}
          <button
            onClick={() => void load()}
            className="ml-auto flex items-center gap-1 text-xs text-[color:var(--nfq-text-muted)] hover:text-[color:var(--nfq-text-secondary)]"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> reload
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[color:var(--nfq-border-subtle)]">
          <table className="min-w-full text-sm">
            <thead className="bg-[rgba(255,255,255,0.02)]">
              <tr className="text-left font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--nfq-text-muted)]">
                <th className="px-3 py-2">Level</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Deal</th>
                <th className="px-3 py-2 text-right">Due</th>
                <th className="px-3 py-2 text-right">Δ now</th>
                <th className="px-3 py-2">Opened by</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-[color:var(--nfq-text-muted)]">
                    No escalations match the current filter.
                  </td>
                </tr>
              )}
              {list.map((e) => {
                const overdue = e.status === 'open' && new Date(e.dueAt).getTime() < Date.now();
                return (
                  <tr key={e.id} className="border-t border-[color:var(--nfq-border-subtle)]">
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${LEVEL_COLOR[e.level]}`}>
                        {e.level}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[e.status]}`}>
                        {e.status}
                      </span>
                      {overdue && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded bg-rose-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-rose-300">
                          <Clock size={10} /> overdue
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-[color:var(--nfq-text-secondary)]">
                      {e.dealId ? e.dealId.slice(0, 8) : e.exceptionId?.slice(0, 8) ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{fmtDateTime(e.dueAt)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{relativeTo(e.dueAt)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-[color:var(--nfq-text-secondary)]">
                      {e.openedBy ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {e.status === 'open' && (
                        <button
                          onClick={() => void handleResolve(e.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-[color:var(--nfq-border-subtle)] px-2 py-1 text-xs text-[color:var(--nfq-text-secondary)] hover:bg-[rgba(255,255,255,0.04)]"
                          title="Mark resolved"
                        >
                          <CheckCircle2 size={12} /> resolve
                        </button>
                      )}
                      {e.escalatedFromId && (
                        <span className="ml-2 inline-flex items-center gap-1 font-mono text-[10px] text-[color:var(--nfq-text-muted)]">
                          <ArrowUpRight size={10} /> chained
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default EscalationsView;
