import React from 'react';
import { Sparkles, Check, RefreshCw, Tag } from 'lucide-react';
import {
  useClientNbaQuery,
  useGenerateNba,
  useConsumeNba,
} from '../../hooks/queries/useClvQueries';
import type { NbaReasonCode } from '../../types/clv';

const REASON_LABEL: Record<NbaReasonCode, string> = {
  share_of_wallet_low: 'Share-of-wallet low',
  renewal_window_open: 'Renewal window open',
  nim_below_target: 'NIM below target',
  product_gap_core: 'Core product gap',
  cross_sell_cohort_signal: 'Crosssell cohort signal',
  churn_signal_detected: 'Churn signal',
  price_above_market: 'Price above market',
  capacity_underused: 'Capacity underused',
  regulatory_incentive_available: 'Regulatory incentive',
};

interface Props { clientId: string }

const fmtEur = (v: number | null): string =>
  v === null ? '—' : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
const fmtPct = (v: number | null): string => v === null ? '—' : `${(v * 100).toFixed(0)}%`;
const fmtBps = (v: number | null): string => v === null ? '—' : `${v.toFixed(0)} bps`;

const NbaRecommendationCard: React.FC<Props> = ({ clientId }) => {
  const { data: recs = [], isLoading: loading } = useClientNbaQuery(clientId, true);
  const generateMutation = useGenerateNba(clientId);
  const consumeMutation = useConsumeNba(clientId);

  const busy = generateMutation.isPending
    ? 'generate'
    : (consumeMutation.isPending ? (consumeMutation.variables ?? null) : null);

  const generate = () => generateMutation.mutate({});
  const onConsume = (id: string) => consumeMutation.mutate(id);

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-6">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-400" />
          <span className="nfq-label text-[10px] text-slate-300">Next-Best-Action</span>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={busy === 'generate'}
          className="nfq-btn-ghost flex items-center gap-2 px-3 py-1.5 text-[11px] disabled:opacity-60"
        >
          <RefreshCw className={`h-3 w-3 ${busy === 'generate' ? 'animate-spin' : ''}`} />
          {busy === 'generate' ? 'Generating…' : 'Generate NBA'}
        </button>
      </header>

      {!loading && recs.length === 0 && (
        <p className="text-center text-xs text-slate-400">
          No open recommendations. Generate to rank products by expected ΔCLV.
        </p>
      )}

      <ul className="space-y-3">
        {recs.map((r) => (
          <li
            key={r.id}
            className="rounded border border-white/5 bg-white/[0.03] p-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Tag className="h-3 w-3 text-violet-300" />
                  <span className="font-mono text-sm font-bold text-white">{r.recommendedProduct}</span>
                  <span className="font-mono text-[10px] text-slate-500">
                    · {fmtEur(r.recommendedVolumeEur)} · {fmtBps(r.recommendedRateBps)}
                  </span>
                </div>
                {r.rationale && (
                  <p className="mt-1 text-[11px] text-slate-400">{r.rationale}</p>
                )}
              </div>
              <div className="text-right">
                <div className="font-mono text-sm font-bold text-emerald-300">
                  +{fmtEur(r.expectedClvDeltaEur)}
                </div>
                <div className="font-mono text-[10px] text-slate-500">
                  confidence {fmtPct(r.confidence)}
                </div>
              </div>
            </div>

            {r.reasonCodes.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {r.reasonCodes.map((code) => (
                  <span
                    key={code}
                    className="rounded bg-white/[0.05] px-2 py-0.5 font-mono text-[9px] text-slate-300"
                  >
                    {REASON_LABEL[code] ?? code}
                  </span>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onConsume(r.id)}
                disabled={busy === r.id}
                className="nfq-btn-ghost flex items-center gap-2 px-3 py-1 text-[10px] disabled:opacity-60"
              >
                <Check className="h-3 w-3" />
                Mark consumed
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default NbaRecommendationCard;
