import React, { useState, useCallback } from 'react';
import { Plus, Trash2, X, Check, Edit } from 'lucide-react';
import type { CanonicalDealTemplate, CanonicalTemplateValues, TenorBucket } from '../../types';
import { TENOR_BUCKETS } from '../../types';
import {
  useCanonicalTemplatesQuery,
  useUpsertCanonicalTemplate,
  useDeleteCanonicalTemplate,
} from '../../hooks/queries/useTargetGridQueries';
import { useUI } from '../../contexts/UIContext';
import { useEntity } from '../../contexts/EntityContext';

function generateId(): string {
  return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const EMPTY_TEMPLATE: CanonicalTemplateValues = {
  amount: 1_000_000,
  tenorMonths: 24,
  rating: 'BBB',
  clientType: 'Corporate',
  riskWeight: 0.5,
  capitalRatio: 0.08,
  targetROE: 0.12,
  operationalCostBps: 15,
  amortization: 'Bullet',
  repricingFreq: 'Fixed',
  transitionRisk: 'Neutral',
  physicalRisk: 'Low',
  marginTarget: 0.015,
};

const FIELD_DEFS: { key: string & keyof CanonicalTemplateValues; label: string; type: 'number' | 'text' | 'select'; options?: string[] }[] = [
  { key: 'amount', label: 'Amount', type: 'number' },
  { key: 'tenorMonths', label: 'Tenor (months)', type: 'number' },
  { key: 'rating', label: 'Rating', type: 'text' },
  { key: 'clientType', label: 'Client Type', type: 'select', options: ['Corporate', 'Retail', 'SME', 'Institution', 'Gov'] },
  { key: 'riskWeight', label: 'Risk Weight', type: 'number' },
  { key: 'capitalRatio', label: 'Capital Ratio', type: 'number' },
  { key: 'targetROE', label: 'Target ROE', type: 'number' },
  { key: 'operationalCostBps', label: 'Op. Cost (bps)', type: 'number' },
  { key: 'amortization', label: 'Amortization', type: 'select', options: ['Bullet', 'Linear', 'French'] },
  { key: 'repricingFreq', label: 'Repricing Freq', type: 'select', options: ['Fixed', '1M', '3M', '6M', '12M'] },
  { key: 'transitionRisk', label: 'Transition Risk', type: 'select', options: ['Brown', 'Amber', 'Neutral', 'Green'] },
  { key: 'physicalRisk', label: 'Physical Risk', type: 'select', options: ['High', 'Medium', 'Low'] },
  { key: 'marginTarget', label: 'Margin Target', type: 'number' },
];

const CanonicalTemplateEditor: React.FC = () => {
  const { t } = useUI();
  const { activeEntity } = useEntity();
  const entityId = activeEntity?.id;

  const { data: templates = [], isLoading } = useCanonicalTemplatesQuery(entityId);
  const upsertMutation = useUpsertCanonicalTemplate();
  const deleteMutation = useDeleteCanonicalTemplate();

  const [editingTemplate, setEditingTemplate] = useState<CanonicalDealTemplate | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleNew = useCallback(() => {
    const tpl: CanonicalDealTemplate = {
      id: generateId(),
      product: '',
      segment: '',
      tenorBucket: '1-3Y',
      currency: 'EUR',
      entityId,
      template: { ...EMPTY_TEMPLATE },
      editableByRole: ['Methodologist', 'Admin'],
      updatedAt: new Date().toISOString(),
    };
    setEditingTemplate(tpl);
  }, [entityId]);

  const handleEdit = useCallback((tpl: CanonicalDealTemplate) => {
    setEditingTemplate({ ...tpl, template: { ...tpl.template } });
  }, []);

  const handleSave = useCallback(() => {
    if (!editingTemplate) return;
    upsertMutation.mutate({
      ...editingTemplate,
      updatedAt: new Date().toISOString(),
    });
    setEditingTemplate(null);
  }, [editingTemplate, upsertMutation]);

  const handleDelete = useCallback((id: string) => {
    deleteMutation.mutate(id);
    setDeleteConfirmId(null);
  }, [deleteMutation]);

  const updateField = useCallback(
    (key: string, value: unknown) => {
      if (!editingTemplate) return;
      setEditingTemplate((prev) => {
        if (!prev) return prev;
        if (['product', 'segment', 'tenorBucket', 'currency'].includes(key)) {
          return { ...prev, [key]: value };
        }
        return { ...prev, template: { ...prev.template, [key]: value } };
      });
    },
    [editingTemplate],
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 rounded-[24px] bg-[var(--nfq-bg-surface)] p-5">
        <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--nfq-bg-elevated)]" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 w-full animate-pulse rounded-lg bg-[var(--nfq-bg-elevated)]" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="nfq-eyebrow">Canonical Templates</div>
          <p className="mt-1 text-xs text-[color:var(--nfq-text-muted)]">
            Define representative deal parameters per cohort for target grid computation.
          </p>
        </div>
        <button
          onClick={handleNew}
          className="nfq-button nfq-button-primary flex items-center gap-1.5 px-4 py-2 text-[11px] font-medium"
        >
          <Plus size={12} />
          Add Template
        </button>
      </div>

      {/* Template list */}
      <div className="overflow-auto rounded-[22px] bg-[var(--nfq-bg-surface)]">
        <table className="w-full min-w-[600px] border-collapse text-left">
          <thead className="bg-[var(--nfq-bg-elevated)]">
            <tr>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--nfq-text-muted)]">
                {t.productType ?? 'Product'}
              </th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--nfq-text-muted)]">
                {t.anejo_segment ?? 'Segment'}
              </th>
              <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--nfq-text-muted)]">
                Tenor
              </th>
              <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--nfq-text-muted)]">
                {t.currency}
              </th>
              <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--nfq-text-muted)]">
                Amount
              </th>
              <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--nfq-text-muted)]">
                Rating
              </th>
              <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--nfq-text-muted)]">
                Updated
              </th>
              <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--nfq-text-muted)]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {templates.map((tpl) => (
              <tr
                key={tpl.id}
                className="transition-colors hover:bg-[var(--nfq-bg-elevated)] even:bg-[var(--nfq-bg-surface)] odd:bg-[var(--nfq-bg-root)]"
              >
                <td className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-xs font-bold text-[color:var(--nfq-text-primary)]">
                  {tpl.product || '--'}
                </td>
                <td className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-xs text-[color:var(--nfq-text-secondary)]">
                  {tpl.segment || '--'}
                </td>
                <td className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-center font-mono text-xs text-[color:var(--nfq-text-tertiary)] [font-variant-numeric:tabular-nums]">
                  {tpl.tenorBucket}
                </td>
                <td className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-center text-xs text-[color:var(--nfq-text-secondary)]">
                  {tpl.currency}
                </td>
                <td className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono text-xs text-[color:var(--nfq-text-secondary)] [font-variant-numeric:tabular-nums]">
                  {tpl.template.amount.toLocaleString()}
                </td>
                <td className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-center text-xs font-semibold text-[color:var(--nfq-text-secondary)]">
                  {tpl.template.rating}
                </td>
                <td className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right text-[10px] text-[color:var(--nfq-text-muted)]">
                  {new Date(tpl.updatedAt).toLocaleDateString()}
                </td>
                <td className="whitespace-nowrap border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => handleEdit(tpl)}
                      className="p-1 text-[color:var(--nfq-text-muted)] transition-colors hover:text-[var(--nfq-accent)]"
                      title="Edit template"
                      aria-label={`Edit template ${tpl.product} ${tpl.segment}`}
                    >
                      <Edit size={14} />
                    </button>
                    {deleteConfirmId === tpl.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(tpl.id)}
                          className="p-1 text-[var(--nfq-danger)] transition-colors hover:text-[var(--nfq-danger-hover)]"
                          title="Confirm delete"
                          aria-label="Confirm delete"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="p-1 text-[color:var(--nfq-text-muted)] transition-colors hover:text-[color:var(--nfq-text-primary)]"
                          title="Cancel"
                          aria-label="Cancel delete"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(tpl.id)}
                        className="p-1 text-[color:var(--nfq-text-muted)] transition-colors hover:text-[var(--nfq-danger)]"
                        title="Delete template"
                        aria-label={`Delete template ${tpl.product} ${tpl.segment}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {templates.length === 0 && (
              <tr>
                <td colSpan={8} className="py-16 text-center text-sm text-[color:var(--nfq-text-muted)]">
                  No canonical templates defined yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit form modal overlay */}
      {editingTemplate && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-md"
            onClick={() => setEditingTemplate(null)}
          />
          <div className="fixed inset-x-4 top-[5%] z-50 mx-auto max-h-[90vh] max-w-2xl overflow-auto rounded-[22px] bg-[var(--nfq-bg-surface)] shadow-[var(--nfq-shadow-dialog)]">
            {/* Form header */}
            <div className="flex items-center justify-between bg-[var(--nfq-bg-elevated)] px-6 py-5 rounded-t-[22px]">
              <div>
                <div className="nfq-eyebrow">
                  {editingTemplate.id.startsWith('tpl_') && !templates.some((t) => t.id === editingTemplate.id)
                    ? 'New Template'
                    : 'Edit Template'}
                </div>
                <h2 className="mt-2 text-base font-semibold text-[color:var(--nfq-text-primary)]">
                  Canonical Deal Template
                </h2>
              </div>
              <button
                onClick={() => setEditingTemplate(null)}
                aria-label={t.close ?? 'Close'}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--nfq-bg-highest)] text-[color:var(--nfq-text-muted)] transition-colors hover:text-[color:var(--nfq-text-primary)]"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form body */}
            <div className="px-6 py-6">
              {/* Dimension fields */}
              <h3 className="nfq-eyebrow mb-3">Dimensions</h3>
              <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <label className="flex flex-col gap-1.5">
                  <span className="nfq-label">{t.productType ?? 'Product'}</span>
                  <input
                    type="text"
                    value={editingTemplate.product}
                    onChange={(e) => updateField('product', e.target.value)}
                    className="nfq-input py-2 text-xs"
                    placeholder="e.g. Term Loan"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="nfq-label">{t.anejo_segment ?? 'Segment'}</span>
                  <input
                    type="text"
                    value={editingTemplate.segment}
                    onChange={(e) => updateField('segment', e.target.value)}
                    className="nfq-input py-2 text-xs"
                    placeholder="e.g. Corporate"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="nfq-label">Tenor Bucket</span>
                  <select
                    value={editingTemplate.tenorBucket}
                    onChange={(e) => updateField('tenorBucket', e.target.value as TenorBucket)}
                    className="nfq-input py-2 text-xs"
                  >
                    {TENOR_BUCKETS.map((tb) => (
                      <option key={tb} value={tb}>{tb}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="nfq-label">{t.currency}</span>
                  <input
                    type="text"
                    value={editingTemplate.currency}
                    onChange={(e) => updateField('currency', e.target.value)}
                    className="nfq-input py-2 text-xs"
                    placeholder="e.g. EUR"
                  />
                </label>
              </div>

              {/* Template value fields */}
              <h3 className="nfq-eyebrow mb-3">Template Parameters</h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {FIELD_DEFS.map((fd) => (
                  <label key={fd.key} className="flex flex-col gap-1.5">
                    <span className="nfq-label">{fd.label}</span>
                    {fd.type === 'select' ? (
                      <select
                        value={String(editingTemplate.template[fd.key] ?? '')}
                        onChange={(e) => updateField(fd.key, e.target.value)}
                        className="nfq-input py-2 text-xs"
                      >
                        {fd.options?.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : fd.type === 'number' ? (
                      <input
                        type="number"
                        step="any"
                        value={editingTemplate.template[fd.key] as number ?? ''}
                        onChange={(e) => updateField(fd.key, e.target.value === '' ? 0 : Number(e.target.value))}
                        className="nfq-input py-2 text-xs [font-variant-numeric:tabular-nums]"
                      />
                    ) : (
                      <input
                        type="text"
                        value={String(editingTemplate.template[fd.key] ?? '')}
                        onChange={(e) => updateField(fd.key, e.target.value)}
                        className="nfq-input py-2 text-xs"
                      />
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* Form footer */}
            <div className="flex items-center justify-end gap-3 bg-[var(--nfq-bg-elevated)] px-6 py-4 rounded-b-[22px]">
              <button
                onClick={() => setEditingTemplate(null)}
                className="px-4 py-2 text-[11px] font-medium text-[color:var(--nfq-text-muted)] transition-colors hover:text-[color:var(--nfq-text-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!editingTemplate.product || !editingTemplate.segment}
                className="nfq-button nfq-button-primary flex items-center gap-1.5 px-5 py-2 text-[11px] font-medium disabled:opacity-40"
              >
                <Check size={12} />
                {t.save ?? 'Save'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CanonicalTemplateEditor;
