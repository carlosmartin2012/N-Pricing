import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { History, PlayCircle, RefreshCw, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import type { SnapshotSummary, SnapshotReplayResult } from '../../api/snapshots';
import { listSnapshots, replaySnapshot } from '../../api/snapshots';
import { createLogger } from '../../utils/logger';

const log = createLogger('SnapshotReplayView');

type ReplayState = 'idle' | 'running' | 'ok' | 'mismatch' | 'error';

const fmtDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    return iso;
  }
};

const shortHash = (h: string): string => (h && h.length >= 10 ? `${h.slice(0, 8)}\u2026` : h || '—');

const SnapshotReplayView: React.FC = () => {
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [replay, setReplay] = useState<SnapshotReplayResult | null>(null);
  const [replayState, setReplayState] = useState<ReplayState>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listSnapshots({ limit: 100 });
      setSnapshots(rows);
    } catch (err) {
      log.warn('Failed to list snapshots', { error: String(err) });
      setError(err instanceof Error ? err.message : 'Failed to load snapshots');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selectedSnapshot = useMemo(
    () => snapshots.find((s) => s.id === selected) ?? null,
    [snapshots, selected],
  );

  const handleReplay = useCallback(async (id: string) => {
    setSelected(id);
    setReplay(null);
    setReplayState('running');
    setError(null);
    try {
      const result = await replaySnapshot(id);
      setReplay(result);
      setReplayState(result.matches ? 'ok' : 'mismatch');
    } catch (err) {
      log.error('Replay failed', { id, error: String(err) });
      setReplayState('error');
      setError(err instanceof Error ? err.message : 'Replay failed');
    }
  }, []);

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="h-5 w-5 text-[color:var(--nfq-accent)]" />
          <div>
            <h1 className="text-xl font-semibold text-[color:var(--nfq-text-primary)]">Snapshot Replay</h1>
            <p className="text-xs text-[color:var(--nfq-text-muted)]">
              Re-ejecuta una ejecución grabada del motor y compara outputs field-level contra el snapshot inmutable.
            </p>
          </div>
        </div>
        <button onClick={() => void load()} disabled={loading} className="nfq-button flex items-center gap-2 px-3 py-2 text-xs">
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 lg:grid-cols-[1fr_1.2fr]">
        {/* List */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-[18px] bg-[var(--nfq-bg-surface)]">
          <div className="border-b border-[var(--nfq-border-ghost)] px-4 py-3">
            <div className="nfq-label">Snapshots (latest {snapshots.length})</div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {snapshots.length === 0 && !loading && (
              <div className="p-6 text-center text-xs text-[color:var(--nfq-text-muted)]">
                No snapshots recorded yet. Run a pricing calculation to generate one.
              </div>
            )}
            <ul className="divide-y divide-[var(--nfq-border-ghost)]">
              {snapshots.map((s) => {
                const isSelected = s.id === selected;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => void handleReplay(s.id)}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
                        isSelected ? 'bg-[var(--nfq-bg-elevated)]' : 'hover:bg-[var(--nfq-bg-elevated)]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 font-mono text-xs text-[color:var(--nfq-text-primary)]">
                          <span className="truncate">{s.dealId || '—'}</span>
                          <span className="rounded bg-[var(--nfq-bg-elevated)] px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--nfq-accent)]">
                            {s.engineVersion}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-[color:var(--nfq-text-muted)]">
                          <Clock className="h-3 w-3" />
                          <span>{fmtDate(s.createdAt)}</span>
                          <span>·</span>
                          <span>as-of {s.asOfDate}</span>
                        </div>
                      </div>
                      <PlayCircle className="h-4 w-4 shrink-0 text-[color:var(--nfq-accent)]" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Detail / Replay result */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-[18px] bg-[var(--nfq-bg-surface)]">
          <div className="border-b border-[var(--nfq-border-ghost)] px-4 py-3">
            <div className="nfq-label">Replay result</div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {replayState === 'idle' && (
              <div className="flex h-full items-center justify-center text-center text-xs text-[color:var(--nfq-text-muted)]">
                Selecciona un snapshot para re-ejecutar el motor y ver el diff.
              </div>
            )}
            {replayState === 'running' && (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-[color:var(--nfq-text-muted)]">
                <RefreshCw className="h-5 w-5 animate-spin text-[color:var(--nfq-accent)]" />
                Ejecutando motor con snapshot {shortHash(selected ?? '')}…
              </div>
            )}
            {replayState === 'error' && (
              <div className="rounded-lg bg-[var(--nfq-danger-subtle)] p-4 text-xs text-[color:var(--nfq-danger)]">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  Replay failed
                </div>
                <div className="mt-2 font-mono">{error}</div>
              </div>
            )}
            {(replayState === 'ok' || replayState === 'mismatch') && replay && selectedSnapshot && (
              <div className="space-y-4">
                <div
                  className={`flex items-start gap-3 rounded-lg p-3 ${
                    replay.matches
                      ? 'bg-[color:rgba(16,185,129,0.08)]'
                      : 'bg-[color:rgba(245,158,11,0.08)]'
                  }`}
                >
                  {replay.matches
                    ? <CheckCircle2 className="h-5 w-5 text-[color:var(--nfq-success)]" />
                    : <AlertTriangle className="h-5 w-5 text-[color:var(--nfq-warning)]" />}
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-[color:var(--nfq-text-primary)]">
                      {replay.matches ? 'Output byte-identical' : `${replay.diff.length} field${replay.diff.length === 1 ? '' : 's'} drifted`}
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-[color:var(--nfq-text-muted)]">
                      Engine original: <span className="text-[color:var(--nfq-accent)]">{replay.engineVersionOriginal}</span>
                      {' → '}
                      Engine actual: <span className="text-[color:var(--nfq-accent)]">{replay.engineVersionNow}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div className="rounded-lg bg-[var(--nfq-bg-elevated)] p-3">
                    <div className="nfq-label">Original hash</div>
                    <div className="mt-1 font-mono text-[color:var(--nfq-text-secondary)]">{shortHash(replay.originalOutputHash)}</div>
                  </div>
                  <div className="rounded-lg bg-[var(--nfq-bg-elevated)] p-3">
                    <div className="nfq-label">Current hash</div>
                    <div className="mt-1 font-mono text-[color:var(--nfq-text-secondary)]">{shortHash(replay.currentOutputHash)}</div>
                  </div>
                </div>

                {replay.diff.length > 0 && (
                  <div className="overflow-hidden rounded-lg border border-[var(--nfq-border-ghost)]">
                    <table className="w-full font-mono text-[11px]">
                      <thead className="bg-[var(--nfq-bg-elevated)]">
                        <tr>
                          <th className="nfq-label px-3 py-2 text-left">Field</th>
                          <th className="nfq-label px-3 py-2 text-right">Before</th>
                          <th className="nfq-label px-3 py-2 text-right">After</th>
                          <th className="nfq-label px-3 py-2 text-right">\u0394</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--nfq-border-ghost)]">
                        {replay.diff.map((d, idx) => {
                          const delta = d.deltaBps != null ? `${d.deltaBps.toFixed(1)} bps` : d.deltaAbs != null ? d.deltaAbs.toFixed(4) : '—';
                          const warn = (d.deltaBps ?? 0) !== 0 || (d.deltaAbs ?? 0) !== 0;
                          return (
                            <tr key={`${d.field}-${idx}`}>
                              <td className="px-3 py-2 text-[color:var(--nfq-text-secondary)]">{d.field}</td>
                              <td className="px-3 py-2 text-right text-[color:var(--nfq-text-muted)]">{String(d.before ?? '—')}</td>
                              <td className="px-3 py-2 text-right text-[color:var(--nfq-text-primary)]">{String(d.after ?? '—')}</td>
                              <td className={`px-3 py-2 text-right ${warn ? 'text-[color:var(--nfq-warning)]' : 'text-[color:var(--nfq-text-muted)]'}`}>{delta}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default SnapshotReplayView;
