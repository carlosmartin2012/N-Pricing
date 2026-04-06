import React from 'react';
import type { ReactNode } from 'react';
import { Panel } from '../ui/LayoutComponents';
import type { RarocBreakdownRow } from './rarocCalculatorUtils';

interface Props {
  title: string;
  icon: ReactNode;
  rows: RarocBreakdownRow[];
  totalLabel: string;
  totalValue: string;
  totalToneClass: string;
}

export const RAROCBreakdownPanel: React.FC<Props> = ({
  title,
  icon,
  rows,
  totalLabel,
  totalValue,
  totalToneClass,
}) => {
  return (
    <Panel title={title} icon={icon}>
      <div className="space-y-4 p-4">
        {rows.map((row) => {
          const toneClass =
            row.tone === 'positive'
              ? 'text-emerald-400'
              : row.tone === 'negative'
                ? 'text-rose-400'
                : 'text-[color:var(--nfq-text-secondary)]';

          return (
            <div key={`${title}-${row.label}`} className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold uppercase text-[color:var(--nfq-text-secondary)]">
                  {row.label}
                </div>
                <div className="text-[9px] italic text-[color:var(--nfq-text-muted)]">
                  {row.subtext}
                </div>
              </div>
              <div className={`text-sm font-mono font-bold ${toneClass}`}>{row.value}</div>
            </div>
          );
        })}

        <div className="flex items-center justify-between border-t border-white/5 pt-3">
          <span className="text-xs font-bold uppercase text-[color:var(--nfq-text-primary)]">
            {totalLabel}
          </span>
          <span className={`text-lg font-mono font-bold ${totalToneClass}`}>{totalValue}</span>
        </div>
      </div>
    </Panel>
  );
};
