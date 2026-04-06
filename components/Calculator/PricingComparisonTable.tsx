import React from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { FTPResult } from '../../types';
import {
  COMPARISON_METRIC_ROWS,
  formatMetricDelta,
  formatMetricValue,
  getMetricDeltaState,
  getMetricValue,
  type MetricRow,
  type PricingScenario,
} from './pricingComparisonUtils';
import { useUI } from '../../contexts/UIContext';

interface Props {
  scenarios: PricingScenario[];
  results: FTPResult[];
  deltaLabel: string;
}

function getDeltaClassName(
  row: MetricRow,
  value: number | string,
  baseValue: number | string,
): string {
  const state = getMetricDeltaState(row, value, baseValue);

  if (state === 'positive') return 'text-emerald-400';
  if (state === 'negative') return 'text-red-400';
  return 'text-slate-400';
}

function renderDeltaIcon(
  row: MetricRow,
  value: number | string,
  baseValue: number | string,
) {
  const state = getMetricDeltaState(row, value, baseValue);

  if (state === 'neutral') {
    return <Minus size={12} className="text-slate-500" />;
  }

  if (typeof value !== 'number' || typeof baseValue !== 'number') {
    return <Minus size={12} />;
  }

  return value - baseValue > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />;
}

export const PricingComparisonTable: React.FC<Props> = React.memo(({
  scenarios,
  results,
  deltaLabel,
}) => {
  const { t } = useUI();
  const baseResult = results[0];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="w-40 border-b border-[color:var(--nfq-border)] px-4 py-2 text-left font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">
              {t.metric}
            </th>
            {scenarios.map((scenario, index) => (
              <th
                key={scenario.id}
                className={`border-b border-[color:var(--nfq-border)] px-4 py-2 text-right font-mono text-[12px] font-medium uppercase tracking-[0.1em] ${
                  index === 0 ? 'text-[var(--nfq-accent)]' : 'text-[color:var(--nfq-text-muted)]'
                }`}
              >
                {scenario.name}
                {index > 0 && (
                  <div className="mt-0.5 text-[9px] font-normal normal-case text-[color:var(--nfq-text-muted)]">
                    {deltaLabel}
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON_METRIC_ROWS.map((row) => {
            const baseValue = getMetricValue(baseResult, row.key);

            return (
              <tr key={row.key} className="transition-colors even:bg-[var(--nfq-bg-surface)] odd:bg-[var(--nfq-bg-root)] hover:bg-[var(--nfq-bg-elevated)]">
                <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 font-medium text-[color:var(--nfq-text-secondary)]">{row.label}</td>
                {results.map((result, index) => {
                  const value = getMetricValue(result, row.key);
                  const isBaseScenario = index === 0;

                  return (
                    <td key={scenarios[index].id} className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono [font-variant-numeric:tabular-nums]">
                      <div className="text-[color:var(--nfq-text-secondary)]">{formatMetricValue(value, row.format)}</div>
                      {!isBaseScenario && (
                        <div
                          className={`mt-0.5 flex items-center justify-end gap-1 ${getDeltaClassName(row, value, baseValue)}`}
                        >
                          {renderDeltaIcon(row, value, baseValue)}
                          <span className="text-[10px]">
                            {formatMetricDelta(value, baseValue, row.format)}
                          </span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});
