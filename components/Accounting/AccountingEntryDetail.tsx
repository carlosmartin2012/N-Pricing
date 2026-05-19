import React from 'react';
import { Panel } from '../ui/LayoutComponents';
import type { LedgerEntry } from './accountingLedgerUtils';
import { formatCurrencyAmount, formatRate } from './accountingLedgerUtils';

interface Props {
  entry: LedgerEntry;
}

function getEntryLabels(type: LedgerEntry['type']) {
  if (type === 'DEPOSIT') {
    return {
      unitDebit: 'FTP TO ALM',
      unitCredit: 'CLIENT DEPOSIT',
      treasuryDebit: 'RECEIVE DEPOSIT',
      treasuryCredit: 'INVEST / LEND',
    };
  }

  if (type === 'COMMITMENT') {
    return {
      unitDebit: 'COMMITMENT USAGE',
      unitCredit: 'FTP FACILITY',
      treasuryDebit: 'HOLD LIQUIDITY BUFFER',
      treasuryCredit: 'CONTINGENT FUNDING',
    };
  }

  return {
    unitDebit: 'CLIENT LOAN',
    unitCredit: 'FTP FUNDING',
    treasuryDebit: 'FUND BU LOAN',
    treasuryCredit: 'WHOLESALE / MARKET',
  };
}

export const AccountingEntryDetail: React.FC<Props> = ({ entry }) => {
  const labels = getEntryLabels(entry.type);

  return (
    <div className="grid min-h-64 grid-cols-1 gap-4 lg:grid-cols-3">
      <Panel title={`${entry.unit} Ledger`} className="border-l-4 border-l-emerald-500">
        <div className="flex h-full flex-col p-4">
          <div className="relative flex-1 rounded-lg border border-slate-800 bg-[var(--nfq-bg-root)] p-4">
            <div className="absolute -top-3 left-4 bg-[var(--nfq-bg-elevated)] px-2 text-xs font-bold uppercase text-[color:var(--nfq-success)]">
              {entry.unit}
            </div>
            <div className="flex h-full text-xs font-mono">
              <div className="flex flex-1 flex-col border-r-2 border-slate-700 pr-4">
                <div className="mb-2 border-b border-slate-700 pb-1 text-center text-[10px] text-[color:var(--nfq-text-faint)]">
                  DEBIT
                </div>
                <div
                  className={`mb-2 rounded border p-2 ${
                    entry.type === 'LOAN'
                      ? 'border-[color:var(--nfq-success)]/50 bg-[var(--nfq-success)]/20 text-[color:var(--nfq-success)]'
                      : entry.type === 'DEPOSIT'
                        ? 'border-[color:var(--nfq-warning)]/50 bg-[var(--nfq-warning)]/20 text-[color:var(--nfq-warning)]'
                        : 'border-[color:var(--nfq-cat-d)]/50 bg-[var(--nfq-cat-d)]/20 text-[color:var(--nfq-cat-d)]'
                  }`}
                >
                  <div className="font-bold">{labels.unitDebit}</div>
                  <div>{formatCurrencyAmount(entry.amount, entry.currency)}</div>
                </div>
              </div>
              <div className="flex flex-1 flex-col pl-4">
                <div className="mb-2 border-b border-slate-700 pb-1 text-center text-[10px] text-[color:var(--nfq-text-faint)]">
                  CREDIT
                </div>
                <div
                  className={`mb-2 rounded border p-2 ${
                    entry.type === 'LOAN'
                      ? 'border-[color:var(--nfq-warning)]/50 bg-[var(--nfq-warning)]/20 text-[color:var(--nfq-warning)]'
                      : entry.type === 'DEPOSIT'
                        ? 'border-[color:var(--nfq-danger)]/50 bg-[var(--nfq-danger)]/20 text-[color:var(--nfq-danger)]'
                        : 'border-[color:var(--nfq-accent)]/20 bg-[var(--nfq-accent)]/20 text-[color:var(--nfq-accent)]'
                  }`}
                >
                  <div className="font-bold">{labels.unitCredit}</div>
                  <div>{formatCurrencyAmount(entry.amount, entry.currency)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="FTP Composition" className="bg-[var(--nfq-bg-elevated)]/50">
        <div className="flex h-full flex-col justify-center space-y-2 p-4">
          <div className="text-center">
            <div className="font-mono-nums text-2xl font-bold text-[color:var(--nfq-warning)]">
              {formatRate(entry.ftpRate)}
            </div>
            <div className="nfq-label">Transfer Rate</div>
          </div>
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-1 text-xs">
            <span className="text-[color:var(--nfq-text-muted)]">IRRBB Base</span>
            <span className="font-mono text-[color:var(--nfq-text-secondary)]">{formatRate(entry.ftpComponents.baseRate)}</span>
          </div>
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-1 text-xs">
            <span className="text-[color:var(--nfq-text-muted)]">Liquidity</span>
            <span className="font-mono text-[color:var(--nfq-warning)]">
              {entry.ftpComponents.liquidityPrem >= 0 ? '+' : ''}
              {formatRate(entry.ftpComponents.liquidityPrem)}
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-1 text-xs">
            <span className="text-[color:var(--nfq-text-muted)]">Strategic</span>
            <span className="font-mono text-[color:var(--nfq-info)]">
              {entry.ftpComponents.strategicAdj >= 0 ? '+' : ''}
              {formatRate(entry.ftpComponents.strategicAdj)}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-1 text-xs font-bold">
            <span className="text-[color:var(--nfq-text-secondary)]">Net Margin</span>
            <span className={entry.margin >= 0 ? 'font-mono text-[color:var(--nfq-accent)]' : 'font-mono text-[color:var(--nfq-danger)]'}>
              {formatRate(entry.margin)}
            </span>
          </div>
        </div>
      </Panel>

      <Panel title={`Central Treasury (ALM) — ${entry.currency}`} className="border-l-4 border-l-[color:var(--nfq-accent)]">
        <div className="flex h-full flex-col p-4">
          <div className="relative flex-1 rounded-lg border border-slate-800 bg-[var(--nfq-bg-root)] p-4">
            <div className="absolute -top-3 left-4 bg-[var(--nfq-bg-elevated)] px-2 text-xs font-bold text-[color:var(--nfq-accent)]">
              ALM MIRROR
            </div>
            <div className="flex h-full text-xs font-mono">
              <div className="flex flex-1 flex-col border-r-2 border-slate-700 pr-4">
                <div className="mb-2 border-b border-slate-700 pb-1 text-center text-[10px] text-[color:var(--nfq-text-faint)]">
                  DEBIT
                </div>
                <div className="mb-2 rounded border border-[color:var(--nfq-warning)]/50 bg-[var(--nfq-warning)]/20 p-2 text-[color:var(--nfq-warning)]">
                  <div className="font-bold">{labels.treasuryDebit}</div>
                </div>
              </div>
              <div className="flex flex-1 flex-col pl-4">
                <div className="mb-2 border-b border-slate-700 pb-1 text-center text-[10px] text-[color:var(--nfq-text-faint)]">
                  CREDIT
                </div>
                <div className="mb-2 rounded border border-slate-600 bg-[var(--nfq-bg-highest)] p-2 text-[color:var(--nfq-text-secondary)]">
                  <div className="font-bold">{labels.treasuryCredit}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-2 text-center text-[10px] text-[color:var(--nfq-text-faint)]">
            Treasury manages the net interest rate and liquidity risk.
          </div>
        </div>
      </Panel>
    </div>
  );
};
