import React, { useEffect, useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { useLtvImpactPreviewQuery } from '../../hooks/queries/useClvQueries';
import { useUI } from '../../contexts/UIContext';
import { clvTranslations } from '../../translations/index';
import type { DealCandidate } from '../../types/clv';

/**
 * Killer demo panel: live ΔCLV as the pricer tweaks the deal rate.
 *
 * Embedded inside the Pricing workspace (Calculator tab). Receives the
 * current deal candidate + clientId from its parent; debounces the server
 * roundtrip so rate sliders don't flood the backend.
 */

interface Props {
  clientId: string | null;
  candidate: Partial<DealCandidate>;
  debounceMs?: number;
}

const fmtEur = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
};
const fmtPct = (v: number | null | undefined): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(1)}%`;

function candidateReady(c: Partial<DealCandidate>): c is DealCandidate {
  return !!c.productType
    && Number.isFinite(c.amountEur)
    && Number.isFinite(c.marginBps)
    && Number.isFinite(c.tenorYears)
    && Number.isFinite(c.rateBps);
}

const LtvImpactPanel: React.FC<Props> = ({ clientId, candidate, debounceMs = 400 }) => {
  const { language } = useUI();
  const t = clvTranslations(language);
  const fingerprint = useMemo(
    () => JSON.stringify({ clientId, ...candidate }),
    [clientId, candidate],
  );

  // Debounce the fingerprint so the query key doesn't change on every keystroke.
  const [debouncedFingerprint, setDebouncedFingerprint] = useState(fingerprint);
  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedFingerprint(fingerprint), debounceMs);
    return () => window.clearTimeout(handle);
  }, [fingerprint, debounceMs]);

  const readyCandidate = candidateReady(candidate) ? candidate : null;
  const { data: result, isFetching: loading } = useLtvImpactPreviewQuery(
    clientId,
    readyCandidate,
    debouncedFingerprint,
  );

  if (!clientId) {
    return (
      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 text-center text-[11px] text-slate-500">
        {t.clvImpactSelectClient}
      </div>
    );
  }

  if (!candidateReady(candidate)) {
    return (
      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 text-center text-[11px] text-slate-500">
        {t.clvImpactIncompleteDeal}
      </div>
    );
  }

  const delta = result?.impact.deltaClvEur ?? 0;
  const positive = delta >= 0;
  const Arrow = positive ? TrendingUp : TrendingDown;
  const accent = positive ? 'text-emerald-300' : 'text-rose-300';

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 space-y-3">
      <header className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-amber-400" />
        <span className="nfq-label text-[10px] text-slate-300">{t.clvImpactTitle}</span>
        {loading && <span className="font-mono text-[9px] text-slate-500">{t.clvImpactComputing}</span>}
      </header>

      {result && (
        <>
          <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
            <div className="rounded bg-white/[0.02] p-2">
              <div className="nfq-label text-[9px] text-slate-400">{t.clvImpactBefore}</div>
              <div className="text-slate-200">{fmtEur(result.before.clvPointEur)}</div>
            </div>
            <div className="rounded bg-white/[0.02] p-2">
              <div className="nfq-label text-[9px] text-slate-400">{t.clvImpactAfter}</div>
              <div className="text-slate-200">{fmtEur(result.impact.clvAfterEur)}</div>
            </div>
            <div className="rounded bg-white/[0.02] p-2">
              <div className="nfq-label text-[9px] text-slate-400">{t.clvImpactDelta}</div>
              <div className={`flex items-center gap-1 font-bold ${accent}`}>
                <Arrow className="h-3 w-3" />
                {fmtEur(delta)}
                <span className="text-[9px] text-slate-500 ml-1">({fmtPct(result.impact.deltaClvPct)})</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-[10px]">
            <Contrib label={t.clvImpactNii}               value={result.impact.breakdown.directNiiEur} />
            <Contrib label={t.clvImpactCrosssell}         value={result.impact.breakdown.crosssellUpliftEur} />
            <Contrib label={t.clvImpactChurnReduction}    value={result.impact.breakdown.churnReductionEur} />
            <Contrib label={t.clvImpactCapitalOpportunity} value={result.impact.breakdown.capitalOpportunityEur} />
          </div>

          <p className="font-mono text-[9px] text-slate-500">
            Horizon {result.assumptions.horizonYears}y · r={(result.assumptions.discountRate * 100).toFixed(1)}% · λ={(result.assumptions.churnHazardAnnual * 100).toFixed(1)}%
          </p>
        </>
      )}
    </div>
  );
};

const Contrib: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  const positive = value >= 0;
  return (
    <div className="rounded bg-white/[0.02] p-2">
      <div className="nfq-label text-[9px] text-slate-400">{label}</div>
      <div className={`font-mono text-[11px] font-bold ${positive ? 'text-emerald-300' : 'text-rose-300'}`}>
        {fmtEur(value)}
      </div>
    </div>
  );
};

export default LtvImpactPanel;
