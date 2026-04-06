import React from 'react';
import type { RarocMetricCardData } from './rarocCalculatorUtils';

const toneClasses: Record<RarocMetricCardData['tone'], string> = {
  cyan: 'text-cyan-400',
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  violet: 'text-violet-400',
};

export const RAROCMetricCard: React.FC<RarocMetricCardData> = React.memo(({
  title,
  value,
  subtext,
  trend,
  tone,
  icon: Icon,
}) => {
  const statusClass =
    trend === 'positive'
      ? 'text-emerald-500'
      : trend === 'negative'
        ? 'text-rose-500'
        : 'text-[color:var(--nfq-text-muted)]';

  return (
    <div className="group relative overflow-hidden nfq-kpi-card">
      <div className="absolute right-0 top-0 p-3 opacity-10 transition-opacity group-hover:opacity-20">
        <Icon className={`${toneClasses[tone]} h-6 w-6`} />
      </div>
      <div className="nfq-kpi-label mb-2">{title}</div>
      <div className="flex items-baseline gap-2">
        <div className={`nfq-kpi-value text-3xl ${toneClasses[tone]}`}>{value}</div>
        {trend !== 'neutral' && (
          <div className={`text-[10px] font-mono font-bold uppercase tracking-[0.18em] ${statusClass}`}>
            {trend === 'positive' ? 'Pass' : 'Fail'}
          </div>
        )}
      </div>
      <div className="mt-1 nfq-label italic">
        {subtext}
      </div>
    </div>
  );
});
