import React, { useMemo } from 'react';
import { Transaction } from '../../types';
import { detectSICR } from '../../utils/pricing/creditLifecycle';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

interface IFRS9StagePanelProps {
  deal: Transaction;
  onChange: (updates: Partial<Transaction>) => void;
}

const STAGE_STYLES: Record<
  1 | 2 | 3,
  { bg: string; text: string; label: string; description: string }
> = {
  1: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    label: 'Stage 1',
    description: 'Performing — EL 12m',
  },
  2: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    label: 'Stage 2',
    description: 'SICR — EL lifetime',
  },
  3: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    label: 'Stage 3',
    description: 'Default — LGD × EAD',
  },
};

const STAGES: Array<1 | 2 | 3> = [1, 2, 3];

const IFRS9StagePanel: React.FC<IFRS9StagePanelProps> = ({ deal, onChange }) => {
  const sicrResult = useMemo(() => {
    return detectSICR({
      pdMultiplier: deal.pdMultiplier,
      daysPastDue: deal.daysPastDue,
      isRefinanced: deal.isRefinanced,
      isWatchlist: deal.isWatchlist,
      isForborne: deal.isForborne,
    });
  }, [
    deal.pdMultiplier,
    deal.daysPastDue,
    deal.isRefinanced,
    deal.isWatchlist,
    deal.isForborne,
  ]);

  const explicitStage: 1 | 2 | 3 = (deal.ifrs9Stage ?? sicrResult.stage) as 1 | 2 | 3;
  const isOverridden = sicrResult.stage !== explicitStage;
  const detectedStyle = STAGE_STYLES[sicrResult.stage];

  const handleStageClick = (stage: 1 | 2 | 3) => {
    onChange({ ifrs9Stage: stage });
  };

  const handleNumberChange = (
    field: 'pdMultiplier' | 'daysPastDue',
    value: string,
  ) => {
    if (value === '') {
      onChange({ [field]: undefined } as Partial<Transaction>);
      return;
    }
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;
    onChange({ [field]: parsed } as Partial<Transaction>);
  };

  const handleCheckboxChange = (
    field: 'isRefinanced' | 'isWatchlist' | 'isForborne',
    checked: boolean,
  ) => {
    onChange({ [field]: checked } as Partial<Transaction>);
  };

  return (
    <section className="rounded-[14px] bg-[var(--nfq-bg-surface)] p-6">
      {/* Header */}
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-white">
            IFRS 9 / Anejo IX — Stage &amp; SICR
          </h3>
          <p className="mt-1 text-xs text-white/60">
            Clasificación de ciclo de vida del crédito
          </p>
        </div>
        <Info className="h-4 w-4 shrink-0 text-white/40" aria-hidden="true" />
      </header>

      {/* Row 1: Stage pills */}
      <div className="mb-6">
        <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
          Stage explícito
        </label>
        <div className="flex flex-wrap gap-2">
          {STAGES.map((stage) => {
            const style = STAGE_STYLES[stage];
            const isSelected = explicitStage === stage;
            return (
              <button
                key={stage}
                type="button"
                onClick={() => handleStageClick(stage)}
                className={[
                  'px-4 py-2 rounded-full cursor-pointer border text-xs font-semibold uppercase tracking-wider transition-all',
                  style.bg,
                  style.text,
                  isSelected
                    ? 'border-white/30 ring-2 ring-white/20'
                    : 'border-white/10 hover:border-white/20',
                ].join(' ')}
                aria-pressed={isSelected}
              >
                <span className="block">{style.label}</span>
                <span className="mt-0.5 block text-[9px] font-normal normal-case tracking-normal opacity-80">
                  {style.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 2: SICR trigger fields (grid 2x3) */}
      <div className="mb-6">
        <label className="mb-3 block font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
          Triggers SICR
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* PD multiplier */}
          <div className="rounded-lg bg-white/5 p-3">
            <label
              htmlFor="ifrs9-pd-multiplier"
              className="mb-1 block font-mono text-[9px] uppercase tracking-[0.16em] text-white/50"
            >
              PD multiplier
            </label>
            <input
              id="ifrs9-pd-multiplier"
              type="number"
              step={0.1}
              min={0}
              value={deal.pdMultiplier ?? ''}
              onChange={(e) => handleNumberChange('pdMultiplier', e.target.value)}
              placeholder="1.0"
              className="w-full rounded-md bg-black/30 px-2 py-1.5 font-mono text-sm text-white outline-none ring-1 ring-white/10 focus:ring-white/30"
            />
            <p className="mt-1 text-[10px] text-white/40">× respecto a originación</p>
          </div>

          {/* Days past due */}
          <div className="rounded-lg bg-white/5 p-3">
            <label
              htmlFor="ifrs9-days-past-due"
              className="mb-1 block font-mono text-[9px] uppercase tracking-[0.16em] text-white/50"
            >
              Días de mora (DPD)
            </label>
            <input
              id="ifrs9-days-past-due"
              type="number"
              step={1}
              min={0}
              value={deal.daysPastDue ?? ''}
              onChange={(e) => handleNumberChange('daysPastDue', e.target.value)}
              placeholder="0"
              className="w-full rounded-md bg-black/30 px-2 py-1.5 font-mono text-sm text-white outline-none ring-1 ring-white/10 focus:ring-white/30"
            />
            <p className="mt-1 text-[10px] text-white/40">&gt;30 SICR · &gt;90 default</p>
          </div>

          {/* Refinanced */}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-white/5 p-3 hover:bg-white/10">
            <input
              type="checkbox"
              checked={deal.isRefinanced ?? false}
              onChange={(e) => handleCheckboxChange('isRefinanced', e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-black/30"
            />
            <div>
              <span className="block font-mono text-[9px] uppercase tracking-[0.16em] text-white/50">
                Refinanciado
              </span>
              <span className="mt-0.5 block text-[11px] text-white/70">
                Bajo dificultades financieras
              </span>
            </div>
          </label>

          {/* Watchlist */}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-white/5 p-3 hover:bg-white/10">
            <input
              type="checkbox"
              checked={deal.isWatchlist ?? false}
              onChange={(e) => handleCheckboxChange('isWatchlist', e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-black/30"
            />
            <div>
              <span className="block font-mono text-[9px] uppercase tracking-[0.16em] text-white/50">
                Watchlist
              </span>
              <span className="mt-0.5 block text-[11px] text-white/70">
                Seguimiento interno
              </span>
            </div>
          </label>

          {/* Forborne */}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-white/5 p-3 hover:bg-white/10">
            <input
              type="checkbox"
              checked={deal.isForborne ?? false}
              onChange={(e) => handleCheckboxChange('isForborne', e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-black/30"
            />
            <div>
              <span className="block font-mono text-[9px] uppercase tracking-[0.16em] text-white/50">
                Forborne
              </span>
              <span className="mt-0.5 block text-[11px] text-white/70">
                Exposición en forbearance
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Bottom: Live SICR result */}
      <div className="rounded-xl bg-black/20 p-4 ring-1 ring-white/5">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
            Detección SICR en vivo
          </span>
          {sicrResult.triggered ? (
            <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          )}
        </div>

        <div className="flex items-center gap-3">
          <span
            className={[
              'px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider',
              detectedStyle.bg,
              detectedStyle.text,
            ].join(' ')}
          >
            {detectedStyle.label}
          </span>
          <span className="text-xs text-white/70">{detectedStyle.description}</span>
        </div>

        {sicrResult.reasons.length > 0 ? (
          <div className="mt-3">
            <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
              Motivos detectados
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sicrResult.reasons.map((reason, idx) => (
                <span
                  key={`${idx}-${reason}`}
                  className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 uppercase tracking-wide"
                >
                  {reason}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-[11px] text-white/50">
            Sin triggers activos — exposición performing.
          </p>
        )}

        {isOverridden ? (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 ring-1 ring-amber-500/30">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"
              aria-hidden="true"
            />
            <p className="text-[11px] text-amber-200">
              <span className="font-semibold">Override activo</span> — SICR detectaría{' '}
              <span className="font-mono">Stage {sicrResult.stage}</span>, pero se ha
              forzado manualmente{' '}
              <span className="font-mono">Stage {explicitStage}</span>.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default IFRS9StagePanel;
