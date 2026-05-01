import React from 'react';
import { CheckCircle, AlertTriangle, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import type { DisciplineKpis } from '../../types';

interface Props {
  kpis: DisciplineKpis;
  isLoading: boolean;
}

function fmtEur(value: number): string {
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function trendColor(value: number, invert = false): string {
  const positive = invert ? value < 0 : value > 0;
  if (Math.abs(value) < 0.5) return 'text-amber-400';
  return positive ? 'text-emerald-400' : 'text-rose-400';
}

const Skeleton: React.FC = () => (
  <div className="nfq-kpi-card animate-pulse">
    <div className="mb-2 h-3 w-20 rounded bg-[var(--nfq-bg-elevated)]" />
    <div className="h-8 w-28 rounded bg-[var(--nfq-bg-elevated)]" />
    <div className="mt-2 h-3 w-16 rounded bg-[var(--nfq-bg-elevated)]" />
  </div>
);

const DisciplineKpiCards: React.FC<Props> = ({ kpis, isLoading }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} />
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: 'In-Band Rate',
      value: fmtPct(kpis.inBandPct),
      icon: CheckCircle,
      tone: kpis.inBandPct >= 90 ? 'text-emerald-400' : kpis.inBandPct >= 75 ? 'text-amber-400' : 'text-rose-400',
      sub: `${kpis.inBandCount} / ${kpis.totalDeals} deals`,
    },
    {
      label: 'Total Leakage',
      value: `EUR ${fmtEur(kpis.totalLeakageEur)}`,
      icon: DollarSign,
      tone: kpis.totalLeakageEur <= 0 ? 'text-emerald-400' : 'text-rose-400',
      sub: 'margin leakage',
    },
    {
      label: 'Outlier Count',
      value: `${kpis.outOfBandCount}`,
      icon: AlertTriangle,
      tone: kpis.outOfBandCount === 0 ? 'text-emerald-400' : kpis.outOfBandCount <= 5 ? 'text-amber-400' : 'text-rose-400',
      sub: 'out of tolerance',
    },
    {
      label: 'Trend vs Prev Period',
      value: `${kpis.leakageTrend >= 0 ? '+' : ''}${fmtPct(kpis.leakageTrend)}`,
      icon: kpis.leakageTrend >= 0 ? TrendingUp : TrendingDown,
      tone: trendColor(kpis.leakageTrend, true),
      sub: 'leakage change',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="group relative overflow-hidden nfq-kpi-card">
            <div className="absolute right-0 top-0 p-3 opacity-10 transition-opacity group-hover:opacity-20">
              <Icon className={`${card.tone} h-6 w-6`} />
            </div>
            <div className="nfq-kpi-label mb-2">{card.label}</div>
            <div className={`nfq-kpi-value text-2xl ${card.tone}`}>{card.value}</div>
            <div className="mt-1 nfq-label">{card.sub}</div>
          </div>
        );
      })}
    </div>
  );
};

export default DisciplineKpiCards;
