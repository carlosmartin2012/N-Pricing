import React, { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { Transaction, ProductDefinition, BusinessUnit, ClientEntity } from '../../types';
import { calculateFullCreditRisk, backtestCreditRisk } from '../../utils/pricing/creditRiskEngine';
import type { BacktestRecord } from '../../utils/pricing/creditRiskEngine';
import { useUI } from '../../contexts/UIContext';
import { ShieldCheck, Info } from 'lucide-react';

interface Props {
  deals: Transaction[];
  products: ProductDefinition[];
  businessUnits: BusinessUnit[];
  clients: ClientEntity[];
}

// Simple deterministic hash from a string to a number in [0, 1)
function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h % 10000) / 10000;
}

// Seeded pseudo-random using deal id — returns a value in [0, 1)
function seededRandom(id: string, salt: number): number {
  const base = hashSeed(id + String(salt));
  // Apply a secondary mix to reduce correlation between salt values
  return Math.abs(Math.sin(base * 9999.9 + salt * 7.7)) % 1;
}

const tooltipStyle: React.CSSProperties = {
  backgroundColor: 'var(--nfq-bg-elevated)',
  border: '1px solid var(--nfq-border-ghost)',
  borderRadius: 'var(--nfq-radius-lg)',
  padding: '8px 12px',
  fontFamily: 'var(--nfq-font-mono)',
  fontSize: '12px',
};

function formatCurrency(v: number): string {
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toFixed(0);
}

function accuracyColor(ratio: number): string {
  if (ratio >= 0.8 && ratio <= 1.2) return 'text-[color:var(--nfq-success)]';
  if ((ratio >= 0.5 && ratio < 0.8) || (ratio > 1.2 && ratio <= 1.5)) return 'text-[color:var(--nfq-warning)]';
  return 'text-[color:var(--nfq-danger)]';
}

function accuracyBgColor(ratio: number): string {
  if (ratio >= 0.8 && ratio <= 1.2) return 'bg-[#10b981]/10';
  if ((ratio >= 0.5 && ratio < 0.8) || (ratio > 1.2 && ratio <= 1.5)) return 'bg-[#f59e0b]/10';
  return 'bg-[#f43f5e]/10';
}

const BacktestingDashboard: React.FC<Props> = ({ deals }) => {
  const { t } = useUI();

  // Filter to booked/approved deals with valid data
  const bookedDeals = useMemo(
    () => deals.filter(d => (d.status === 'Booked' || d.status === 'Approved') && d.amount > 0 && d.productType),
    [deals],
  );

  // Generate simulated backtest records
  const backtestRecords = useMemo<BacktestRecord[]>(() => {
    return bookedDeals.map(deal => {
      const creditResult = calculateFullCreditRisk({
        productType: deal.productType,
        clientType: deal.clientType,
        amount: deal.amount,
        ltvPct: deal.haircutPct ?? 0,
        collateralType: deal.collateralType ?? 'None',
        collateralValue: deal.collateralType && deal.collateralType !== 'None' ? deal.amount * 0.6 : 0,
        guaranteeType: deal.guaranteeType,
        appraisalAgeMonths: deal.appraisalAgeMonths,
        publicGuaranteePct: deal.publicGuaranteePct,
        durationMonths: deal.durationMonths,
        undrawnAmount: deal.undrawnAmount,
        ccfType: deal.ccfType,
        utilizationRate: deal.utilizationRate,
        mode: deal.creditRiskMode,
        externalPd12m: deal.externalPd12m,
        externalLgd: deal.externalLgd,
        externalEad: deal.externalEad,
      });

      const predictedEL = creditResult.el12m;
      const coverage = creditResult.coveragePct;
      const dealId = deal.id ?? 'unknown';

      // Simulate actual loss: predictedEL * (0.5 + seededRandom)
      const actualLoss = predictedEL * (0.5 + seededRandom(dealId, 1));
      // Simulate default: random < coverage / 100
      const actualDefault = seededRandom(dealId, 2) < (coverage / 100);

      return {
        dealId,
        originationDate: deal.startDate,
        segment: creditResult.anejoSegment as BacktestRecord['segment'],
        predictedEL,
        actualLoss,
        predictedCoverage: coverage,
        actualDefault,
      };
    });
  }, [bookedDeals]);

  // Run backtesting engine
  const backtestResult = useMemo(() => backtestCreditRisk(backtestRecords), [backtestRecords]);

  // Scatter data for chart
  const scatterData = useMemo(
    () =>
      backtestRecords
        .filter(r => r.predictedEL > 0)
        .map(r => ({
          predictedEL: r.predictedEL,
          actualLoss: r.actualLoss,
          segment: r.segment,
          dealId: r.dealId,
        })),
    [backtestRecords],
  );

  // Axis domain for scatter
  const scatterDomain = useMemo(() => {
    if (scatterData.length === 0) return { min: 0, max: 1000 };
    const allValues = scatterData.flatMap(d => [d.predictedEL, d.actualLoss]);
    const max = Math.max(...allValues);
    return { min: 0, max: max * 1.15 };
  }, [scatterData]);

  // Sort segments by accuracy ratio (worst first)
  const sortedSegments = useMemo(() => {
    return Object.entries(backtestResult.bySegment)
      .map(([segment, data]) => ({ segment, ...data }))
      .sort((a, b) => {
        // worst = furthest from 1.0
        const distA = Math.abs(a.accuracyRatio - 1);
        const distB = Math.abs(b.accuracyRatio - 1);
        return distB - distA;
      });
  }, [backtestResult.bySegment]);

  // Empty state
  if (bookedDeals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldCheck className="w-12 h-12 text-[color:var(--nfq-text-faint)] mb-4" />
        <h3 className="text-sm font-bold text-[color:var(--nfq-text-secondary)] mb-2">{t.modelBacktest}</h3>
        <p className="text-xs text-[color:var(--nfq-text-muted)]">
          Book or approve deals to see model backtesting results.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-purple-400" />
        <h2 className="text-sm font-bold tracking-tight text-white uppercase font-mono">
          {t.modelBacktest}
        </h2>
        <span className="nfq-label ml-2">
          {backtestResult.totalDeals} {t.backtestDeals?.toLowerCase() ?? 'deals'}
        </span>
      </div>

      {/* 1. Overall Accuracy KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Deals Tested */}
        <div className="nfq-kpi-card">
          <div className="nfq-kpi-label">{t.backtestDeals}</div>
          <div className="text-2xl font-mono font-bold text-[color:var(--nfq-text-primary)] mt-1">
            {backtestResult.totalDeals}
          </div>
          <div className="text-[10px] font-mono text-[color:var(--nfq-text-muted)] mt-1">
            {backtestResult.defaultedDeals} defaults
          </div>
        </div>

        {/* Observed Default Rate */}
        <div className="nfq-kpi-card">
          <div className="nfq-kpi-label">{t.observedDefaultRate}</div>
          <div className="text-2xl font-mono font-bold text-[color:var(--nfq-text-primary)] mt-1">
            {(backtestResult.observedDefaultRate * 100).toFixed(2)}%
          </div>
          <div className="text-[10px] font-mono text-[color:var(--nfq-text-muted)] mt-1">
            {backtestResult.defaultedDeals} / {backtestResult.totalDeals}
          </div>
        </div>

        {/* Predicted Default Rate */}
        <div className="nfq-kpi-card">
          <div className="nfq-kpi-label">{t.predictedDefaultRate}</div>
          <div className="text-2xl font-mono font-bold text-[color:var(--nfq-text-primary)] mt-1">
            {(backtestResult.predictedDefaultRate * 100).toFixed(2)}%
          </div>
          <div className="text-[10px] font-mono text-[color:var(--nfq-text-muted)] mt-1">
            avg coverage proxy
          </div>
        </div>

        {/* EL Accuracy Ratio */}
        <div className={`nfq-kpi-card ${accuracyBgColor(backtestResult.elAccuracyRatio)}`}>
          <div className="nfq-kpi-label">{t.elAccuracyRatio}</div>
          <div className={`text-2xl font-mono font-bold mt-1 ${accuracyColor(backtestResult.elAccuracyRatio)}`}>
            {backtestResult.elAccuracyRatio.toFixed(3)}
          </div>
          <div className="text-[10px] font-mono text-[color:var(--nfq-text-muted)] mt-1">
            {backtestResult.elAccuracyRatio < 1 ? 'overprediction' : backtestResult.elAccuracyRatio > 1 ? 'underprediction' : 'perfect'}
          </div>
        </div>
      </div>

      {/* 2. By-Segment Table */}
      <div className="nfq-kpi-card overflow-x-auto">
        <h4 className="nfq-kpi-label mb-4">{t.backtestBySegment}</h4>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--nfq-border-ghost)]">
              {['Segment', '# Deals', '# Defaults', 'Observed Rate', 'Predicted Rate', 'Accuracy Ratio'].map(
                label => (
                  <th
                    key={label}
                    className="py-2 px-3 text-left font-mono uppercase tracking-[0.16em] text-[color:var(--nfq-text-muted)] whitespace-nowrap"
                  >
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {sortedSegments.map(seg => (
              <tr
                key={seg.segment}
                className={`border-b border-[var(--nfq-border-ghost)]/50 hover:bg-white/[0.02] transition-colors ${accuracyBgColor(seg.accuracyRatio)}`}
              >
                <td className="py-2.5 px-3 font-mono font-bold text-[color:var(--nfq-text-primary)]">
                  {seg.segment.replace(/_/g, ' ')}
                </td>
                <td className="py-2.5 px-3 font-mono text-right text-[color:var(--nfq-text-secondary)]">
                  {seg.deals}
                </td>
                <td className="py-2.5 px-3 font-mono text-right text-[color:var(--nfq-text-secondary)]">
                  {seg.defaults}
                </td>
                <td className="py-2.5 px-3 font-mono text-right text-[color:var(--nfq-text-secondary)]">
                  {(seg.observedRate * 100).toFixed(2)}%
                </td>
                <td className="py-2.5 px-3 font-mono text-right text-[color:var(--nfq-text-secondary)]">
                  {(seg.predictedRate * 100).toFixed(2)}%
                </td>
                <td className={`py-2.5 px-3 font-mono text-right font-bold ${accuracyColor(seg.accuracyRatio)}`}>
                  {seg.accuracyRatio.toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 3. Scatter Chart: Predicted EL vs Actual Loss */}
      <div className="rounded-2xl border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] p-4">
        <div className="nfq-label mb-3">Predicted EL vs Actual Loss (per deal)</div>
        <div className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--nfq-border-ghost)" />
              <XAxis
                type="number"
                dataKey="predictedEL"
                name="Predicted EL"
                domain={[scatterDomain.min, scatterDomain.max]}
                tick={{ fill: 'var(--nfq-text-muted)', fontSize: 10, fontFamily: 'var(--nfq-font-mono)' }}
                tickFormatter={(v: number) => formatCurrency(v)}
                label={{
                  value: 'Predicted EL',
                  position: 'insideBottom',
                  offset: -5,
                  fill: 'var(--nfq-text-muted)',
                  fontSize: 10,
                }}
              />
              <YAxis
                type="number"
                dataKey="actualLoss"
                name="Actual Loss"
                domain={[scatterDomain.min, scatterDomain.max]}
                tick={{ fill: 'var(--nfq-text-muted)', fontSize: 10, fontFamily: 'var(--nfq-font-mono)' }}
                tickFormatter={(v: number) => formatCurrency(v)}
                label={{
                  value: 'Actual Loss',
                  angle: -90,
                  position: 'insideLeft',
                  fill: 'var(--nfq-text-muted)',
                  fontSize: 10,
                }}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={tooltipStyle}
                content={({ payload }) => {
                  if (!payload || payload.length === 0) return null;
                  const d = payload[0]?.payload as (typeof scatterData)[number] | undefined;
                  if (!d) return null;
                  return (
                    <div style={tooltipStyle}>
                      <div className="font-semibold text-[color:var(--nfq-text-primary)] text-xs mb-1">
                        {d.dealId}
                      </div>
                      <div className="font-mono text-xs text-[color:var(--nfq-text-secondary)]">
                        Predicted: {formatCurrency(d.predictedEL)}
                      </div>
                      <div className="font-mono text-xs text-[color:var(--nfq-text-secondary)]">
                        Actual: {formatCurrency(d.actualLoss)}
                      </div>
                      <div className="text-xs text-[color:var(--nfq-text-muted)] mt-1">
                        {d.segment.replace(/_/g, ' ')}
                      </div>
                    </div>
                  );
                }}
              />
              {/* 45-degree reference line: perfect prediction */}
              <ReferenceLine
                segment={[
                  { x: scatterDomain.min, y: scatterDomain.min },
                  { x: scatterDomain.max, y: scatterDomain.max },
                ]}
                stroke="var(--nfq-text-muted)"
                strokeDasharray="6 4"
                strokeWidth={1}
              />
              <Scatter
                name="Deals"
                data={scatterData}
                fill="#9B59B6"
                fillOpacity={0.65}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-[color:var(--nfq-text-muted)] font-mono">
          <span>--- 45-degree = perfect prediction</span>
          <span>Above line = underprediction</span>
          <span>Below line = overprediction</span>
        </div>
      </div>

      {/* 4. Disclaimer note */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--nfq-bg-surface)] border border-[var(--nfq-border-ghost)]">
        <Info className="w-4 h-4 text-[color:var(--nfq-text-muted)] shrink-0 mt-0.5" />
        <p className="text-xs text-[color:var(--nfq-text-muted)] leading-relaxed">
          {t.backtestNote}
        </p>
      </div>
    </div>
  );
};

export default BacktestingDashboard;
