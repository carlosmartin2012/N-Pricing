import React, { useMemo, useState } from 'react';
import { Network, Plus, Trash2, ShieldOff, Save } from 'lucide-react';
import { useUI } from '../../contexts/UIContext';
import { attributionsTranslations } from '../../translations/index';
import {
  useAttributionMatrixQuery,
  useCreateLevelMutation,
  useCreateThresholdMutation,
  useUpdateLevelMutation,
  useUpdateThresholdMutation,
} from '../../hooks/queries/useAttributionsQueries';
import { sortLevelsAscending } from '../../utils/attributions';
import type {
  AttributionLevel,
  AttributionScope,
  AttributionThreshold,
} from '../../types/attributions';
import type {
  CreateLevelInput,
  CreateThresholdInput,
} from '../../api/attributions';

const fmtBpsOrDash = (v: number | null) => (v === null ? '—' : `${v.toFixed(1)} bps`);
const fmtPpOrDash = (v: number | null) => (v === null ? '—' : `${v.toFixed(2)} pp`);
const fmtEurOrDash = (v: number | null) =>
  v === null ? '—' : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

/**
 * Attribution Matrix View (Ola 8 Bloque B) — editor para Admin/Risk_Manager.
 *
 * Lista plana de niveles ordenados ascending por levelOrder + thresholds
 * agrupados por nivel. Forms inline para crear nuevos niveles/thresholds.
 *
 * Versioning: actualizar/desactivar nunca borra; el repo soporta soft-delete
 * via `active=false` para preservar FK histórico en attribution_decisions.
 *
 * Drag-and-drop del árbol jerárquico queda fuera de scope inicial — el
 * editor V1 confía en `parent_id` + `level_order` declarados en el form.
 */
const AttributionMatrixView: React.FC = () => {
  const { language } = useUI();
  const t = attributionsTranslations(language);

  const matrixQuery = useAttributionMatrixQuery();
  const createLevel = useCreateLevelMutation();
  const updateLevel = useUpdateLevelMutation();
  const createThreshold = useCreateThresholdMutation();
  const updateThreshold = useUpdateThresholdMutation();

  const [showLevelForm, setShowLevelForm] = useState(false);
  const [showThresholdForm, setShowThresholdForm] = useState<string | null>(null);

  const sortedLevels = useMemo(
    () => (matrixQuery.data ? sortLevelsAscending(matrixQuery.data.levels) : []),
    [matrixQuery.data],
  );

  const thresholdsByLevel = useMemo(() => {
    const map = new Map<string, AttributionThreshold[]>();
    if (!matrixQuery.data) return map;
    for (const thr of matrixQuery.data.thresholds) {
      const arr = map.get(thr.levelId) ?? [];
      arr.push(thr);
      map.set(thr.levelId, arr);
    }
    return map;
  }, [matrixQuery.data]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Network className="h-5 w-5 text-emerald-400" />
          <div>
            <h2 className="font-mono text-sm font-bold uppercase tracking-tight text-white">
              {t.matrixTitle}
            </h2>
            <p className="text-xs text-slate-400">{t.matrixSubtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowLevelForm((v) => !v)}
          className="flex items-center gap-1 rounded-md border border-white/10 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/20"
        >
          <Plus className="h-3 w-3" />
          {t.matrixAddLevel}
        </button>
      </header>

      {showLevelForm && (
        <LevelForm
          levels={sortedLevels}
          onSubmit={async (input) => {
            await createLevel.mutateAsync(input);
            setShowLevelForm(false);
          }}
          onCancel={() => setShowLevelForm(false)}
          pending={createLevel.isPending}
          t={t}
        />
      )}

      {matrixQuery.isLoading && (
        <div className="rounded-xl border border-white/5 bg-slate-900/40 p-6 text-center text-xs text-slate-400">
          {t.loading}
        </div>
      )}

      {!matrixQuery.isLoading && sortedLevels.length === 0 && (
        <div className="rounded-xl border border-white/5 bg-slate-900/40 p-6 text-center text-xs text-slate-400">
          {t.matrixEmpty}
        </div>
      )}

      {!matrixQuery.isLoading && sortedLevels.length > 0 && (
        <ul className="space-y-3" role="list">
          {sortedLevels.map((level) => {
            const parent = level.parentId
              ? sortedLevels.find((l) => l.id === level.parentId)
              : null;
            const thresholds = thresholdsByLevel.get(level.id) ?? [];
            return (
              <li key={level.id} className="rounded-xl border border-white/5 bg-slate-900/40 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-slate-300">
                        L{level.levelOrder}
                      </span>
                      <h3 className="text-base font-semibold text-white">{level.name}</h3>
                      <span className="font-mono text-[10px] uppercase text-slate-400">
                        {level.rbacRole}
                      </span>
                    </div>
                    {parent && (
                      <p className="mt-1 text-xs text-slate-500">
                        {t.matrixLevelParent}: <span className="text-slate-300">{parent.name}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setShowThresholdForm((current) => (current === level.id ? null : level.id))
                      }
                      className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200 hover:bg-white/10"
                    >
                      <Plus className="h-3 w-3" />
                      {t.matrixAddThreshold}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateLevel.mutate({ id: level.id, input: { active: false } })}
                      disabled={updateLevel.isPending}
                      title={t.matrixLevelDeactivate}
                      className="rounded-md border border-rose-500/30 bg-rose-500/10 p-1 text-rose-300 hover:bg-rose-500/20 disabled:opacity-40"
                      aria-label={t.matrixLevelDeactivate}
                    >
                      <ShieldOff className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {showThresholdForm === level.id && (
                  <div className="mt-3">
                    <ThresholdForm
                      levelId={level.id}
                      onSubmit={async (input) => {
                        await createThreshold.mutateAsync(input);
                        setShowThresholdForm(null);
                      }}
                      onCancel={() => setShowThresholdForm(null)}
                      pending={createThreshold.isPending}
                      t={t}
                    />
                  </div>
                )}

                {thresholds.length > 0 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-[10px] uppercase tracking-wide text-slate-400">
                        <tr>
                          <th className="px-2 py-1">{t.matrixThresholdScope}</th>
                          <th className="px-2 py-1 text-right">{t.matrixThresholdDeviation}</th>
                          <th className="px-2 py-1 text-right">{t.matrixThresholdRaroc}</th>
                          <th className="px-2 py-1 text-right">{t.matrixThresholdVolume}</th>
                          <th className="px-2 py-1">{t.matrixThresholdActiveFrom}</th>
                          <th className="px-2 py-1"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {thresholds.map((thr) => (
                          <tr key={thr.id} className="border-t border-white/5">
                            <td className="px-2 py-1 font-mono text-[11px] text-slate-300">
                              {scopeSummary(thr.scope)}
                            </td>
                            <td className="px-2 py-1 text-right font-mono text-slate-200">
                              {fmtBpsOrDash(thr.deviationBpsMax)}
                            </td>
                            <td className="px-2 py-1 text-right font-mono text-slate-200">
                              {fmtPpOrDash(thr.rarocPpMin)}
                            </td>
                            <td className="px-2 py-1 text-right font-mono text-slate-200">
                              {fmtEurOrDash(thr.volumeEurMax)}
                            </td>
                            <td className="px-2 py-1 font-mono text-[10px] text-slate-400">
                              {thr.activeFrom}{thr.activeTo ? ` → ${thr.activeTo}` : ''}
                            </td>
                            <td className="px-2 py-1 text-right">
                              <button
                                type="button"
                                onClick={() => updateThreshold.mutate({ id: thr.id, input: { isActive: false } })}
                                disabled={updateThreshold.isPending}
                                aria-label={t.matrixLevelDeactivate}
                                className="rounded p-1 text-slate-400 hover:text-rose-300"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

interface LevelFormProps {
  levels: AttributionLevel[];
  onSubmit: (input: CreateLevelInput) => Promise<void> | void;
  onCancel: () => void;
  pending: boolean;
  t: ReturnType<typeof attributionsTranslations>;
}

const LevelForm: React.FC<LevelFormProps> = ({ levels, onSubmit, onCancel, pending, t }) => {
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string | ''>('');
  const [levelOrder, setLevelOrder] = useState<number>(levels.length + 1);
  const [rbacRole, setRbacRole] = useState('BranchManager');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !rbacRole.trim()) return;
    onSubmit({
      name: name.trim(),
      parentId: parentId === '' ? null : parentId,
      levelOrder,
      rbacRole: rbacRole.trim(),
    });
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-white/5 bg-slate-900/40 p-4">
      <div className="grid gap-3 md:grid-cols-4">
        <FieldText label={t.matrixLevelName} value={name} onChange={setName} required />
        <FieldNumber label={t.matrixLevelOrder} value={levelOrder} min={1} onChange={setLevelOrder} />
        <FieldText label={t.matrixLevelRole} value={rbacRole} onChange={setRbacRole} required />
        <FieldSelect
          label={t.matrixLevelParent}
          value={parentId}
          onChange={setParentId}
          options={[{ value: '', label: '—' }, ...levels.map((l) => ({ value: l.id, label: l.name }))]}
        />
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel}
          className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5">
          {t.matrixCancel}
        </button>
        <button type="submit" disabled={pending}
          className="flex items-center gap-1 rounded-md bg-emerald-500/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:bg-slate-600">
          <Save className="h-3 w-3" /> {t.matrixSave}
        </button>
      </div>
    </form>
  );
};

interface ThresholdFormProps {
  levelId: string;
  onSubmit: (input: CreateThresholdInput) => Promise<void> | void;
  onCancel: () => void;
  pending: boolean;
  t: ReturnType<typeof attributionsTranslations>;
}

const ThresholdForm: React.FC<ThresholdFormProps> = ({ levelId, onSubmit, onCancel, pending, t }) => {
  const [productCsv, setProductCsv] = useState('');
  const [segmentCsv, setSegmentCsv] = useState('');
  const [tenorMaxMonths, setTenorMaxMonths] = useState<number | null>(null);
  const [deviationBpsMax, setDeviationBpsMax] = useState<number | null>(null);
  const [rarocPpMin, setRarocPpMin] = useState<number | null>(null);
  const [volumeEurMax, setVolumeEurMax] = useState<number | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (deviationBpsMax === null && rarocPpMin === null && volumeEurMax === null) return;
    const scope: AttributionScope = {};
    const products = productCsv.split(',').map((s) => s.trim()).filter(Boolean);
    const segments = segmentCsv.split(',').map((s) => s.trim()).filter(Boolean);
    if (products.length > 0) scope.product = products;
    if (segments.length > 0) scope.segment = segments;
    if (tenorMaxMonths !== null) scope.tenorMaxMonths = tenorMaxMonths;
    onSubmit({
      levelId,
      scope,
      deviationBpsMax,
      rarocPpMin,
      volumeEurMax,
    });
  };

  return (
    <form onSubmit={submit} className="rounded-md border border-white/10 bg-slate-950/40 p-3">
      <div className="grid gap-3 md:grid-cols-3">
        <FieldText label="product (csv)" value={productCsv} onChange={setProductCsv} placeholder="loan, mortgage" />
        <FieldText label="segment (csv)" value={segmentCsv} onChange={setSegmentCsv} placeholder="SME, Retail" />
        <FieldNumber label="tenorMaxMonths" value={tenorMaxMonths ?? 0} min={0} onChange={(v) => setTenorMaxMonths(v || null)} />
        <FieldNumber label={t.matrixThresholdDeviation} value={deviationBpsMax ?? 0} min={0} onChange={(v) => setDeviationBpsMax(v || null)} />
        <FieldNumber label={t.matrixThresholdRaroc}     value={rarocPpMin ?? 0}     min={0} onChange={(v) => setRarocPpMin(v || null)} />
        <FieldNumber label={t.matrixThresholdVolume}    value={volumeEurMax ?? 0}   min={0} step={1000} onChange={(v) => setVolumeEurMax(v || null)} />
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel}
          className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5">
          {t.matrixCancel}
        </button>
        <button type="submit" disabled={pending}
          className="flex items-center gap-1 rounded-md bg-emerald-500/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:bg-slate-600">
          <Save className="h-3 w-3" /> {t.matrixSave}
        </button>
      </div>
    </form>
  );
};

// ---------------------------------------------------------------------------
// Form primitives + helpers
// ---------------------------------------------------------------------------

interface FieldTextProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}
const FieldText: React.FC<FieldTextProps> = ({ label, value, onChange, required, placeholder }) => (
  <label className="block">
    <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      placeholder={placeholder}
      className="mt-1 w-full rounded border border-white/10 bg-slate-900/60 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500"
    />
  </label>
);

interface FieldNumberProps {
  label: string;
  value: number;
  min?: number;
  step?: number;
  onChange: (n: number) => void;
}
const FieldNumber: React.FC<FieldNumberProps> = ({ label, value, min, step, onChange }) => (
  <label className="block">
    <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
    <input
      type="number"
      value={value}
      min={min}
      step={step ?? 0.1}
      onChange={(e) => onChange(Number(e.target.value))}
      className="mt-1 w-full rounded border border-white/10 bg-slate-900/60 px-2 py-1 text-xs text-slate-100"
    />
  </label>
);

interface FieldSelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}
const FieldSelect: React.FC<FieldSelectProps> = ({ label, value, onChange, options }) => (
  <label className="block">
    <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 w-full rounded border border-white/10 bg-slate-900/60 px-2 py-1 text-xs text-slate-100"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </label>
);

function scopeSummary(scope: AttributionScope): string {
  const parts: string[] = [];
  if (Array.isArray(scope.product)  && scope.product.length  > 0) parts.push(`product: ${scope.product.join('|')}`);
  if (Array.isArray(scope.segment)  && scope.segment.length  > 0) parts.push(`segment: ${scope.segment.join('|')}`);
  if (Array.isArray(scope.currency) && scope.currency.length > 0) parts.push(`ccy: ${scope.currency.join('|')}`);
  if (typeof scope.tenorMaxMonths === 'number') parts.push(`tenor ≤ ${scope.tenorMaxMonths}m`);
  return parts.length === 0 ? '* (any)' : parts.join('; ');
}

// Re-export para tests
export { scopeSummary };
export default AttributionMatrixView;
