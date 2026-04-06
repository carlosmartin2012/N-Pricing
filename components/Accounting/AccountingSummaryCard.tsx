import React from 'react';
import type { CurrencyAmount } from './accountingLedgerUtils';
import { formatCurrencyAmount } from './accountingLedgerUtils';

interface Props {
  title: string;
  emptyLabel: string;
  breakdown: CurrencyAmount[];
  accentClassName: string;
}

export const AccountingSummaryCard: React.FC<Props> = React.memo(({
  title,
  emptyLabel,
  breakdown,
  accentClassName,
}) => {
  const primaryAmount = breakdown[0];
  const hasMultipleCurrencies = breakdown.length > 1;

  return (
    <div className="flex flex-col justify-center px-4">
      <div className="nfq-label mb-1">{title}</div>
      {primaryAmount ? (
        <>
          <div className={`font-mono-nums text-xl font-bold ${accentClassName}`}>
            {formatCurrencyAmount(primaryAmount.amount, primaryAmount.currency)}
          </div>
          <div className="mt-1 space-y-1 text-[10px] font-mono text-slate-500">
            <div>{primaryAmount.currency}</div>
            {hasMultipleCurrencies &&
              breakdown.slice(1, 3).map((entry) => (
                <div key={entry.currency}>
                  {entry.currency}: {formatCurrencyAmount(entry.amount, entry.currency)}
                </div>
              ))}
            {breakdown.length > 3 && <div>+{breakdown.length - 3} more currencies</div>}
          </div>
        </>
      ) : (
        <div className="text-sm text-slate-500">{emptyLabel}</div>
      )}
    </div>
  );
});
