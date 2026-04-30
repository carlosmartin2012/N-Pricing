import React, { useMemo, useState } from 'react';
import { Sliders, ArrowDownToLine, AlertTriangle, ShieldCheck, Layers } from 'lucide-react';
import { useUI } from '../../contexts/UIContext';
import { attributionsTranslations } from '../../translations/index';
import { useAttributionMatrixQuery } from '../../hooks/queries/useAttributionsQueries';
import { simulate } from '../../utils/attributions';
import type {
  AttributionMatrix,
  AttributionQuote,
  RoutingReason,
  SimulationInput,
} from '../../types/attributions';

interface Props {
  /** Quote inicial sobre el que simular. Generalmente derivado del FTPResult
   *  actual del Calculator vía `quoteFromFtpResult`. */
  quote: AttributionQuote;
  /** Si se pasa, evita el round-trip al server y se usa directamente. Si no,
   *  se carga via useAttributionMatrixQuery. */
  matrix?: AttributionMatrix | null;
  /** Callback cuando el usuario clica "Aplicar al deal". Recibe el quote
   *  ajustado y los proposedAdjustments aplicados. */
  onApply?: (input: SimulationInput) => void;
  /** Callback cuando el usuario clica "Solicitar aprobación". */
  onRequestApproval?: (input: SimulationInput) => void;
  /** Modo compacto (embebible en Calculator), oculta header. */
  compact?: boolean;
}

const fmtBps = (v: number): string => `${v >= 0 ? '+' : ''}${v.toFixed(1)} bps`;
const fmtPp = (v: number): string => `${v.toFixed(2)} pp`;
const fmtPct = (v: number): string => `${(v / 100).toFixed(2).replace('.', ',')}%`; // bps→%
const fmtEur = (v: number): string =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

function reasonKey(reason: RoutingReason): keyof ReturnType<typeof attributionsTranslations> {
  switch (reason) {
    case 'within_threshold':        return 'simulatorReasonWithin';
    case 'deviation_exceeded':      return 'simulatorReasonDeviation';
    case 'raroc_below_min':         return 'simulatorReasonRaroc';
    case 'volume_exceeded':         return 'simulatorReasonVolume';
    case 'no_applicable_threshold': return 'simulatorReasonNoMatch';
    case 'below_hard_floor':        return 'simulatorReasonHardFloor';
  }
}

/**
 * Attribution Simulator (Ola 8 Bloque B) — widget embebible.
 *
 * El comercial mueve sliders (margen, V.Cruzada, plazo, RAROC) y ve EN
 * TIEMPO REAL quién tiene atribución sobre el resultado simulado.
 * Recálculo cliente-side con `simulate()` puro — paridad con server
 * garantizada (mismo motor) y feedback < 100 ms.
 *
 * Props mínimas: quote actual. Si matrix no se inyecta, se carga via
 * useAttributionMatrixQuery (cache 5 min).
 */
const AttributionSimulator: React.FC<Props> = ({
  quote,
  matrix: matrixProp,
  onApply,
  onRequestApproval,
  compact = false,
}) => {
  const { language } = useUI();
  const t = attributionsTranslations(language);

  const matrixQuery = useAttributionMatrixQuery(matrixProp === undefined);
  const matrix: AttributionMatrix | null = matrixProp !== undefined
    ? matrixProp
    : (matrixQuery.data ?? null);

  // Sliders state
  const [deviationDelta, setDeviationDelta] = useState(0);
  const [rarocOverride, setRarocOverride] = useState<number | null>(null);
  const [tenorDelta, setTenorDelta] = useState(0);
  const [crossSell, setCrossSell] = useState(0);

  const proposedAdjustments: SimulationInput['proposedAdjustments'] = useMemo(() => {
    const out: SimulationInput['proposedAdjustments'] = {};
    if (deviationDelta !== 0)        out.deviationBpsDelta = deviationDelta;
    if (rarocOverride !== null)      out.rarocPpOverride   = rarocOverride;
    if (tenorDelta !== 0)            out.tenorMonthsDelta  = tenorDelta;
    if (crossSell > 0)               out.crossSellEur      = crossSell;
    return out;
  }, [deviationDelta, rarocOverride, tenorDelta, crossSell]);

  const result = useMemo(() => {
    if (!matrix || matrix.levels.length === 0) return null;
    try {
      return simulate({ quote, proposedAdjustments }, matrix);
    } catch {
      return null;
    }
  }, [matrix, quote, proposedAdjustments]);

  const reset = () => {
    setDeviationDelta(0);
    setRarocOverride(null);
    setTenorDelta(0);
    setCrossSell(0);
  };

  const isLoading = matrixProp === undefined && matrixQuery.isLoading;
  const matrixEmpty = !!matrix && matrix.levels.length === 0;

  return (
    <section
      data-testid="attribution-simulator"
      className={`rounded-xl border border-white/5 bg-slate-900/40 ${compact ? 'p-4' : 'p-6'}`}
    >
      {!compact && (
        <header className="mb-4 flex items-center gap-3">
          <Sliders className="h-5 w-5 text-emerald-400" />
          <div>
            <h2 className="font-mono text-sm font-bold uppercase tracking-tight text-white">
              {t.simulatorTitle}
            </h2>
            <p className="text-xs text-slate-400">{t.simulatorSubtitle}</p>
          </div>
        </header>
      )}

      {isLoading && (
        <div className="py-6 text-center text-xs text-slate-400">{t.loading}</div>
      )}

      {!isLoading && matrixEmpty && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          {t.matrixEmpty}
        </div>
      )}

      {!isLoading && result && matrix && (
        <div className="space-y-5">
          {/* Sliders */}
          <div className="grid gap-4 md:grid-cols-2">
            <SliderRow
              label={t.simulatorDeviationLabel}
              value={deviationDelta}
              min={-50}
              max={50}
              step={0.5}
              onChange={setDeviationDelta}
              unit="bps"
            />
            <SliderRow
              label={t.simulatorRarocOverrideLabel}
              value={rarocOverride ?? quote.rarocPp}
              min={0}
              max={50}
              step={0.1}
              onChange={(v) => setRarocOverride(v)}
              unit="pp"
              showOverrideHint={rarocOverride === null}
            />
            <SliderRow
              label={t.simulatorTenorDeltaLabel}
              value={tenorDelta}
              min={-60}
              max={60}
              step={1}
              onChange={setTenorDelta}
              unit="m"
            />
            <SliderRow
              label={t.simulatorCrossSellLabel}
              value={crossSell}
              min={0}
              max={500_000}
              step={5_000}
              onChange={setCrossSell}
              unit="€"
              fmt={(v) => fmtEur(v)}
            />
          </div>

          {/* Resultado */}
          <div className="grid gap-3 rounded-md bg-slate-950/40 p-4 md:grid-cols-3">
            <Stat
              label={t.simulatorBaselinePrice}
              value={fmtPct(quote.finalClientRateBps)}
              sub={fmtBps(quote.finalClientRateBps - quote.standardRateBps)}
            />
            <Stat
              label={t.simulatorAdjustedPrice}
              value={fmtPct(result.adjustedQuote.finalClientRateBps)}
              sub={fmtBps(result.adjustedQuote.finalClientRateBps - result.adjustedQuote.standardRateBps)}
              highlighted
            />
            <Stat
              label={t.simulatorAdjustedRaroc}
              value={fmtPp(result.adjustedQuote.rarocPp)}
              sub={result.diffVsOriginal.rarocPp !== 0
                ? `Δ ${result.diffVsOriginal.rarocPp >= 0 ? '+' : ''}${result.diffVsOriginal.rarocPp.toFixed(2)} pp`
                : ''}
              highlighted
            />
          </div>

          {/* Routing */}
          <div className="rounded-md border border-white/5 bg-slate-900/60 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {result.newRouting.belowHardFloor ? (
                  <AlertTriangle className="h-4 w-4 text-rose-400" />
                ) : (
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                )}
                <span className="font-mono text-xs uppercase tracking-tight text-slate-200">
                  {t.simulatorRequiredLevel}
                </span>
              </div>
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                {t[reasonKey(result.newRouting.reason)]}
              </span>
            </div>

            <div className="mb-3 text-base font-semibold text-white">
              {result.newRouting.requiredLevel.name}
              <span className="ml-2 text-xs text-slate-400">
                ({result.newRouting.requiredLevel.rbacRole})
              </span>
            </div>

            <div className="mb-3 flex items-center gap-1 text-xs text-slate-400">
              <Layers className="h-3 w-3" />
              <span>{t.simulatorChainShort}:</span>
              {result.newRouting.approvalChain.map((l, i) => (
                <span key={l.id} className="font-mono">
                  {i > 0 ? ' → ' : ''}
                  <span className={l.id === result.newRouting.requiredLevel.id ? 'text-emerald-400' : ''}>
                    {l.name}
                  </span>
                </span>
              ))}
            </div>

            {result.diffVsOriginal.levelsAvoided.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-emerald-300">
                <ArrowDownToLine className="h-3 w-3" />
                <span>
                  {t.simulatorTimeAvoided}:{' '}
                  {result.diffVsOriginal.levelsAvoided.map((l) => l.name).join(', ')}
                </span>
              </div>
            )}

            {result.newRouting.belowHardFloor && (
              <div className="mt-3 rounded border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-200">
                {t.simulatorBelowFloor}
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-white/10 bg-transparent px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
            >
              {t.simulatorReset}
            </button>
            {onApply && (
              <button
                type="button"
                onClick={() => onApply({ quote: result.adjustedQuote, proposedAdjustments })}
                className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-100 hover:bg-white/10"
              >
                {t.simulatorApply}
              </button>
            )}
            {onRequestApproval && (
              <button
                type="button"
                disabled={result.newRouting.belowHardFloor}
                onClick={() => onRequestApproval({ quote: result.adjustedQuote, proposedAdjustments })}
                className="rounded-md bg-emerald-500/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-400"
              >
                {t.simulatorRequest}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
  unit: string;
  fmt?: (v: number) => string;
  showOverrideHint?: boolean;
}

const SliderRow: React.FC<SliderRowProps> = ({
  label, value, min, max, step, onChange, unit, fmt, showOverrideHint,
}) => {
  const display = fmt ? fmt(value) : `${value} ${unit}`;
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
          {label}
        </span>
        <span className="font-mono text-xs text-slate-200">
          {showOverrideHint ? <span className="text-slate-500">— {display}</span> : display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-emerald-500"
      />
    </label>
  );
};

interface StatProps {
  label: string;
  value: string;
  sub?: string;
  highlighted?: boolean;
}

const Stat: React.FC<StatProps> = ({ label, value, sub, highlighted }) => (
  <div>
    <div className="font-mono text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
    <div className={`font-mono text-lg font-semibold ${highlighted ? 'text-emerald-300' : 'text-white'}`}>
      {value}
    </div>
    {sub && <div className="font-mono text-[10px] text-slate-400">{sub}</div>}
  </div>
);

export default AttributionSimulator;
