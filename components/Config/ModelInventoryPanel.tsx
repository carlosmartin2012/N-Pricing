import React, { useCallback, useMemo, useState } from 'react';
import type {
  BacktestResult,
  ModelCategory,
  ModelMetadata,
  ModelStatus,
} from '../../utils/pricing/modelInventory';
import { apiPost } from '../../utils/apiFetch';
import { ShieldCheck } from 'lucide-react';
import {
  CategoryBadge,
  StatusBadge,
  TrafficLightDot,
} from './ModelInventoryBadges';
import ModelInventoryDrawer from './ModelInventoryDrawer';
import {
  CATEGORY_COLORS,
  CATEGORY_OPTIONS,
  DEFAULT_SEED,
  formatDateES,
  isOverdue,
  STATUS_LABELS,
  STATUS_OPTIONS,
} from './modelInventoryConfig';

interface ModelInventoryPanelProps {
  initialModels?: ModelMetadata[];
}

const ModelInventoryPanel: React.FC<ModelInventoryPanelProps> = ({
  initialModels,
}) => {
  const [models] = useState<ModelMetadata[]>(() => initialModels ?? DEFAULT_SEED);
  const [categoryFilter, setCategoryFilter] = useState<ModelCategory | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<ModelStatus | 'ALL'>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [backtestsById, setBacktestsById] = useState<Record<string, BacktestResult>>({});
  const [runningId, setRunningId] = useState<string | null>(null);
  const [errorsById, setErrorsById] = useState<Record<string, string>>({});

  const filteredModels = useMemo(
    () =>
      models.filter((model) => {
        if (categoryFilter !== 'ALL' && model.category !== categoryFilter) return false;
        if (statusFilter !== 'ALL' && model.status !== statusFilter) return false;
        return true;
      }),
    [categoryFilter, models, statusFilter]
  );

  const selectedModel = useMemo(
    () => (selectedId ? models.find((model) => model.id === selectedId) ?? null : null),
    [models, selectedId]
  );

  const handleRunBacktest = useCallback(async () => {
    if (!selectedModel) return;
    const modelId = selectedModel.id;
    setRunningId(modelId);
    setErrorsById((previous) => {
      const next = { ...previous };
      delete next[modelId];
      return next;
    });

    try {
      const observations = Array.from({ length: 60 }, (_, index) => ({
        date: new Date(Date.now() - index * 86_400_000).toISOString().slice(0, 10),
        predicted: 0.02 + Math.random() * 0.04,
        actual: Math.random() < 0.04 ? 1 : 0,
      }));

      const result = await apiPost<BacktestResult>('/pricing/mrm-backtest', {
        modelId,
        category: selectedModel.category,
        observations,
      });

      setBacktestsById((previous) => ({ ...previous, [modelId]: result }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Error desconocido ejecutando backtest';
      setErrorsById((previous) => ({ ...previous, [modelId]: message }));
    } finally {
      setRunningId((previous) => (previous === modelId ? null : previous));
    }
  }, [selectedModel]);

  return (
    <div className="rounded-[14px] bg-[var(--nfq-bg-surface)] p-6">
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

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <FilterSelect
          id="mrm-category-filter"
          label="Categoría"
          value={categoryFilter}
          onChange={(value) => setCategoryFilter(value as ModelCategory | 'ALL')}
        >
          <option value="ALL">Todas</option>
          {CATEGORY_OPTIONS.map((category) => (
            <option key={category} value={category}>
              {CATEGORY_COLORS[category]?.label ?? category}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          id="mrm-status-filter"
          label="Estado"
          value={statusFilter}
          onChange={(value) => setStatusFilter(value as ModelStatus | 'ALL')}
        >
          <option value="ALL">Todos</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </FilterSelect>

        <div className="ml-auto font-mono text-[11px] text-neutral-500">
          {filteredModels.length} / {models.length} modelos
        </div>
      </div>

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
            {filteredModels.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-sm text-neutral-500">
                  Sin modelos que coincidan con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              filteredModels.map((model, index) => {
                const overdue = isOverdue(model.nextValidationDate);
                const backtest = backtestsById[model.id];
                return (
                  <tr
                    key={model.id}
                    className={index % 2 === 1 ? 'bg-[var(--nfq-bg-elevated)]/40' : undefined}
                  >
                    <td className="px-3 py-3 font-mono text-xs text-neutral-300">{model.id}</td>
                    <td className="px-3 py-3 text-sm text-neutral-100">{model.name}</td>
                    <td className="px-3 py-3">
                      <CategoryBadge category={model.category} />
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-neutral-300">
                      v{model.version}
                    </td>
                    <td className="px-3 py-3 text-sm text-neutral-300">{model.owner}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={model.status} />
                    </td>
                    <td
                      className={`px-3 py-3 font-mono text-xs ${
                        overdue ? 'font-semibold text-red-400' : 'text-neutral-300'
                      }`}
                    >
                      {formatDateES(model.nextValidationDate)}
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
                        <span className="font-mono text-[10px] text-neutral-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedId(model.id)}
                        className="inline-flex h-7 items-center rounded-md bg-white/5 px-2.5 font-mono text-[10px] uppercase tracking-wider text-neutral-200 transition hover:bg-white/10"
                      >
                        Ver detalles
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedModel && (
        <ModelInventoryDrawer
          model={selectedModel}
          backtest={backtestsById[selectedModel.id] ?? null}
          isRunning={runningId === selectedModel.id}
          error={errorsById[selectedModel.id] ?? null}
          onClose={() => setSelectedId(null)}
          onRunBacktest={handleRunBacktest}
        />
      )}
    </div>
  );
};

function FilterSelect({
  children,
  id,
  label,
  onChange,
  value,
}: {
  children: React.ReactNode;
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor={id}
        className="font-mono text-[10px] uppercase tracking-wider text-neutral-500"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-md border border-white/10 bg-[var(--nfq-bg-elevated)] px-3 font-mono text-xs text-neutral-200 focus:border-nfq-amber focus:outline-none"
      >
        {children}
      </select>
    </div>
  );
}

export default ModelInventoryPanel;
