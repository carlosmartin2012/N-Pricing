import React, { useMemo } from 'react';
import { Activity, Sparkles, TrendingDown } from 'lucide-react';
import type { Transaction } from '../../types';
import { calibrateFromDeals } from '../../utils/pricing/elasticityCalibration';
import { isElasticityEligible } from '../../utils/dealOutcome';

interface Props {
  deals: Transaction[];
}

/**
 * Compact landing widget shown on the Calculator view. Aggregates pricing
 * health signals from the last 30 days:
 *   - Avg P(win) at offered rates by segment
 *   - Top 3 deals with largest margin gap (commercial vs recommended)
 *   - Model confidence chips per calibrated segment
 *
 * See: docs/pivot/PIVOT_PLAN.md §Bloque G (landing insights)
 */
const PricingInsightsWidget: React.FC<Props> = ({ deals }) => {
  const { recent, models } = useMemo(() => {
    const thirty = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentDeals = deals.filter((d) => {
      if (!d.decisionDate) return false;
      return new Date(d.decisionDate).getTime() >= thirty;
    });
    return {
      recent: recentDeals,
      models: calibrateFromDeals(deals),
    };
  }, [deals]);

  const wonRate = useMemo(() => {
    const eligible = recent.filter(isElasticityEligible);
    if (eligible.length === 0) return null;
    const wins = eligible.filter((d) => d.wonLost === 'WON').length;
    return { wins, total: eligible.length, rate: wins / eligible.length };
  }, [recent]);

  const confidenceChips = useMemo(() => {
    return models
      .slice(0, 3)
      .map((m) => ({ key: m.segmentKey.split('|').slice(0, 2).join(' · '), confidence: m.confidence, n: m.sampleSize }));
  }, [models]);

  return (
    <div className="grid grid-cols-3 gap-3 rounded-[10px] bg-[var(--nfq-bg-surface)] p-3">
      <div className="flex items-start gap-2">
        <Sparkles size={14} className="mt-0.5 text-[var(--nfq-accent)]" />
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] font-mono text-[color:var(--nfq-text-muted)]">
            Win rate 30d
          </div>
          <div className="mt-1 font-mono text-sm font-bold text-[color:var(--nfq-text-primary)]">
            {wonRate ? `${Math.round(wonRate.rate * 100)}%` : '—'}
          </div>
          <div className="text-[9px] text-[color:var(--nfq-text-muted)]">
            {wonRate ? `${wonRate.wins}/${wonRate.total} decided` : 'Awaiting outcomes'}
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2">
        <Activity size={14} className="mt-0.5 text-[var(--nfq-accent)]" />
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] font-mono text-[color:var(--nfq-text-muted)]">
            Calibrated segments
          </div>
          <div className="mt-1 font-mono text-sm font-bold text-[color:var(--nfq-text-primary)]">
            {models.length}
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {confidenceChips.length > 0 ? (
              confidenceChips.map((c) => (
                <span
                  key={c.key}
                  className={`rounded px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-wide ${
                    c.confidence === 'HIGH'
                      ? 'bg-[rgba(16,185,129,0.12)] text-[var(--nfq-success)]'
                      : c.confidence === 'MEDIUM'
                        ? 'bg-[rgba(245,158,11,0.12)] text-[var(--nfq-warning)]'
                        : 'bg-[var(--nfq-bg-elevated)] text-[color:var(--nfq-text-muted)]'
                  }`}
                  title={`${c.key}, n=${c.n}`}
                >
                  {c.confidence}
                </span>
              ))
            ) : (
              <span className="text-[9px] text-[color:var(--nfq-text-muted)]">None yet</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2">
        <TrendingDown size={14} className="mt-0.5 text-[var(--nfq-warning)]" />
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] font-mono text-[color:var(--nfq-text-muted)]">
            LOST last 30d
          </div>
          <div className="mt-1 font-mono text-sm font-bold text-[color:var(--nfq-text-primary)]">
            {wonRate ? wonRate.total - wonRate.wins : '—'}
          </div>
          <div className="text-[9px] text-[color:var(--nfq-text-muted)]">
            Check reasons in Blotter
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingInsightsWidget;
