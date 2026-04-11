import React from 'react';
import type {
  BacktestResult,
  ModelMetadata,
} from '../../utils/pricing/modelInventory';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Play,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import {
  CategoryBadge,
  StatusBadge,
  TrafficLightDot,
} from './ModelInventoryBadges';
import {
  CATEGORY_COLORS,
  formatDateES,
  isOverdue,
} from './modelInventoryConfig';

interface ModelInventoryDrawerProps {
  model: ModelMetadata;
  backtest: BacktestResult | null;
  isRunning: boolean;
  error: string | null;
  onClose: () => void;
  onRunBacktest: () => void;
}

const ModelInventoryDrawer: React.FC<ModelInventoryDrawerProps> = ({
  model,
  backtest,
  isRunning,
  error,
  onClose,
  onRunBacktest,
}) => {
  const categoryConfig = CATEGORY_COLORS[model.category] ?? CATEGORY_COLORS.OTHER;

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
        <div className="flex items-start justify-between gap-4 border-b border-white/5 px-6 py-5">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <CategoryBadge category={model.category} />
              <StatusBadge status={model.status} />
            </div>
            <h3 className="truncate text-lg font-semibold text-white">{model.name}</h3>
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

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <section>
            <h4 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-neutral-400">
              Descripción
            </h4>
            <p className="text-sm leading-relaxed text-neutral-200">
              {model.description || '—'}
            </p>
          </section>

          <section className="grid grid-cols-2 gap-4">
            <MetadataField label="Propietario">{model.owner}</MetadataField>
            <MetadataField label="Frecuencia validación">
              {model.validationFrequency}
            </MetadataField>
            <MetadataField label="Vigente desde">
              {formatDateES(model.effectiveFrom)}
            </MetadataField>
            <MetadataField label="Próxima validación">
              <span
                className={
                  isOverdue(model.nextValidationDate)
                    ? 'font-semibold text-red-400'
                    : 'text-neutral-200'
                }
              >
                {formatDateES(model.nextValidationDate)}
                {isOverdue(model.nextValidationDate) && ' · VENCIDA'}
              </span>
            </MetadataField>
          </section>

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

          <TagSection
            title="Segmentos aplicables"
            items={model.applicableSegments}
          />
          <ListSection title="Fuentes de datos" items={model.dataSources} />
          <ListSection
            title="Referencias regulatorias"
            items={model.regulatoryRefs}
            icon={<ShieldCheck size={12} />}
          />
          <ListSection
            title="Limitaciones declaradas"
            items={model.limitations}
            icon={<AlertCircle size={12} />}
            titleClassName="text-amber-400"
          />

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
                <XCircle size={14} className="mt-0.5 shrink-0" />
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
                  <BacktestMetric label="Bias" value={(backtest.bias * 100).toFixed(2)} />
                  <BacktestMetric label="MAE" value={(backtest.mae * 100).toFixed(2)} />
                  <BacktestMetric label="RMSE" value={(backtest.rmse * 100).toFixed(2)} />
                </div>

                {backtest.hitRate !== undefined && (
                  <BacktestMetric
                    label="Hit rate"
                    value={(backtest.hitRate * 100).toFixed(1)}
                  />
                )}

                {backtest.findings.length > 0 && (
                  <div>
                    <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                      Hallazgos
                    </p>
                    <ul className="space-y-1">
                      {backtest.findings.map((finding, index) => (
                        <li
                          key={`${finding}-${index}`}
                          className="flex items-start gap-1.5 text-xs text-neutral-300"
                        >
                          <CheckCircle2
                            size={12}
                            className="mt-0.5 shrink-0 text-emerald-400"
                          />
                          {finding}
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

          <div className="h-4" aria-hidden="true" />
        </div>

        <div className={`h-1 w-full ${categoryConfig.bg}`} aria-hidden="true" />
      </div>
    </div>
  );
};

function MetadataField({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div>
      <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
        {label}
      </p>
      <p className="font-mono text-sm text-neutral-200">{children}</p>
    </div>
  );
}

function TagSection({
  title,
  items,
}: {
  title: string;
  items?: string[];
}) {
  if (!items || items.length === 0) return null;
  return (
    <section>
      <h4 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-neutral-400">
        {title}
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-neutral-200"
          >
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

function ListSection({
  title,
  items,
  icon,
  titleClassName = 'text-neutral-400',
}: {
  title: string;
  items?: string[];
  icon?: React.ReactNode;
  titleClassName?: string;
}) {
  if (!items || items.length === 0) return null;
  return (
    <section>
      <h4
        className={`mb-2 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider ${titleClassName}`}
      >
        {icon}
        {title}
      </h4>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item} className="text-sm text-neutral-300">
            · {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function BacktestMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
        {label}
      </p>
      <p className="font-mono text-sm text-neutral-200">{value}%</p>
    </div>
  );
}

export default ModelInventoryDrawer;
