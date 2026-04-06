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
          <div className="relative flex-1 rounded-lg border border-slate-800 bg-slate-950 p-4">
            <div className="absolute -top-3 left-4 bg-slate-900 px-2 text-xs font-bold uppercase text-emerald-400">
              {entry.unit}
            </div>
            <div className="flex h-full text-xs font-mono">
              <div className="flex flex-1 flex-col border-r-2 border-slate-700 pr-4">
                <div className="mb-2 border-b border-slate-700 pb-1 text-center text-[10px] text-slate-500">
                  DEBIT
                </div>
                <div
                  className={`mb-2 rounded border p-2 ${
                    entry.type === 'LOAN'
                      ? 'border-emerald-900/50 bg-emerald-900/20 text-emerald-400'
                      : entry.type === 'DEPOSIT'
                        ? 'border-amber-900/50 bg-amber-900/20 text-amber-500'
                        : 'border-indigo-900/50 bg-indigo-900/20 text-indigo-400'
                  }`}
                >
                  <div className="font-bold">{labels.unitDebit}</div>
                  <div>{formatCurrencyAmount(entry.amount, entry.currency)}</div>
                </div>
              </div>
              <div className="flex flex-1 flex-col pl-4">
                <div className="mb-2 border-b border-slate-700 pb-1 text-center text-[10px] text-slate-500">
                  CREDIT
                </div>
                <div
                  className={`mb-2 rounded border p-2 ${
                    entry.type === 'LOAN'
                      ? 'border-amber-900/50 bg-amber-900/20 text-amber-500'
                      : entry.type === 'DEPOSIT'
                        ? 'border-rose-900/50 bg-rose-900/20 text-rose-400'
                        : 'border-cyan-900/50 bg-cyan-900/20 text-cyan-400'
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

      <Panel title="FTP Composition" className="bg-slate-900/50">
        <div className="flex h-full flex-col justify-center space-y-2 p-4">
          <div className="text-center">
            <div className="font-mono-nums text-2xl font-bold text-amber-500">
              {formatRate(entry.ftpRate)}
            </div>
            <div className="nfq-label">Transfer Rate</div>
          </div>
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-1 text-xs">
            <span className="text-slate-400">IRRBB Base</span>
            <span className="font-mono text-slate-200">{formatRate(entry.ftpComponents.baseRate)}</span>
          </div>
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-1 text-xs">
            <span className="text-slate-400">Liquidity</span>
            <span className="font-mono text-amber-500">
              {entry.ftpComponents.liquidityPrem >= 0 ? '+' : ''}
              {formatRate(entry.ftpComponents.liquidityPrem)}
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-1 text-xs">
            <span className="text-slate-400">Strategic</span>
            <span className="font-mono text-blue-400">
              {entry.ftpComponents.strategicAdj >= 0 ? '+' : ''}
              {formatRate(entry.ftpComponents.strategicAdj)}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-1 text-xs font-bold">
            <span className="text-slate-300">Net Margin</span>
            <span className={entry.margin >= 0 ? 'font-mono text-cyan-400' : 'font-mono text-red-400'}>
              {formatRate(entry.margin)}
            </span>
          </div>
        </div>
      </Panel>

      <Panel title={`Central Treasury (ALM) — ${entry.currency}`} className="border-l-4 border-l-cyan-500">
        <div className="flex h-full flex-col p-4">
          <div className="relative flex-1 rounded-lg border border-slate-800 bg-slate-950 p-4">
            <div className="absolute -top-3 left-4 bg-slate-900 px-2 text-xs font-bold text-cyan-400">
              ALM MIRROR
            </div>
            <div className="flex h-full text-xs font-mono">
              <div className="flex flex-1 flex-col border-r-2 border-slate-700 pr-4">
                <div className="mb-2 border-b border-slate-700 pb-1 text-center text-[10px] text-slate-500">
                  DEBIT
                </div>
                <div className="mb-2 rounded border border-amber-900/50 bg-amber-900/20 p-2 text-amber-500">
                  <div className="font-bold">{labels.treasuryDebit}</div>
                </div>
              </div>
              <div className="flex flex-1 flex-col pl-4">
                <div className="mb-2 border-b border-slate-700 pb-1 text-center text-[10px] text-slate-500">
                  CREDIT
                </div>
                <div className="mb-2 rounded border border-slate-600 bg-slate-800 p-2 text-slate-300">
                  <div className="font-bold">{labels.treasuryCredit}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-2 text-center text-[10px] text-slate-500">
            Treasury manages the net interest rate and liquidity risk.
          </div>
        </div>
      </Panel>
    </div>
  );
};
