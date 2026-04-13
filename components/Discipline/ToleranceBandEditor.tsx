import React, { useState, useCallback } from 'react';
import { Plus, Edit, Trash2, X, Check, Shield } from 'lucide-react';
import {
  useToleranceBandsQuery,
  useUpsertToleranceBand,
  useDeleteToleranceBand,
} from '../../hooks/queries/useDisciplineQueries';
import { useEntity } from '../../contexts/EntityContext';
import type { ToleranceBand } from '../../types';
import { TENOR_BUCKETS } from '../../types';

type FormBand = Omit<ToleranceBand, 'id' | 'createdAt'> & { id?: string };

const EMPTY_BAND: FormBand = {
  product: '',
  segment: '',
  tenorBucket: '',
  currency: '',
  entityId: '',
  ftpBpsTolerance: 10,
  rarocPpTolerance: 0.5,
  marginBpsTolerance: undefined,
  priority: 100,
  active: true,
  effectiveFrom: new Date().toISOString().slice(0, 10),
  effectiveTo: undefined,
};

const ToleranceBandEditor: React.FC = () => {
  const { activeEntity } = useEntity();
  const entityId = activeEntity?.id;

  const { data: bands = [], isLoading } = useToleranceBandsQuery(entityId);
  const upsertMutation = useUpsertToleranceBand();
  const deleteMutation = useDeleteToleranceBand();

  const [editingBand, setEditingBand] = useState<FormBand | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const openNew = useCallback(() => {
    setEditingBand({ ...EMPTY_BAND, entityId: entityId ?? '' });
  }, [entityId]);

  const openEdit = useCallback((band: ToleranceBand) => {
    setEditingBand({ ...band });
  }, []);

  const handleSave = useCallback(() => {
    if (!editingBand) return;
    const band: ToleranceBand = {
      id: editingBand.id ?? crypto.randomUUID(),
      product: editingBand.product || undefined,
      segment: editingBand.segment || undefined,
      tenorBucket: editingBand.tenorBucket || undefined,
      currency: editingBand.currency || undefined,
      entityId: editingBand.entityId || undefined,
      ftpBpsTolerance: editingBand.ftpBpsTolerance,
      rarocPpTolerance: editingBand.rarocPpTolerance,
      marginBpsTolerance: editingBand.marginBpsTolerance,
      priority: editingBand.priority,
      active: editingBand.active,
      effectiveFrom: editingBand.effectiveFrom,
      effectiveTo: editingBand.effectiveTo,
      createdAt: editingBand.id ? (bands.find((b) => b.id === editingBand.id)?.createdAt ?? new Date().toISOString()) : new Date().toISOString(),
    };
    upsertMutation.mutate(band, {
      onSuccess: () => setEditingBand(null),
    });
  }, [editingBand, bands, upsertMutation]);

  const handleDelete = useCallback((id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => setDeleteConfirmId(null),
    });
  }, [deleteMutation]);

  const updateField = <K extends keyof FormBand>(field: K, value: FormBand[K]) => {
    setEditingBand((prev) => prev ? { ...prev, [field]: value } : null);
  };

  const thClass = 'border-b border-[color:var(--nfq-border)] px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]';
  const tdClass = 'border-b border-[color:var(--nfq-border-ghost)] px-4 py-2';

  return (
    <div className="nfq-kpi-card p-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-amber-400" />
          <span className="nfq-kpi-label">Tolerance Bands</span>
          <span className="text-[10px] font-mono text-[color:var(--nfq-text-muted)]">
            ({bands.length})
          </span>
        </div>
        <button
          onClick={openNew}
          className="nfq-button nfq-button-primary px-3 text-xs"
        >
          <Plus size={14} className="mr-1.5 inline" />
          Add Band
        </button>
      </div>

      {/* Edit form */}
      {editingBand && (
        <div className="border-b border-[color:var(--nfq-border)] bg-[var(--nfq-bg-elevated)] px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="nfq-kpi-label">
              {editingBand.id ? 'Edit Band' : 'New Tolerance Band'}
            </span>
            <button
              onClick={() => setEditingBand(null)}
              className="rounded p-1 text-[color:var(--nfq-text-muted)] hover:text-[color:var(--nfq-text-primary)]"
            >
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--nfq-text-muted)]">Product</span>
              <input
                type="text"
                value={editingBand.product ?? ''}
                onChange={(e) => updateField('product', e.target.value)}
                placeholder="All"
                className="nfq-input-field text-xs"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--nfq-text-muted)]">Segment</span>
              <input
                type="text"
                value={editingBand.segment ?? ''}
                onChange={(e) => updateField('segment', e.target.value)}
                placeholder="All"
                className="nfq-input-field text-xs"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--nfq-text-muted)]">Tenor Bucket</span>
              <select
                value={editingBand.tenorBucket ?? ''}
                onChange={(e) => updateField('tenorBucket', e.target.value)}
                className="nfq-select-field text-xs"
              >
                <option value="">All</option>
                {TENOR_BUCKETS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--nfq-text-muted)]">Currency</span>
              <input
                type="text"
                value={editingBand.currency ?? ''}
                onChange={(e) => updateField('currency', e.target.value.toUpperCase())}
                placeholder="All"
                maxLength={3}
                className="nfq-input-field text-xs"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--nfq-text-muted)]">FTP Tol. (bps)</span>
              <input
                type="number"
                value={editingBand.ftpBpsTolerance}
                onChange={(e) => updateField('ftpBpsTolerance', Number(e.target.value))}
                min={0}
                step={1}
                className="nfq-input-field text-xs"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--nfq-text-muted)]">RAROC Tol. (pp)</span>
              <input
                type="number"
                value={editingBand.rarocPpTolerance}
                onChange={(e) => updateField('rarocPpTolerance', Number(e.target.value))}
                min={0}
                step={0.1}
                className="nfq-input-field text-xs"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--nfq-text-muted)]">Priority</span>
              <input
                type="number"
                value={editingBand.priority}
                onChange={(e) => updateField('priority', Number(e.target.value))}
                min={1}
                step={1}
                className="nfq-input-field text-xs"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--nfq-text-muted)]">Active</span>
              <button
                type="button"
                onClick={() => updateField('active', !editingBand.active)}
                className={`flex h-[38px] items-center justify-center rounded-lg border text-xs font-mono transition-colors ${
                  editingBand.active
                    ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-400'
                    : 'border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] text-[color:var(--nfq-text-muted)]'
                }`}
              >
                {editingBand.active ? 'Active' : 'Inactive'}
              </button>
            </label>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--nfq-text-muted)]">Effective From</span>
              <input
                type="date"
                value={editingBand.effectiveFrom.slice(0, 10)}
                onChange={(e) => updateField('effectiveFrom', e.target.value)}
                className="nfq-input-field text-xs"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--nfq-text-muted)]">Effective To</span>
              <input
                type="date"
                value={editingBand.effectiveTo?.slice(0, 10) ?? ''}
                onChange={(e) => updateField('effectiveTo', e.target.value || undefined)}
                className="nfq-input-field text-xs"
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setEditingBand(null)}
              className="nfq-button nfq-button-ghost px-3 text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={upsertMutation.isPending}
              className="nfq-button nfq-button-primary px-3 text-xs"
            >
              <Check size={14} className="mr-1 inline" />
              {upsertMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-500" />
        </div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 bg-[var(--nfq-bg-surface)]">
              <tr>
                <th className={thClass}>Priority</th>
                <th className={thClass}>Product</th>
                <th className={thClass}>Segment</th>
                <th className={thClass}>Tenor</th>
                <th className={thClass}>CCY</th>
                <th className={thClass}>FTP (bps)</th>
                <th className={thClass}>RAROC (pp)</th>
                <th className={thClass}>Status</th>
                <th className={`${thClass} w-20`} />
              </tr>
            </thead>
            <tbody className="font-mono text-xs text-[color:var(--nfq-text-secondary)]">
              {bands.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[color:var(--nfq-text-muted)]">
                    No tolerance bands defined
                  </td>
                </tr>
              ) : (
                [...bands]
                  .sort((a, b) => a.priority - b.priority)
                  .map((band) => (
                    <tr
                      key={band.id}
                      className="group transition-colors even:bg-[var(--nfq-bg-surface)] odd:bg-[var(--nfq-bg-root)] hover:bg-[var(--nfq-bg-elevated)]"
                    >
                      <td className={`${tdClass} text-center text-[color:var(--nfq-text-muted)] [font-variant-numeric:tabular-nums]`}>
                        {band.priority}
                      </td>
                      <td className={tdClass}>{band.product || 'All'}</td>
                      <td className={tdClass}>
                        <span className="rounded bg-[var(--nfq-bg-elevated)] px-2 py-0.5 text-[10px]">
                          {band.segment || 'All'}
                        </span>
                      </td>
                      <td className={tdClass}>{band.tenorBucket || 'All'}</td>
                      <td className={tdClass}>{band.currency || 'All'}</td>
                      <td className={`${tdClass} [font-variant-numeric:tabular-nums] text-amber-400`}>
                        +/-{band.ftpBpsTolerance}
                      </td>
                      <td className={`${tdClass} [font-variant-numeric:tabular-nums] text-violet-400`}>
                        +/-{band.rarocPpTolerance.toFixed(2)}
                      </td>
                      <td className={tdClass}>
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium ${
                          band.active
                            ? 'bg-emerald-950/30 text-emerald-400'
                            : 'bg-[var(--nfq-bg-elevated)] text-[color:var(--nfq-text-muted)]'
                        }`}>
                          {band.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className={`${tdClass} text-right`}>
                        <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => openEdit(band)}
                            className="text-[color:var(--nfq-text-muted)] hover:text-[var(--nfq-accent)]"
                          >
                            <Edit size={14} />
                          </button>
                          {deleteConfirmId === band.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(band.id)}
                                className="text-rose-400 hover:text-rose-300"
                                disabled={deleteMutation.isPending}
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="text-[color:var(--nfq-text-muted)] hover:text-[color:var(--nfq-text-primary)]"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(band.id)}
                              className="text-[color:var(--nfq-text-muted)] hover:text-[var(--nfq-danger)]"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ToleranceBandEditor;
