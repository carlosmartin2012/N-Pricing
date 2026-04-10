import React, { useState, useMemo, useCallback } from 'react';
import type {
  ModelMetadata,
  ModelStatus,
  ModelCategory,
  BacktestResult,
} from '../../utils/pricing/modelInventory';
import { apiPost } from '../../utils/apiFetch';
import {
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ClipboardList,
  Play,
  Loader2,
  X,
} from 'lucide-react';

interface ModelInventoryPanelProps {
  // Initial seed data for demo — in production would come from Supabase
  initialModels?: ModelMetadata[];
}

const DEFAULT_SEED: ModelMetadata[] = [
  {
    id: 'MDL-PD-001',
    name: 'Anejo IX PD — Corporate',
    category: 'PD',
    status: 'PRODUCTION',
    version: '2.1.0',
    owner: 'Risk Modeling',
    description:
      'PD curve per Anejo IX corporate segment with Spanish macro overlay',
    effectiveFrom: '2025-01-01',
    effectiveTo: null,
    nextValidationDate: '2026-06-30',
    validationFrequency: 'ANNUAL',
    methodologyRef: 'internal://models/pd-corp-v2',
    applicableSegments: ['Corporate', 'SME'],
    dataSources: ['Core banking', 'CIRBE'],
    limitations: ['Limited historical data on 2008-2011 cycle'],
    regulatoryRefs: ['Anejo IX BdE Circular 4/2017', 'CRR Art. 180'],
  },
  {
    id: 'MDL-LGD-001',
    name: 'Anejo IX LGD — Mortgage',
    category: 'LGD',
    status: 'PRODUCTION',
    version: '1.4.2',
    owner: 'Risk Modeling',
    description: 'Secured mortgage LGD with HPI-dependent haircuts',
    effectiveFrom: '2025-03-15',
    effectiveTo: null,
    nextValidationDate: '2026-03-15',
    validationFrequency: 'ANNUAL',
    regulatoryRefs: ['Anejo IX BdE', 'CRR Art. 181'],
  },
  {
    id: 'MDL-NMD-001',
    name: 'NMD Replicating Portfolio',
    category: 'NMD_REPLICATION',
    status: 'PRODUCTION',
    version: '3.0.0',
    owner: 'ALM',
    description: 'Core/volatile split with caterpillar replication profile',
    effectiveFrom: '2025-01-01',
    effectiveTo: null,
    nextValidationDate: '2026-01-01',
    validationFrequency: 'ANNUAL',
    regulatoryRefs: ['EBA GL/2018/02 IRRBB'],
  },
  {
    id: 'MDL-CPR-001',
    name: 'Mortgage Prepayment CPR',
    category: 'PREPAYMENT',
    status: 'INTERNAL_VALIDATION',
    version: '0.9.1',
    owner: 'ALM',
    description: 'CPR model with rate-dependent and demographic drivers',
    effectiveFrom: '2026-03-01',
    effectiveTo: null,
    nextValidationDate: '2026-05-01',
    validationFrequency: 'SEMI_ANNUAL',
  },
  {
    id: 'MDL-XBN-001',
    name: 'Cross-Bonus Fulfillment',
    category: 'CROSS_BONUSES',
    status: 'PRODUCTION',
    version: '1.2.0',
    owner: 'Retail Strategy',
    description:
      'Fulfillment probability for nómina, seguros, plan de pensiones',
    effectiveFrom: '2025-09-01',
    effectiveTo: null,
    nextValidationDate: '2026-09-01',
    validationFrequency: 'ANNUAL',
  },
  {
    id: 'MDL-NSS-001',
    name: 'NSS Curve Fit',
    category: 'FTP_CURVE',
    status: 'PRODUCTION',
    version: '1.0.0',
    owner: 'Treasury Quant',
    description: 'Nelson-Siegel-Svensson fit for EUR/USD/GBP yield curves',
    effectiveFrom: '2026-04-01',
    effectiveTo: null,
    nextValidationDate: '2027-04-01',
    validationFrequency: 'ANNUAL',
    regulatoryRefs: ['ECB methodology doc'],
  },
];

const CATEGORY_COLORS: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  PD: { bg: 'bg-nfq-coral/10', text: 'text-nfq-coral', label: 'PD' },
  LGD: { bg: 'bg-nfq-amber/10', text: 'text-nfq-amber', label: 'LGD' },
  EAD: { bg: 'bg-nfq-amber/10', text: 'text-nfq-amber', label: 'EAD' },
  NMD_BETA: { bg: 'bg-nfq-violet/10', text: 'text-nfq-violet', label: 'NMD β' },
  NMD_REPLICATION: {
    bg: 'bg-nfq-violet/10',
    text: 'text-nfq-violet',
    label: 'NMD Repl',
  },
  PREPAYMENT: { bg: 'bg-nfq-steel/10', text: 'text-nfq-steel', label: 'CPR' },
  CROSS_BONUSES: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    label: 'Bonus',
  },
  BEHAVIORAL: {
    bg: 'bg-nfq-violet/10',
    text: 'text-nfq-violet',
    label: 'Behav',
  },
  FTP_CURVE: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Curve' },
  STRESS_SCENARIO: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    label: 'Stress',
  },
  OTHER: { bg: 'bg-gray-500/10', text: 'text-gray-400', label: 'Other' },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: 'bg-gray-500/10', text: 'text-gray-400' },
  INTERNAL_VALIDATION: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
  APPROVED: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  PRODUCTION: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  DEPRECATED: { bg: 'bg-orange-500/10', text: 'text-orange-400' },
  RETIRED: { bg: 'bg-red-500/10', text: 'text-red-400' },
};

const STATUS_LABELS: Record<ModelStatus, string> = {
  DRAFT: 'Borrador',
  INTERNAL_VALIDATION: 'Validación interna',
  APPROVED: 'Aprobado',
  PRODUCTION: 'Producción',
  DEPRECATED: 'Obsoleto',
  RETIRED: 'Retirado',
};

const CATEGORY_OPTIONS: ModelCategory[] = [
  'PD',
  'LGD',
  'EAD',
  'NMD_BETA',
  'NMD_REPLICATION',
  'PREPAYMENT',
  'CROSS_BONUSES',
  'BEHAVIORAL',
  'FTP_CURVE',
  'STRESS_SCENARIO',
  'OTHER',
];

const STATUS_OPTIONS: ModelStatus[] = [
  'DRAFT',
  'INTERNAL_VALIDATION',
  'APPROVED',
  'PRODUCTION',
  'DEPRECATED',
  'RETIRED',
];

function TrafficLightDot({ light }: { light: 'GREEN' | 'AMBER' | 'RED' }) {
  const color =
    light === 'GREEN'
      ? 'bg-emerald-400'
      : light === 'AMBER'
        ? 'bg-amber-400'
        : 'bg-red-400';
  return (
    <div
      className={`inline-block h-2 w-2 rounded-full ${color}`}
      aria-label={light}
    />
  );
}

function formatDateES(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return iso;
  }
}

function isOverdue(iso: string): boolean {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    return d.getTime() < Date.now();
  } catch {
    return false;
  }
}

function CategoryBadge({ category }: { category: ModelCategory }) {
  const cfg = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.OTHER;
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider ${cfg.bg} ${cfg.text}`}
    >
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: ModelStatus }) {
  const cfg = STATUS_COLORS[status] ?? STATUS_COLORS.DRAFT;
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider ${cfg.bg} ${cfg.text}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

interface DetailsDrawerProps {
  model: ModelMetadata;
  backtest: BacktestResult | null;
  isRunning: boolean;
  error: string | null;
  onClose: () => void;
  onRunBacktest: () => void;
}

function DetailsDrawer({
  model,
  backtest,
  isRunning,
  error,
  onClose,
  onRunBacktest,
}: DetailsDrawerProps) {
  const categoryCfg = CATEGORY_COLORS[model.category] ?? CATEGORY_COLORS.OTHER;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalles del modelo ${model.name}`}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative flex h-full w-full max-w-[500px] flex-col overflow-hidden bg-[var(--nfq-bg-elevated)] shadow-2xl"
        style={{ width: '500px' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/5 px-6 py-5">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <CategoryBadge category={model.category} />
              <StatusBadge status={model.status} />
            </div>
            <h3 className="truncate text-lg font-semibold text-white">
              {model.name}
            </h3>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-neutral-400">
              {model.id} · v{model.version}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 transition hover:bg-white/5 hover:text-white"
            aria-label="Cerrar panel de detalles"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* Descripción */}
          <section>
            <h4 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-neutral-400">
              Descripción
            </h4>
            <p className="text-sm leading-relaxed text-neutral-200">
              {model.description || '—'}
            </p>
          </section>

          {/* Metadatos */}
          <section className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                Propietario
              </p>
              <p className="text-sm text-neutral-200">{model.owner}</p>
            </div>
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                Frecuencia validación
              </p>
              <p className="font-mono text-sm text-neutral-200">
                {model.validationFrequency}
              </p>
            </div>
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                Vigente desde
              </p>
              <p className="font-mono text-sm text-neutral-200">
                {formatDateES(model.effectiveFrom)}
              </p>
            </div>
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                Próxima validación
              </p>
              <p
                className={`font-mono text-sm ${
                  isOverdue(model.nextValidationDate)
                    ? 'font-semibold text-red-400'
                    : 'text-neutral-200'
                }`}
              >
                {formatDateES(model.nextValidationDate)}
                {isOverdue(model.nextValidationDate) && ' · VENCIDA'}
              </p>
            </div>
          </section>

          {/* Metodología */}
          {model.methodologyRef && (
            <section>
              <h4 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-neutral-400">
                Referencia metodológica
              </h4>
              <p className="break-all font-mono text-xs text-neutral-300">
                {model.methodologyRef}
              </p>
            </section>
          )}

          {/* Segmentos aplicables */}
          {model.applicableSegments && model.applicableSegments.length > 0 && (
            <section>
              <h4 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-neutral-400">
                Segmentos aplicables
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {model.applicableSegments.map((seg) => (
                  <span
                    key={seg}
                    className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-neutral-200"
                  >
                    {seg}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Fuentes de datos */}
          {model.dataSources && model.dataSources.length > 0 && (
            <section>
              <h4 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-neutral-400">
                Fuentes de datos
              </h4>
              <ul className="space-y-1">
                {model.dataSources.map((ds) => (
                  <li key={ds} className="text-sm text-neutral-300">
                    · {ds}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Referencias regulatorias */}
          {model.regulatoryRefs && model.regulatoryRefs.length > 0 && (
            <section>
              <h4 className="mb-2 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-neutral-400">
                <ShieldCheck size={12} />
                Referencias regulatorias
              </h4>
              <ul className="space-y-1">
                {model.regulatoryRefs.map((ref) => (
                  <li key={ref} className="text-sm text-neutral-300">
                    · {ref}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Limitaciones */}
          {model.limitations && model.limitations.length > 0 && (
            <section>
              <h4 className="mb-2 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-amber-400">
                <AlertCircle size={12} />
                Limitaciones declaradas
              </h4>
              <ul className="space-y-1">
                {model.limitations.map((lim) => (
                  <li key={lim} className="text-sm text-neutral-300">
                    · {lim}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Backtest */}
          <section className="rounded-[10px] bg-[var(--nfq-bg-surface)]/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-neutral-400">
                <ClipboardList size={12} />
                Backtest sintético
              </h4>
              <button
                type="button"
                onClick={onRunBacktest}
                disabled={isRunning}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-nfq-amber/20 px-3 text-xs font-medium text-nfq-amber transition hover:bg-nfq-amber/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRunning ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Ejecutando…
                  </>
                ) : (
                  <>
                    <Play size={12} />
                    Ejecutar backtest
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="mb-3 flex items-start gap-2 rounded-md bg-red-500/10 p-2 text-xs text-red-300">
                <XCircle size={14} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {backtest && !error && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <TrafficLightDot light={backtest.trafficLight} />
                  <span className="font-mono text-xs uppercase tracking-wider text-neutral-200">
                    {backtest.trafficLight}
                  </span>
                  <span className="ml-auto font-mono text-[11px] text-neutral-500">
                    n = {backtest.observations}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                      Bias
                    </p>
                    <p className="font-mono text-sm text-neutral-200">
                      {(backtest.bias * 100).toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                      MAE
                    </p>
                    <p className="font-mono text-sm text-neutral-200">
                      {(backtest.mae * 100).toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                      RMSE
                    </p>
                    <p className="font-mono text-sm text-neutral-200">
                      {(backtest.rmse * 100).toFixed(2)}%
                    </p>
                  </div>
                </div>

                {backtest.hitRate !== undefined && (
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                      Hit rate
                    </p>
                    <p className="font-mono text-sm text-neutral-200">
                      {(backtest.hitRate * 100).toFixed(1)}%
                    </p>
                  </div>
                )}

                {backtest.findings.length > 0 && (
                  <div>
                    <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                      Hallazgos
                    </p>
                    <ul className="space-y-1">
                      {backtest.findings.map((f, i) => (
                        <li
                          key={`${f}-${i}`}
                          className="flex items-start gap-1.5 text-xs text-neutral-300"
                        >
                          <CheckCircle2
                            size={12}
                            className="mt-0.5 flex-shrink-0 text-emerald-400"
                          />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {!backtest && !error && !isRunning && (
              <p className="text-xs text-neutral-500">
                Sin backtest ejecutado. Pulsa ejecutar para correr con datos
                sintéticos de demo.
              </p>
            )}
          </section>

          {/* Padding bottom */}
          <div className="h-4" aria-hidden="true" />
        </div>

        <div
          className={`h-1 w-full ${categoryCfg.bg}`}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

const ModelInventoryPanel: React.FC<ModelInventoryPanelProps> = ({
  initialModels,
}) => {
  const [models] = useState<ModelMetadata[]>(
    () => initialModels ?? DEFAULT_SEED,
  );
  const [categoryFilter, setCategoryFilter] = useState<ModelCategory | 'ALL'>(
    'ALL',
  );
  const [statusFilter, setStatusFilter] = useState<ModelStatus | 'ALL'>('ALL');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [backtestsById, setBacktestsById] = useState<
    Record<string, BacktestResult>
  >({});
  const [runningId, setRunningId] = useState<string | null>(null);
  const [errorsById, setErrorsById] = useState<Record<string, string>>({});

  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      if (categoryFilter !== 'ALL' && m.category !== categoryFilter)
        return false;
      if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;
      return true;
    });
  }, [models, categoryFilter, statusFilter]);

  const selectedModel = useMemo(
    () => (selectedId ? models.find((m) => m.id === selectedId) ?? null : null),
    [models, selectedId],
  );

  const handleRunBacktest = useCallback(async () => {
    if (!selectedModel) return;
    const modelId = selectedModel.id;
    setRunningId(modelId);
    setErrorsById((prev) => {
      const next = { ...prev };
      delete next[modelId];
      return next;
    });

    try {
      // Synthetic observations for demo — in production these would come from
      // the model's actual backtesting dataset
      const observations = Array.from({ length: 60 }, (_, i) => ({
        date: new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10),
        predicted: 0.02 + Math.random() * 0.04,
        actual: Math.random() < 0.04 ? 1 : 0,
      }));

      const result = await apiPost<BacktestResult>('/pricing/mrm-backtest', {
        modelId,
        category: selectedModel.category,
        observations,
      });

      setBacktestsById((prev) => ({ ...prev, [modelId]: result }));
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Error desconocido ejecutando backtest';
      setErrorsById((prev) => ({ ...prev, [modelId]: message }));
    } finally {
      setRunningId((prev) => (prev === modelId ? null : prev));
    }
  }, [selectedModel]);

  const handleCloseDrawer = useCallback(() => {
    setSelectedId(null);
  }, []);

  return (
    <div className="rounded-[14px] bg-[var(--nfq-bg-surface)] p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <ShieldCheck size={18} className="text-nfq-amber" />
            Model Inventory &amp; MRM
          </h2>
          <p className="mt-1 text-sm text-neutral-400">
            Repositorio de modelos versionado alineado con TRIM/SS1/23
          </p>
        </div>
        <div className="hidden flex-col items-end gap-0.5 md:flex">
          <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
            Modelos registrados
          </p>
          <p className="font-mono text-xl text-white">{models.length}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label
            htmlFor="mrm-category-filter"
            className="font-mono text-[10px] uppercase tracking-wider text-neutral-500"
          >
            Categoría
          </label>
          <select
            id="mrm-category-filter"
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(e.target.value as ModelCategory | 'ALL')
            }
            className="h-9 rounded-md border border-white/10 bg-[var(--nfq-bg-elevated)] px-3 font-mono text-xs text-neutral-200 focus:border-nfq-amber focus:outline-none"
          >
            <option value="ALL">Todas</option>
            {CATEGORY_OPTIONS.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_COLORS[cat]?.label ?? cat}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="mrm-status-filter"
            className="font-mono text-[10px] uppercase tracking-wider text-neutral-500"
          >
            Estado
          </label>
          <select
            id="mrm-status-filter"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as ModelStatus | 'ALL')
            }
            className="h-9 rounded-md border border-white/10 bg-[var(--nfq-bg-elevated)] px-3 font-mono text-xs text-neutral-200 focus:border-nfq-amber focus:outline-none"
          >
            <option value="ALL">Todos</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto font-mono text-[11px] text-neutral-500">
          {filteredModels.length} / {models.length} modelos
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-[10px]">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
              <th className="px-3 py-2 font-normal">Model ID</th>
              <th className="px-3 py-2 font-normal">Nombre</th>
              <th className="px-3 py-2 font-normal">Categoría</th>
              <th className="px-3 py-2 font-normal">Versión</th>
              <th className="px-3 py-2 font-normal">Propietario</th>
              <th className="px-3 py-2 font-normal">Estado</th>
              <th className="px-3 py-2 font-normal">Próx. validación</th>
              <th className="px-3 py-2 font-normal">Backtest</th>
              <th className="px-3 py-2 font-normal" />
            </tr>
          </thead>
          <tbody>
            {filteredModels.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-8 text-center text-sm text-neutral-500"
                >
                  Sin modelos que coincidan con los filtros seleccionados.
                </td>
              </tr>
            )}
            {filteredModels.map((m, idx) => {
              const overdue = isOverdue(m.nextValidationDate);
              const backtest = backtestsById[m.id];
              return (
                <tr
                  key={m.id}
                  className={
                    idx % 2 === 1
                      ? 'bg-[var(--nfq-bg-elevated)]/40'
                      : undefined
                  }
                >
                  <td className="px-3 py-3 font-mono text-xs text-neutral-300">
                    {m.id}
                  </td>
                  <td className="px-3 py-3 text-sm text-neutral-100">
                    {m.name}
                  </td>
                  <td className="px-3 py-3">
                    <CategoryBadge category={m.category} />
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-neutral-300">
                    v{m.version}
                  </td>
                  <td className="px-3 py-3 text-sm text-neutral-300">
                    {m.owner}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={m.status} />
                  </td>
                  <td
                    className={`px-3 py-3 font-mono text-xs ${
                      overdue
                        ? 'font-semibold text-red-400'
                        : 'text-neutral-300'
                    }`}
                  >
                    {formatDateES(m.nextValidationDate)}
                  </td>
                  <td className="px-3 py-3">
                    {backtest ? (
                      <div className="flex items-center gap-1.5">
                        <TrafficLightDot light={backtest.trafficLight} />
                        <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                          {backtest.trafficLight}
                        </span>
                      </div>
                    ) : (
                      <span className="font-mono text-[10px] text-neutral-600">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedId(m.id)}
                      className="inline-flex h-7 items-center rounded-md bg-white/5 px-2.5 font-mono text-[10px] uppercase tracking-wider text-neutral-200 transition hover:bg-white/10"
                    >
                      Ver detalles
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedModel && (
        <DetailsDrawer
          model={selectedModel}
          backtest={backtestsById[selectedModel.id] ?? null}
          isRunning={runningId === selectedModel.id}
          error={errorsById[selectedModel.id] ?? null}
          onClose={handleCloseDrawer}
          onRunBacktest={handleRunBacktest}
        />
      )}
    </div>
  );
};

export default ModelInventoryPanel;
