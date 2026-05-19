import React, { useMemo, useState } from 'react';
import { Sparkles, Target, TrendingUp, MessageSquare } from 'lucide-react';
import type { Transaction } from '../../types';
import CopilotAskPanel from '../ui/CopilotAskPanel';
import { calibrateFromDeals } from '../../utils/pricing/elasticityCalibration';
import {
  buildSegmentKey,
  bucketAmount,
  bucketTenor,
  findOptimalPrice,
  predictConversion,
  type ElasticityModel,
} from '../../utils/pricing/priceElasticity';
import { computeEvaBp } from '../../utils/pricing/contexts/governance';

interface Props {
  deal: Transaction;
  deals: Transaction[];
  ftp: number;               // % FTP (cost of funds)
  capitalCharge: number;     // % capital charge
  regulatoryCost: number;    // % ECL / Anejo IX cost
  raroc: number;             // % (ex-ante from pricingEngine)
  hurdleRate: number;        // % (targetROE)
  proposedRate: number;      // % (finalRate from Calculator)
}

function fmtPct(v: number): string {
  return Number.isFinite(v) ? `${v.toFixed(2)}%` : '—';
}

/**
 * Inline panel in Calculator that shows the EV-optimal price alongside the
 * user's proposed rate. Uses the calibrated elasticity model when available,
 * falls back to a degraded one-segment model otherwise.
 *
 * See: docs/pivot/PIVOT_PLAN.md §Bloque E
 */
const CalculatorRecommendationPanel: React.FC<Props> = ({
  deal,
  deals,
  ftp,
  capitalCharge,
  regulatoryCost,
  raroc,
  hurdleRate,
  proposedRate,
}) => {
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  // Close Copilot on Escape
  React.useEffect(() => {
    if (!isCopilotOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsCopilotOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isCopilotOpen]);

  // Calibrate from portfolio; pick the segment matching this deal.
  const { model, isFallback } = useMemo(() => {
    const calibrated = calibrateFromDeals(deals);
    if (calibrated.length === 0) return { model: null, isFallback: true };
    const segmentKey = buildSegmentKey(
      deal.productType,
      deal.clientType,
      bucketAmount(deal.amount),
      bucketTenor(deal.durationMonths),
    );
    const exact = calibrated.find((m) => m.segmentKey === segmentKey);
    if (exact) return { model: exact as ElasticityModel, isFallback: false };
    // Fallback: largest calibrated segment (by sample size) as proxy.
    const sorted = [...calibrated].sort((a, b) => b.sampleSize - a.sampleSize);
    return { model: sorted[0] as ElasticityModel, isFallback: true };
  }, [deal.productType, deal.clientType, deal.amount, deal.durationMonths, deals]);

  // Floor price = full economic breakeven WITH hurdle requirement.
  const floorPrice = useMemo(() => {
    return ftp + regulatoryCost * 100 + capitalCharge + (hurdleRate * capitalCharge) / 100;
  }, [ftp, regulatoryCost, capitalCharge, hurdleRate]);

  const optimal = useMemo(() => {
    if (!model) return null;
    return findOptimalPrice(model, Math.max(0, floorPrice - 2), floorPrice + 5, 0.05);
  }, [model, floorPrice]);

  const pWinProposed = useMemo(() => (model ? predictConversion(model, proposedRate) : 0), [model, proposedRate]);
  const pWinOptimal = useMemo(
    () => (model && optimal ? predictConversion(model, optimal.rate) : 0),
    [model, optimal],
  );

  const evaBp = useMemo(() => computeEvaBp(raroc, hurdleRate), [raroc, hurdleRate]);

  if (!model) {
    return (
      <div className="rounded-[var(--nfq-radius-card)] bg-[var(--nfq-bg-surface)] p-3">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[var(--nfq-accent)]" />
          <span className="text-[10px] uppercase tracking-[0.16em] font-mono text-[color:var(--nfq-text-muted)]">
            Pricing recommendation
          </span>
        </div>
        <p className="mt-2 text-[11px] text-[color:var(--nfq-text-muted)]">
          Awaiting outcome capture in Blotter to calibrate elasticity. Showing commercial rate only.
        </p>
      </div>
    );
  }

  const deltaBp = optimal ? Math.round((proposedRate - optimal.rate) * 100) : 0;

  return (
    <div className="rounded-[var(--nfq-radius-card)] bg-[var(--nfq-bg-surface)] p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[var(--nfq-accent)]" />
          <span className="text-[10px] uppercase tracking-[0.16em] font-mono text-[color:var(--nfq-text-muted)]">
            Pricing recommendation
          </span>
        </div>
        <span className="text-[10px] font-mono text-[color:var(--nfq-text-muted)]">
          {isFallback ? 'Proxy segment · ' : ''}
          Confidence: <span className="font-semibold">{model.confidence}</span> · n={model.sampleSize}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-[8px] bg-[var(--nfq-bg-elevated)] p-2.5">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] font-mono text-[color:var(--nfq-text-muted)]">
            <Target size={10} /> Floor
          </div>
          <div className="mt-1 font-mono text-sm font-bold text-[color:var(--nfq-text-primary)]">
            {fmtPct(floorPrice)}
          </div>
          <div className="text-[9px] text-[color:var(--nfq-text-muted)]">min economic</div>
        </div>

        <div className="rounded-[8px] bg-[rgba(6,182,212,0.08)] p-2.5 ring-1 ring-[var(--nfq-accent)]">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] font-mono text-[var(--nfq-accent)]">
            <TrendingUp size={10} /> Recommended
          </div>
          <div className="mt-1 font-mono text-sm font-bold text-[var(--nfq-accent)]">
            {optimal ? fmtPct(optimal.rate) : '—'}
          </div>
          <div className="text-[9px] text-[color:var(--nfq-text-muted)]">
            P(win) {optimal ? `${(pWinOptimal * 100).toFixed(0)}%` : '—'} · EV peak
          </div>
        </div>

        <div className="rounded-[8px] bg-[var(--nfq-bg-elevated)] p-2.5">
          <div className="text-[10px] uppercase tracking-[0.16em] font-mono text-[color:var(--nfq-text-muted)]">
            Commercial
          </div>
          <div className="mt-1 font-mono text-sm font-bold text-[color:var(--nfq-text-primary)]">
            {fmtPct(proposedRate)}
          </div>
          <div className="text-[9px] text-[color:var(--nfq-text-muted)]">
            P(win) {(pWinProposed * 100).toFixed(0)}% · {deltaBp === 0 ? 'on target' : `${deltaBp > 0 ? '+' : ''}${deltaBp}bp vs rec`}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-[8px] bg-[var(--nfq-bg-elevated)] px-3 py-2">
        <span className="text-[10px] uppercase tracking-[0.16em] font-mono text-[color:var(--nfq-text-muted)]">
          EVA (RAROC − hurdle)
        </span>
        <span
          className={`font-mono text-sm font-semibold ${
            evaBp >= 200
              ? 'text-[var(--nfq-success)]'
              : evaBp >= 0
                ? 'text-[var(--nfq-text-primary)]'
                : evaBp >= -100
                  ? 'text-[var(--nfq-warning)]'
                  : 'text-[var(--nfq-danger)]'
          }`}
        >
          {evaBp > 0 ? '+' : ''}
          {evaBp}bp
        </span>
      </div>

      {proposedRate < floorPrice && (
        <div className="rounded-[8px] bg-[rgba(244,63,94,0.08)] px-3 py-2 text-[11px] text-[var(--nfq-danger)]">
          ⚠︎ Commercial rate below economic floor. Relationship NPV required to justify.
        </div>
      )}

      {/* AI Copilot explain — Pivot Plan + Ola 7 AI Refocus */}
      <button
        onClick={() => setIsCopilotOpen(true)}
        className="group mt-1 flex w-full items-center justify-center gap-2 rounded-[8px] border border-[var(--nfq-border)] bg-[var(--nfq-bg-elevated)] px-3 py-2 text-[12px] font-medium text-[var(--nfq-text-primary)] transition hover:border-[var(--nfq-accent)] hover:bg-[var(--nfq-accent)]/5"
      >
        <Sparkles size={14} className="text-[var(--nfq-accent)] group-hover:scale-110 transition" />
        Explain this recommendation with AI
        <MessageSquare size={14} className="opacity-60" />
      </button>

      {/* Copilot slideover (mejorado) */}
      {isCopilotOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-end bg-black/70" onClick={() => setIsCopilotOpen(false)}>
          <div
            className="h-full w-full max-w-[560px] overflow-auto border-l border-[var(--nfq-border)] bg-[var(--nfq-bg-surface)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header premium con contexto */}
            <div className="sticky top-0 z-10 border-b border-[var(--nfq-border)] bg-[var(--nfq-bg-surface)]/95 backdrop-blur px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-[var(--nfq-accent)]" />
                  <div>
                    <div className="text-sm font-semibold text-[var(--nfq-text-primary)]">Pricing Copilot</div>
                    <div className="text-[11px] text-[var(--nfq-text-muted)] font-mono">
                      {deal.id} · Rec {optimal ? fmtPct(optimal.rate) : '—'} · Proposed {fmtPct(proposedRate)}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsCopilotOpen(false)}
                  className="rounded px-2 py-1 text-[var(--nfq-text-muted)] hover:bg-[var(--nfq-bg-elevated)] hover:text-[var(--nfq-text-primary)]"
                >
                  ✕
                </button>
              </div>

              {/* Context chips */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <div className="rounded-full bg-[var(--nfq-bg-elevated)] px-2.5 py-0.5 text-[10px] font-mono text-[var(--nfq-text-primary)]">
                  EVA {evaBp > 0 ? '+' : ''}{evaBp}bp
                </div>
                <div className="rounded-full bg-[var(--nfq-bg-elevated)] px-2.5 py-0.5 text-[10px] font-mono text-[var(--nfq-text-primary)]">
                  RAROC {fmtPct(raroc)}
                </div>
                <div className="rounded-full bg-[var(--nfq-bg-elevated)] px-2.5 py-0.5 text-[10px] font-mono text-[var(--nfq-text-primary)]">
                  Hurdle {fmtPct(hurdleRate)}
                </div>
                {optimal && (
                  <div className="rounded-full bg-[var(--nfq-accent)]/10 px-2.5 py-0.5 text-[10px] font-mono text-[var(--nfq-accent)]">
                    Δ {deltaBp > 0 ? '+' : ''}{deltaBp}bp vs rec
                  </div>
                )}
              </div>
            </div>

            <div className="p-4">
              <CopilotAskPanel
                context={{
                  dealId: deal.id,
                  oneLine: `Deal ${deal.id} | Rec ${optimal ? fmtPct(optimal.rate) : '—'} | Proposed ${fmtPct(proposedRate)} | EVA ${evaBp > 0 ? '+' : ''}${evaBp}bp | RAROC ${fmtPct(raroc)} | FTP ${fmtPct(ftp)} | Capital ${fmtPct(capitalCharge)} | Regulatory ${fmtPct(regulatoryCost)}`,
                  view: 'CALCULATOR',
                }}
                language="es"
                onClose={() => setIsCopilotOpen(false)}
                initialQuestion={`Explica por qué el precio recomendado (${optimal ? fmtPct(optimal.rate) : '—'}) difiere del propuesto comercial (${fmtPct(proposedRate)}). Incluye desglose de FTP (${fmtPct(ftp)}), Capital Charge (${fmtPct(capitalCharge)}), Regulatory Cost (${fmtPct(regulatoryCost)}), RAROC vs Hurdle (${fmtPct(hurdleRate)}), y cualquier ajuste por relación o ESG.`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalculatorRecommendationPanel;
