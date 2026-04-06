import React from 'react';
import { Badge, Panel } from '../ui/LayoutComponents';
import { TrendingDown, TrendingUp } from 'lucide-react';
import type { CurveDisplayPoint, CurveSnapshotVersion } from './yieldCurveUtils';

interface Props {
  currency: string;
  data: CurveDisplayPoint[];
  versions: CurveSnapshotVersion[];
}

const YieldCurveRatesPanel: React.FC<Props> = ({
  currency,
  data,
  versions,
}) => (
  <Panel title="Market Rates Breakdown" className="flex flex-1 flex-col overflow-hidden">
    <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950">
      <span className="text-[10px] font-bold uppercase text-slate-500">Tenor Spot Rates</span>
      <Badge variant="outline" className="text-[9px]">
        {currency}
      </Badge>
    </div>
    <div className="custom-scrollbar flex-1 overflow-auto">
      <table className="w-full text-left">
        <thead className="sticky top-0 z-10 bg-[var(--nfq-bg-surface)]">
          <tr>
            <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Term</th>
            <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 text-right font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Yield</th>
            <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 text-right font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Chg</th>
          </tr>
        </thead>
        <tbody className="font-mono text-xs">
          {data.map(point => {
            const previousRate = point.prev ?? point.rate;
            const change = point.rate - previousRate;
            const isPositive = change >= 0;

            return (
              <tr key={point.tenor} className="transition-colors even:bg-[var(--nfq-bg-surface)] odd:bg-[var(--nfq-bg-root)] hover:bg-[var(--nfq-bg-elevated)]">
                <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 font-bold text-[color:var(--nfq-text-secondary)]">{point.tenor}</td>
                <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-bold text-[var(--nfq-accent)] [font-variant-numeric:tabular-nums]">{point.rate.toFixed(3)}%</td>
                <td className={`border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right [font-variant-numeric:tabular-nums] ${isPositive ? 'text-[var(--nfq-success)]' : 'text-[var(--nfq-danger)]'}`}>
                  <span className="flex items-center justify-end gap-1">
                    {Math.abs(change * 100).toFixed(1)}
                    {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    <div className="mt-auto border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 text-[9px] font-bold uppercase text-slate-400">Version Audit Trail</div>
      <div className="space-y-2">
        {versions.slice(0, 3).map(version => (
          <div key={version.id} className="flex items-center justify-between text-[10px]">
            <span className="text-slate-600 dark:text-slate-400">{version.date}</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">{version.id}</span>
          </div>
        ))}
      </div>
    </div>
  </Panel>
);

export default YieldCurveRatesPanel;
