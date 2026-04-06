import React from 'react';
import { Badge } from '../ui/LayoutComponents';
import type { LedgerEntry } from './accountingLedgerUtils';
import { formatCurrencyAmount, formatRate } from './accountingLedgerUtils';

interface Props {
  entries: LedgerEntry[];
  activeEntryId?: string;
  onSelectEntry: (entryId: string) => void;
}

function getBadgeVariant(type: LedgerEntry['type']) {
  if (type === 'LOAN') return 'success';
  if (type === 'DEPOSIT') return 'warning';
  return 'secondary';
}

export const AccountingLedgerTable: React.FC<Props> = ({
  entries,
  activeEntryId,
  onSelectEntry,
}) => {
  return (
    <div className="flex h-full flex-col overflow-auto">
      <table className="w-full text-left">
        <thead className="sticky top-0 z-10 bg-[var(--nfq-bg-surface)]">
          <tr>
            <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Date</th>
            <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Deal ID</th>
            <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Unit</th>
            <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Type / Product</th>
            <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 text-right font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Amount</th>
            <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 text-right font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Client Rate</th>
            <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 text-right font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[var(--nfq-warning)]">
              FTP Rate
            </th>
            <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 text-right font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[var(--nfq-accent)]">NIM</th>
          </tr>
        </thead>
        <tbody className="text-xs font-mono">
          {entries.map((entry) => (
            <tr
              key={`${entry.id}-${entry.currency}`}
              onClick={() => onSelectEntry(entry.id)}
              className={`cursor-pointer transition-colors even:bg-[var(--nfq-bg-surface)] odd:bg-[var(--nfq-bg-root)] ${
                activeEntryId === entry.id ? 'bg-[var(--nfq-accent-subtle)]' : 'hover:bg-[var(--nfq-bg-elevated)]'
              }`}
            >
              <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-[color:var(--nfq-text-muted)] [font-variant-numeric:tabular-nums]">{entry.timestamp}</td>
              <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 font-bold text-[var(--nfq-accent)] [font-variant-numeric:tabular-nums]">{entry.id}</td>
              <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2">
                <span className="rounded bg-[var(--nfq-bg-elevated)] px-1.5 py-0.5 text-[10px] text-[color:var(--nfq-text-tertiary)]">
                  {entry.unit}
                </span>
              </td>
              <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2">
                <div className="flex items-center gap-2">
                  <Badge variant={getBadgeVariant(entry.type)}>{entry.type}</Badge>
                  <span className="max-w-[150px] truncate font-sans text-[color:var(--nfq-text-tertiary)]">
                    {entry.product}
                  </span>
                </div>
              </td>
              <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right text-[color:var(--nfq-text-secondary)] [font-variant-numeric:tabular-nums]">
                {formatCurrencyAmount(entry.amount, entry.currency)}
              </td>
              <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right text-[color:var(--nfq-text-secondary)] [font-variant-numeric:tabular-nums]">
                {formatRate(entry.clientRate)}
              </td>
              <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-bold text-[var(--nfq-warning)] [font-variant-numeric:tabular-nums]">
                {formatRate(entry.ftpRate)}
              </td>
              <td
                className={`border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-bold [font-variant-numeric:tabular-nums] ${
                  entry.margin >= 0 ? 'text-[var(--nfq-accent)]' : 'text-[var(--nfq-danger)]'
                }`}
              >
                {formatRate(entry.margin)}
              </td>
            </tr>
          ))}

          {entries.length === 0 && (
            <tr>
              <td colSpan={8} className="p-8 text-center text-[color:var(--nfq-text-muted)]">
                No booked deals found. Book deals in the Blotter to see GL entries here.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
