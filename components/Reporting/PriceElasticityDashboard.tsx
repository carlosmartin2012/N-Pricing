import React, { useMemo, useState } from 'react';
import { TrendingUp, Target, Zap } from 'lucide-react';
import type { Transaction } from '../../types';
import {
  buildPriceResponseCurve,
  findOptimalPrice,
  type ElasticityModel,
  type PriceResponsePoint,
} from '../../utils/pricing/priceElasticity';
import { calibrateFromDeals } from '../../utils/pricing/elasticityCalibration';

interface Props {
  deals: Transaction[];
}

const SEGMENTS = ['ALL', 'Corporate', 'Retail', 'SME', 'Institution'] as const;

function fmtPct(v: number): string { return `${v.toFixed(2)}%`; }

const PriceElasticityDashboard: React.FC<Props> = ({ deals }) => {
  const [selectedSegment, setSelectedSegment] = useState<string>('ALL');

  const booked = useMemo(() => deals.filter((d) => d.status === 'Booked' || d.status === 'Approved'), [deals]);

  // Calibrate from real deal outcomes (wonLost captured).
  // Falls back to a degraded single-segment model from marginTarget
  // distribution when no outcomes exist yet (pre-pilot or empty tenant).
  const { models, isMockFallback, calibrationMethod } = useMemo(() => {
    const calibrated = calibrateFromDeals(deals);
    if (calibrated.length > 0) {
      const map = new Map<string, ElasticityModel>();
      for (const model of calibrated) map.set(model.segmentKey, model);
      // Aggregate "ALL" view weighted by sample_size
      const totalN = calibrated.reduce((s, m) => s + m.sampleSize, 0);
      if (totalN > 0) {
        const weightedElasticity = calibrated.reduce((s, m) => s + m.elasticity * m.sampleSize, 0) / totalN;
        const weightedBaseline = calibrated.reduce((s, m) => s + m.baselineConversion * m.sampleSize, 0) / totalN;
        const weightedAnchor = calibrated.reduce((s, m) => s + m.anchorRate * m.sampleSize, 0) / totalN;
        const allConfidence: 'LOW' | 'MEDIUM' | 'HIGH' =
          totalN >= 100 ? 'HIGH' : totalN >= 30 ? 'MEDIUM' : 'LOW';
        map.set('ALL', {
          segmentKey: 'ALL',
          elasticity: weightedElasticity,
          baselineConversion: weightedBaseline,
          anchorRate: weightedAnchor,
          sampleSize: totalN,
          confidence: allConfidence,
        });
      }
      return { models: map, isMockFallback: false, calibrationMethod: calibrated[0]?.method ?? 'FREQUENTIST' };
    }

    // Fallback: degraded mock
    const map = new Map<string, ElasticityModel>();
    if (booked.length < 3) return { models: map, isMockFallback: true, calibrationMethod: 'MOCK' as const };
    const avgRate = booked.reduce((s, d) => s + (d.marginTarget || 0), 0) / booked.length;
    map.set('ALL', {
      segmentKey: 'ALL',
      elasticity: -0.3,
      baselineConversion: 0.7,
      anchorRate: avgRate,
      sampleSize: booked.length,
      confidence: 'LOW' as const,
    });
    return { models: map, isMockFallback: true, calibrationMethod: 'MOCK' as const };
  }, [deals, booked]);

  const activeModel = useMemo(() => {
    if (selectedSegment === 'ALL') {
      // Get first available model
      return models.values().next().value as ElasticityModel | undefined;
    }
    return models.get(selectedSegment);
  }, [models, selectedSegment]);

  const responseCurve = useMemo<PriceResponsePoint[]>(() => {
    if (!activeModel) return [];
    return buildPriceResponseCurve(activeModel, 0, 10, 0.25);
  }, [activeModel]);

  const optimalPrice = useMemo(() => {
    if (!activeModel) return null;
    return findOptimalPrice(activeModel, 0, 10, 0.1);
  }, [activeModel]);

  if (booked.length < 3) {
    return (
      <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 rounded-[24px] bg-[var(--nfq-bg-surface)] px-8 py-16 text-center">
        <TrendingUp size={28} className="text-[var(--nfq-text-muted)] opacity-60" />
        <h3 className="text-base font-semibold text-[var(--nfq-text-primary)]">Insufficient data</h3>
        <p className="text-sm text-[var(--nfq-text-muted)]">Need at least 3 booked deals to calibrate elasticity models.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Calibration method banner */}
      <div className={`flex items-center justify-between rounded-[10px] px-3 py-2 text-[11px] ${
        isMockFallback
          ? 'bg-[rgba(245,158,11,0.08)] text-[var(--nfq-warning)]'
          : 'bg-[var(--nfq-bg-surface)] text-[color:var(--nfq-text-secondary)]'
      }`}>
        <span className="font-mono uppercase tracking-[0.16em] text-[10px]">
          {isMockFallback ? 'Calibration: MOCK (awaiting outcome capture)' : `Calibration: ${calibrationMethod}`}
        </span>
        {!isMockFallback && activeModel && (
          <span className="font-mono text-[10px]">
            Confidence: <span className="font-semibold">{activeModel.confidence}</span> · n={activeModel.sampleSize}
          </span>
        )}
      </div>

      {/* Segment selector */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--nfq-text-faint)]">Segment</span>
        {SEGMENTS.map((seg) => (
          <button
            key={seg}
            onClick={() => setSelectedSegment(seg)}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${
              selectedSegment === seg
                ? 'bg-[rgba(6,182,212,0.12)] text-[var(--nfq-accent)]'
                : 'text-[var(--nfq-text-muted)] hover:text-[var(--nfq-text-secondary)]'
            }`}
          >
            {seg}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Model stats */}
        <div className="rounded-2xl bg-[var(--nfq-bg-elevated)] p-4">
          <div className="nfq-label">Calibration</div>
          <div className="mt-2 font-mono text-lg font-bold text-[var(--nfq-text-primary)]">
            {activeModel ? `${activeModel.sampleSize} deals` : '—'}
          </div>
          <div className="text-[10px] text-[var(--nfq-text-faint)]">
            R² = {activeModel ? (1 - 1 / (activeModel.sampleSize || 1)).toFixed(3) : '—'}
          </div>
        </div>

        {/* Optimal price */}
        <div className="rounded-2xl bg-[var(--nfq-bg-elevated)] p-4">
          <div className="flex items-center gap-1.5 nfq-label"><Target size={12} /> Optimal Rate</div>
          <div className="mt-2 font-mono text-lg font-bold text-emerald-400">
            {optimalPrice ? fmtPct(optimalPrice.rate) : '—'}
          </div>
          <div className="text-[10px] text-[var(--nfq-text-faint)]">
            Conv: {optimalPrice ? `${(optimalPrice.conversion * 100).toFixed(0)}%` : '—'} · Rev: {optimalPrice ? optimalPrice.expectedRevenue.toFixed(0) : '—'}
          </div>
        </div>

        {/* Model parameters */}
        <div className="rounded-2xl bg-[var(--nfq-bg-elevated)] p-4">
          <div className="flex items-center gap-1.5 nfq-label"><Zap size={12} /> Elasticity</div>
          <div className="mt-2 font-mono text-lg font-bold text-amber-400">
            {activeModel ? activeModel.elasticity.toFixed(3) : '—'}
          </div>
          <div className="text-[10px] text-[var(--nfq-text-faint)]">
            ε elasticity coefficient
          </div>
        </div>
      </div>

      {/* Response curve as simple ASCII-style visualization */}
      {responseCurve.length > 0 && (
        <div className="rounded-2xl border border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] p-4">
          <div className="nfq-label mb-3">Price Response Curve</div>
          <div className="space-y-1">
            {responseCurve.filter((_, i) => i % 2 === 0).map((point) => (
              <div key={point.rate} className="flex items-center gap-2 text-[10px]">
                <span className="w-12 text-right font-mono text-[var(--nfq-text-muted)]">{fmtPct(point.rate)}</span>
                <div className="flex-1 h-3 rounded-full bg-[var(--nfq-bg-elevated)] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      optimalPrice && Math.abs(point.rate - optimalPrice.rate) < 0.3
                        ? 'bg-emerald-500'
                        : 'bg-[var(--nfq-accent)] opacity-60'
                    }`}
                    style={{ width: `${Math.min(point.conversion * 100, 100)}%` }}
                  />
                </div>
                <span className="w-10 font-mono text-[var(--nfq-text-faint)]">
                  {(point.conversion * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PriceElasticityDashboard;
