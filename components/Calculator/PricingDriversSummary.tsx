import React, { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, GitCompareArrows } from 'lucide-react';
import type { FTPResult } from '../../types';

interface Props {
  result: FTPResult;
  labels: {
    title: string;
    subtitle: string;
    baseRate: string;
    liquidity: string;
    capital: string;
    credit: string;
    operational: string;
    esg: string;
  };
}

export const PricingDriversSummary: React.FC<Props> = ({ result, labels }) => {
  const drivers = useMemo(() => [
    { label: labels.baseRate, value: result.baseRate, tone: 'text-[color:var(--nfq-text-secondary)]' },
    { label: labels.liquidity, value: result.liquiditySpread, tone: 'text-[color:var(--nfq-warning)]' },
    { label: labels.credit, value: result.regulatoryCost, tone: 'text-[color:var(--nfq-danger)]' },
    { label: labels.capital, value: result.capitalCharge, tone: 'text-[color:var(--nfq-accent)]' },
    { label: labels.operational, value: result.operationalCost, tone: 'text-violet-300' },
    {
      label: labels.esg,
      value: (result.esgTransitionCharge ?? 0) + (result.esgPhysicalCharge ?? 0) + (result.esgGreeniumAdj ?? 0),
      tone: 'text-[color:var(--nfq-success)]',
    },
  ]
    .filter((driver) => Number.isFinite(driver.value))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 5), [labels, result]);

  return (
    <div data-testid="pricing-drivers-summary" className="rounded-lg bg-[var(--nfq-bg-surface)] p-4 shadow-[var(--nfq-shadow-soft)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="nfq-eyebrow">{labels.title}</div>
          <div className="mt-1 text-sm text-[color:var(--nfq-text-secondary)]">{labels.subtitle}</div>
        </div>
        <GitCompareArrows className="text-[color:var(--nfq-accent)]" size={18} />
      </div>
      <div className="grid gap-2 md:grid-cols-5">
        {drivers.map((driver) => {
          const Icon = driver.value >= 0 ? ArrowUpRight : ArrowDownRight;
          return (
            <div key={driver.label} className="rounded-lg border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="truncate text-xs font-medium text-[color:var(--nfq-text-secondary)]">{driver.label}</div>
                <Icon size={13} className={driver.tone} />
              </div>
              <div className={`font-mono-nums mt-2 text-lg font-semibold ${driver.tone}`}>
                {driver.value >= 0 ? '+' : ''}
                {driver.value.toFixed(3)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
