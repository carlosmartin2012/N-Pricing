import React, { useState, useCallback } from 'react';
import type { ElasticityModel, ElasticitySource } from '../../types';
import {
  RefreshCw,
  Plus,
  Edit,
  TrendingUp,
} from 'lucide-react';
import { Panel, Badge, Button, TextInput, InputGroup, SelectInput } from '../ui/LayoutComponents';
import { useUI } from '../../contexts/UIContext';
import { useEntity } from '../../contexts/EntityContext';
import {
  useElasticityModelsQuery,
  useUpsertElasticityModel,
  useCalibrateElasticityModel,
} from '../../hooks/queries/useWhatIfQueries';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtR2(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '\u2014';
  return value.toFixed(4);
}

function r2Tone(value: number | null): string {
  if (value === null) return 'text-[color:var(--nfq-text-secondary)]';
  if (value >= 0.8) return 'text-emerald-400';
  if (value >= 0.5) return 'text-amber-400';
  return 'text-rose-400';
}

function r2BadgeVariant(value: number | null): 'success' | 'warning' | 'danger' | 'muted' {
  if (value === null) return 'muted';
  if (value >= 0.8) return 'success';
  if (value >= 0.5) return 'warning';
  return 'danger';
}

function r2Label(value: number | null): string {
  if (value === null) return 'N/A';
  if (value >= 0.8) return 'High';
  if (value >= 0.5) return 'Medium';
  return 'Low';
}

const SOURCE_LABELS: Record<ElasticitySource, string> = {
  empirical: 'Empirical',
  expert: 'Expert',
  hybrid: 'Hybrid',
};

// ---------------------------------------------------------------------------
// Form for adding/editing a model
// ---------------------------------------------------------------------------

interface ModelFormState {
  product: string;
  segment: string;
  currency: string;
  slope: string;
  intercept: string;
  rSquared: string;
  source: ElasticitySource;
  notes: string;
}

const EMPTY_FORM: ModelFormState = {
  product: '',
  segment: '',
  currency: 'EUR',
  slope: '-0.5',
  intercept: '100',
  rSquared: '',
  source: 'expert',
  notes: '',
};

function formFromModel(model: ElasticityModel): ModelFormState {
  return {
    product: model.product,
    segment: model.segment,
    currency: model.currency ?? 'EUR',
    slope: String(model.slope),
    intercept: String(model.intercept),
    rSquared: model.rSquared !== null ? String(model.rSquared) : '',
    source: model.source,
    notes: model.notes ?? '',
  };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const ElasticityCalibration: React.FC = () => {
  const { t } = useUI();
  const { activeEntity } = useEntity();
  const entityId = activeEntity?.id;

  // --- State ---
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ModelFormState>(EMPTY_FORM);
  const [calibratingId, setCalibratingId] = useState<string | null>(null);

  // --- Queries ---
  const { data: models = [], isLoading } = useElasticityModelsQuery(entityId);
  const upsertMutation = useUpsertElasticityModel();
  const calibrateMutation = useCalibrateElasticityModel();

  // --- Handlers ---
  const handleOpenAdd = useCallback(() => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }, []);

  const handleOpenEdit = useCallback((model: ElasticityModel) => {
    setEditingId(model.id);
    setForm(formFromModel(model));
    setShowForm(true);
  }, []);

  const handleCancel = useCallback(() => {
    setShowForm(false);
    setEditingId(null);
  }, []);

  const handleSave = useCallback(() => {
    const now = new Date().toISOString();
    const model: ElasticityModel = {
      id: editingId ?? crypto.randomUUID(),
      product: form.product,
      segment: form.segment,
      currency: form.currency || undefined,
      entityId,
      slope: parseFloat(form.slope) || 0,
      intercept: parseFloat(form.intercept) || 0,
      rSquared: form.rSquared ? parseFloat(form.rSquared) : null,
      source: form.source,
      calibratedAt: now,
      calibratedByEmail: '',
      validFrom: now,
      notes: form.notes || undefined,
    };
    upsertMutation.mutate(model, {
      onSuccess: () => {
        setShowForm(false);
        setEditingId(null);
      },
    });
  }, [editingId, form, entityId, upsertMutation]);

  const handleCalibrate = useCallback(
    (modelId: string, product: string, segment: string) => {
      setCalibratingId(modelId);
      calibrateMutation.mutate(
        { product, segment, entityId },
        {
          onSuccess: () => setCalibratingId(null),
          onError: () => setCalibratingId(null),
        },
      );
    },
    [entityId, calibrateMutation],
  );

  const updateField = useCallback(
    <K extends keyof ModelFormState>(key: K, value: ModelFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Panel
      title="Elasticity Models"
      icon={<TrendingUp className="h-5 w-5 text-cyan-400" />}
      actions={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={handleOpenAdd}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add Expert Model
          </Button>
        </div>
      }
    >
      <div className="space-y-4 p-4">
        {/* --- Form --- */}
        {showForm && (
          <div className="rounded-[16px] border border-cyan-500/20 bg-[var(--nfq-bg-elevated)] p-4 space-y-3">
            <h4 className="text-xs font-medium text-[color:var(--nfq-text-secondary)]">
              {editingId ? 'Edit Model' : 'New Expert Model'}
            </h4>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <InputGroup label="Product">
                <TextInput
                  value={form.product}
                  onChange={(e) => updateField('product', e.target.value)}
                  placeholder="e.g. Term Loan"
                />
              </InputGroup>
              <InputGroup label="Segment">
                <TextInput
                  value={form.segment}
                  onChange={(e) => updateField('segment', e.target.value)}
                  placeholder="e.g. Corporate"
                />
              </InputGroup>
              <InputGroup label="Currency">
                <TextInput
                  value={form.currency}
                  onChange={(e) => updateField('currency', e.target.value)}
                  placeholder="EUR"
                />
              </InputGroup>
              <InputGroup label="Slope (dV/dP)">
                <TextInput
                  type="number"
                  step="0.01"
                  value={form.slope}
                  onChange={(e) => updateField('slope', e.target.value)}
                />
              </InputGroup>
              <InputGroup label="Intercept">
                <TextInput
                  type="number"
                  step="0.01"
                  value={form.intercept}
                  onChange={(e) => updateField('intercept', e.target.value)}
                />
              </InputGroup>
              <InputGroup label="R\u00B2 (optional)">
                <TextInput
                  type="number"
                  step="0.001"
                  min="0"
                  max="1"
                  value={form.rSquared}
                  onChange={(e) => updateField('rSquared', e.target.value)}
                  placeholder="0.00 \u2013 1.00"
                />
              </InputGroup>
              <InputGroup label="Source">
                <SelectInput
                  value={form.source}
                  onChange={(e) => updateField('source', e.target.value as ElasticitySource)}
                >
                  <option value="expert">Expert</option>
                  <option value="empirical">Empirical</option>
                  <option value="hybrid">Hybrid</option>
                </SelectInput>
              </InputGroup>
              <div className="col-span-2">
                <InputGroup label="Notes">
                  <TextInput
                    value={form.notes}
                    onChange={(e) => updateField('notes', e.target.value)}
                    placeholder="Optional notes"
                  />
                </InputGroup>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" onClick={handleSave} disabled={!form.product || !form.segment || upsertMutation.isPending}>
                {upsertMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* --- Table --- */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-500" />
          </div>
        ) : models.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-white/10 py-10 text-center text-xs text-[color:var(--nfq-text-secondary)]">
            No elasticity models configured. Add an expert model or calibrate from history.
          </div>
        ) : (
          <div className="overflow-auto rounded-[16px] border border-white/5">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--nfq-bg-elevated)] border-b border-white/5">
                  <th className="px-4 py-2.5 text-left font-semibold text-[color:var(--nfq-text-secondary)]">Product</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-[color:var(--nfq-text-secondary)]">Segment</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-[color:var(--nfq-text-secondary)]">Slope</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-[color:var(--nfq-text-secondary)]">R\u00B2</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-[color:var(--nfq-text-secondary)]">Confidence</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-[color:var(--nfq-text-secondary)]">Source</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-[color:var(--nfq-text-secondary)]">Calibrated</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-[color:var(--nfq-text-secondary)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {models.map((model) => (
                  <tr
                    key={model.id}
                    className="border-t border-white/5 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-2.5 font-medium text-[color:var(--nfq-text-primary)]">{model.product}</td>
                    <td className="px-4 py-2.5 text-[color:var(--nfq-text-primary)]">{model.segment}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-[color:var(--nfq-text-primary)]">
                      {model.slope.toFixed(3)}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono ${r2Tone(model.rSquared)}`}>
                      {fmtR2(model.rSquared)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge variant={r2BadgeVariant(model.rSquared)}>{r2Label(model.rSquared)}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-[color:var(--nfq-text-secondary)]">
                      {SOURCE_LABELS[model.source]}
                    </td>
                    <td className="px-4 py-2.5 text-[color:var(--nfq-text-secondary)]">
                      {new Date(model.calibratedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(model)}
                          className="rounded-lg p-1.5 text-[color:var(--nfq-text-secondary)] hover:bg-white/5 hover:text-cyan-400 transition-colors"
                          aria-label={`Edit ${model.product} model`}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCalibrate(model.id, model.product, model.segment)}
                          disabled={calibratingId === model.id}
                          className="rounded-lg p-1.5 text-[color:var(--nfq-text-secondary)] hover:bg-white/5 hover:text-amber-400 transition-colors disabled:opacity-40"
                          aria-label={`Calibrate ${model.product} model`}
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${calibratingId === model.id ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Panel>
  );
};

export default ElasticityCalibration;
