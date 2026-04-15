import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  RefreshCw,
  Plus,
  FileCheck2,
  Archive,
  XCircle,
  CircleDashed,
  ExternalLink,
  Inbox,
  Globe,
} from 'lucide-react';
import * as governanceApi from '../../api/governance';
import type {
  ModelInventoryEntry,
  ModelKind,
  ModelStatus,
} from '../../types/governance';
import { createLogger } from '../../utils/logger';
import { useWalkthroughOptional } from '../../contexts/WalkthroughContext';

const log = createLogger('ModelInventoryView');

/**
 * Model Inventory (SR 11-7 / EBA MRM) — Phase 3 surface that was
 * shipped backend-only. This view closes the loop so a Risk / MRM
 * officer can browse the catalogue, open the validation document, and
 * flip lifecycle status (candidate → active → retired → rejected)
 * without dropping to psql.
 */

const KIND_LABEL: Record<ModelKind, string> = {
  engine:      'Pricing engine',
  ruleset:     'Rule set',
  elasticity:  'Elasticity',
  shock_pack:  'Shock pack',
  behavioural: 'Behavioural',
  rate_card:   'Rate card',
  other:       'Other',
};

const KIND_COLOR: Record<ModelKind, string> = {
  engine:      'bg-cyan-500/10 text-cyan-300',
  ruleset:     'bg-emerald-500/10 text-emerald-300',
  elasticity:  'bg-violet-500/10 text-violet-300',
  shock_pack:  'bg-amber-500/10 text-amber-300',
  behavioural: 'bg-sky-500/10 text-sky-300',
  rate_card:   'bg-slate-500/10 text-slate-300',
  other:       'bg-slate-500/10 text-slate-400',
};

const STATUS_COLOR: Record<ModelStatus, string> = {
  candidate: 'bg-slate-500/10 text-slate-300',
  active:    'bg-emerald-500/10 text-emerald-300',
  retired:   'bg-amber-500/10 text-amber-300',
  rejected:  'bg-rose-500/10 text-rose-300',
};

const STATUS_ICON: Record<ModelStatus, React.ComponentType<{ size?: number }>> = {
  candidate: CircleDashed,
  active:    FileCheck2,
  retired:   Archive,
  rejected:  XCircle,
};

/**
 * Allowed transitions. Mirrors standard MRM lifecycle: a candidate can be
 * promoted to active or rejected outright; an active model can be retired
 * (superseded by a newer version); retired/rejected are terminal.
 */
const NEXT_STATUSES: Record<ModelStatus, ModelStatus[]> = {
  candidate: ['active', 'rejected'],
  active:    ['retired'],
  retired:   [],
  rejected:  [],
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-ES', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
  } catch { return iso; }
}

interface NewModelForm {
  kind: ModelKind;
  name: string;
  version: string;
  entityScope: 'entity' | 'global';
  ownerEmail: string;
  validationDocUrl: string;
  notes: string;
}

const EMPTY_FORM: NewModelForm = {
  kind: 'ruleset',
  name: '',
  version: '1.0.0',
  entityScope: 'entity',
  ownerEmail: '',
  validationDocUrl: '',
  notes: '',
};

const ModelInventoryView: React.FC = () => {
  const [list, setList] = useState<ModelInventoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<ModelKind | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ModelStatus | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewModelForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const walkthrough = useWalkthroughOptional();
  const isTourActive = walkthrough?.isActive ?? false;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: governanceApi.ListModelsParams = {};
      if (kindFilter !== 'all')   params.kind = kindFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      setList(await governanceApi.listModels(params));
    } catch (e) {
      log.warn('load failed', { err: String(e) });
      setError(e instanceof Error ? e.message : String(e));
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [kindFilter, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await governanceApi.createModel({
        kind: form.kind,
        name: form.name.trim(),
        version: form.version.trim(),
        entityScope: form.entityScope,
        ownerEmail: form.ownerEmail.trim() || undefined,
        validationDocUrl: form.validationDocUrl.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransition = async (id: string, status: ModelStatus) => {
    try {
      await governanceApi.updateModelStatus(id, status);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const counts = useMemo(() => {
    const c = { candidate: 0, active: 0, retired: 0, rejected: 0, global: 0 };
    for (const m of list) {
      c[m.status] += 1;
      if (m.entityId === null) c.global += 1;
    }
    return c;
  }, [list]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-[color:var(--nfq-text-primary)]">
            <BookOpenCheck size={22} className="text-[color:var(--nfq-accent)]" />
            Model Inventory
          </h1>
          <p className="mt-1 text-sm text-[color:var(--nfq-text-secondary)]">
            SR 11-7 / EBA MRM catalogue · engine, rulesets, elasticity, shocks, behavioural models · lifecycle {`candidate → active → retired`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-1.5 rounded-lg bg-[color:var(--nfq-accent)] px-3 py-2 text-sm font-medium text-black"
          >
            <Plus size={14} /> New model
          </button>
        </div>
      </header>

      {error && !isTourActive && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {([
          ['Candidate', counts.candidate, 'text-slate-300'],
          ['Active',    counts.active,    'text-emerald-300'],
          ['Retired',   counts.retired,   'text-amber-300'],
          ['Rejected',  counts.rejected,  'text-rose-300'],
          ['Global',    counts.global,    'text-cyan-300'],
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

      {/* New model form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="grid gap-3 rounded-xl border border-[color:var(--nfq-border-subtle)] bg-[color:var(--nfq-bg-surface)] p-4 sm:grid-cols-3"
        >
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-mono uppercase tracking-[0.12em] text-[color:var(--nfq-text-muted)]">Kind</span>
            <select
              value={form.kind}
              onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as ModelKind }))}
              className="rounded-md border border-[color:var(--nfq-border-subtle)] bg-[color:var(--nfq-bg-elevated)] px-2 py-1.5 text-sm"
            >
              {(Object.keys(KIND_LABEL) as ModelKind[]).map((k) => (
                <option key={k} value={k}>{KIND_LABEL[k]}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-mono uppercase tracking-[0.12em] text-[color:var(--nfq-text-muted)]">Name</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. IRRBB EBA 2018/02"
              className="rounded-md border border-[color:var(--nfq-border-subtle)] bg-[color:var(--nfq-bg-elevated)] px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-mono uppercase tracking-[0.12em] text-[color:var(--nfq-text-muted)]">Version</span>
            <input
              required
              value={form.version}
              onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
              placeholder="1.0.0"
              className="rounded-md border border-[color:var(--nfq-border-subtle)] bg-[color:var(--nfq-bg-elevated)] px-2 py-1.5 text-sm font-mono"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-mono uppercase tracking-[0.12em] text-[color:var(--nfq-text-muted)]">Scope</span>
            <select
              value={form.entityScope}
              onChange={(e) => setForm((f) => ({ ...f, entityScope: e.target.value as 'entity' | 'global' }))}
              className="rounded-md border border-[color:var(--nfq-border-subtle)] bg-[color:var(--nfq-bg-elevated)] px-2 py-1.5 text-sm"
            >
              <option value="entity">This entity</option>
              <option value="global">Global (engine-wide)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-mono uppercase tracking-[0.12em] text-[color:var(--nfq-text-muted)]">Owner email</span>
            <input
              type="email"
              value={form.ownerEmail}
              onChange={(e) => setForm((f) => ({ ...f, ownerEmail: e.target.value }))}
              placeholder="mrm@bank.es"
              className="rounded-md border border-[color:var(--nfq-border-subtle)] bg-[color:var(--nfq-bg-elevated)] px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-mono uppercase tracking-[0.12em] text-[color:var(--nfq-text-muted)]">Validation doc URL</span>
            <input
              type="url"
              value={form.validationDocUrl}
              onChange={(e) => setForm((f) => ({ ...f, validationDocUrl: e.target.value }))}
              placeholder="https://…"
              className="rounded-md border border-[color:var(--nfq-border-subtle)] bg-[color:var(--nfq-bg-elevated)] px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs sm:col-span-3">
            <span className="font-mono uppercase tracking-[0.12em] text-[color:var(--nfq-text-muted)]">Notes</span>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="rounded-md border border-[color:var(--nfq-border-subtle)] bg-[color:var(--nfq-bg-elevated)] px-2 py-1.5 text-sm"
            />
          </label>
          <div className="sm:col-span-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
              className="rounded-md border border-[color:var(--nfq-border-subtle)] px-3 py-1.5 text-xs text-[color:var(--nfq-text-secondary)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-[color:var(--nfq-accent)] px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Register model'}
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--nfq-text-muted)]">Kind</span>
        {(['all', ...Object.keys(KIND_LABEL)] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKindFilter(k as ModelKind | 'all')}
            className={`rounded-md px-2 py-1 text-xs ${
              kindFilter === k
                ? 'bg-[color:var(--nfq-accent)] text-black'
                : 'text-[color:var(--nfq-text-secondary)] hover:bg-[rgba(255,255,255,0.04)]'
            }`}
          >
            {k === 'all' ? 'all' : KIND_LABEL[k as ModelKind]}
          </button>
        ))}
        <span className="ml-4 font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--nfq-text-muted)]">Status</span>
        {(['all', 'candidate', 'active', 'retired', 'rejected'] as const).map((s) => (
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

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[color:var(--nfq-border-subtle)]">
        <table className="min-w-full text-sm">
          <thead className="bg-[rgba(255,255,255,0.02)]">
            <tr className="text-left font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--nfq-text-muted)]">
              <th className="px-3 py-2">Kind</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Version</th>
              <th className="px-3 py-2">Scope</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Validated</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="px-3 py-12">
                  <div className="mx-auto flex max-w-md flex-col items-center text-center">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(var(--nfq-accent-rgb),0.1)] text-[color:var(--nfq-accent)]">
                      <Inbox size={24} />
                    </div>
                    <h3 className="text-sm font-semibold text-[color:var(--nfq-text-primary)]">
                      No models match the current filter
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-[color:var(--nfq-text-secondary)]">
                      Register the bank's pricing engine, rulesets, shock packs and behavioural
                      models here. Each entry carries an owner, a validation document link and a
                      lifecycle status that the auditor can sample-check.
                    </p>
                    <button
                      onClick={() => setShowForm(true)}
                      className="mt-4 rounded-md bg-[color:var(--nfq-accent)] px-3 py-1.5 text-xs font-semibold text-black"
                    >
                      Register first model
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {list.map((m) => {
              const StatusIcon = STATUS_ICON[m.status];
              const transitions = NEXT_STATUSES[m.status];
              return (
                <tr key={m.id} className="border-t border-[color:var(--nfq-border-subtle)]">
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${KIND_COLOR[m.kind]}`}>
                      {KIND_LABEL[m.kind]}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium text-[color:var(--nfq-text-primary)]">{m.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-[color:var(--nfq-text-secondary)]">{m.version}</td>
                  <td className="px-3 py-2">
                    {m.entityId === null ? (
                      <span className="inline-flex items-center gap-1 rounded bg-cyan-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-cyan-300">
                        <Globe size={10} /> global
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] text-[color:var(--nfq-text-muted)]">entity</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[m.status]}`}>
                      <StatusIcon size={11} /> {m.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-[color:var(--nfq-text-secondary)]">
                    {m.ownerEmail ?? '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-[color:var(--nfq-text-secondary)]">
                    {fmtDate(m.validatedAt)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {m.validationDocUrl && (
                        <a
                          href={m.validationDocUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Validation document"
                          className="inline-flex items-center gap-1 rounded-md border border-[color:var(--nfq-border-subtle)] px-2 py-1 text-[10px] text-[color:var(--nfq-text-secondary)] hover:bg-[rgba(255,255,255,0.04)]"
                        >
                          <ExternalLink size={10} /> doc
                        </a>
                      )}
                      {transitions.map((next) => (
                        <button
                          key={next}
                          onClick={() => void handleTransition(m.id, next)}
                          className="rounded-md border border-[color:var(--nfq-border-subtle)] px-2 py-1 text-[10px] text-[color:var(--nfq-text-secondary)] hover:bg-[rgba(255,255,255,0.04)]"
                          title={`Transition to ${next}`}
                        >
                          → {next}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ModelInventoryView;
