import React, { useState, useMemo } from 'react';
import { Panel, Badge, SelectInput } from '../ui/LayoutComponents';
import { Building2 } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { calculatePricing } from '../../utils/pricingEngine';
import { Transaction } from '../../types';

interface LedgerEntry {
  id: string;
  timestamp: string;
  unit: string;
  type: 'LOAN' | 'DEPOSIT';
  product: string;
  amount: number;
  clientRate: number;
  ftpRate: number;
  margin: number;
  currency: string;
  status: 'POSTED' | 'PENDING';
  ftpComponents: {
    baseRate: number;
    liquidityPrem: number;
    strategicAdj: number;
  };
}

const AccountingLedger: React.FC = () => {
  const data = useData();
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [selectedEntry, setSelectedEntry] = useState<LedgerEntry | null>(null);

  // Build pricing context from data
  const pricingContext = useMemo(() => ({
    yieldCurve: data.yieldCurves,
    liquidityCurves: data.liquidityCurves,
    rules: data.rules,
    rateCards: data.ftpRateCards,
    transitionGrid: data.transitionGrid,
    physicalGrid: data.physicalGrid,
    behaviouralModels: data.behaviouralModels,
    clients: data.clients,
    products: data.products,
    businessUnits: data.businessUnits,
  }), [data]);

  // Generate ledger from booked/approved deals with real FTP calculations
  const ledgerEntries: LedgerEntry[] = useMemo(() => {
    const bookedDeals = data.deals.filter(d =>
      d.status === 'Booked' || d.status === 'Approved' || d.status === 'Pending_Approval'
    );

    return bookedDeals.map(deal => {
      const result = calculatePricing(deal, data.approvalMatrix, pricingContext);
      const buName = data.businessUnits.find(b => b.id === deal.businessUnit)?.name || deal.businessUnit;

      return {
        id: deal.id || 'N/A',
        timestamp: deal.startDate || new Date().toISOString().split('T')[0],
        unit: buName,
        type: deal.category === 'Liability' ? 'DEPOSIT' as const : 'LOAN' as const,
        product: data.products.find(p => p.id === deal.productType)?.name || deal.productType,
        amount: deal.amount || 0,
        clientRate: result.finalClientRate,
        ftpRate: result.totalFTP,
        margin: result.finalClientRate - result.totalFTP,
        currency: deal.currency || 'USD',
        status: deal.status === 'Booked' ? 'POSTED' as const : 'PENDING' as const,
        ftpComponents: {
          baseRate: result.baseRate,
          liquidityPrem: result.liquiditySpread,
          strategicAdj: result.strategicSpread,
        },
      };
    });
  }, [data.deals, data.approvalMatrix, pricingContext, data.businessUnits, data.products]);

  // Get unique BU names for filter
  const buNames = useMemo(() => {
    const names = new Set(ledgerEntries.map(e => e.unit));
    return Array.from(names).sort();
  }, [ledgerEntries]);

  const filteredLedger = useMemo(() => {
    return selectedUnit === 'ALL'
      ? ledgerEntries
      : ledgerEntries.filter(e => e.unit === selectedUnit);
  }, [selectedUnit, ledgerEntries]);

  const balanceSummary = useMemo(() => {
    let assets = 0;
    let liabilities = 0;
    let totalFTPIncome = 0;
    filteredLedger.forEach(e => {
      if (e.type === 'LOAN') {
        assets += e.amount;
        totalFTPIncome += e.amount * (e.margin / 100);
      } else {
        liabilities += e.amount;
        totalFTPIncome += e.amount * (e.margin / 100);
      }
    });
    return { assets, liabilities, net: assets - liabilities, totalFTPIncome };
  }, [filteredLedger]);

  const activeEntry = selectedEntry || filteredLedger[0];

  const fmtCurrency = (val: number, ccy: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: ccy, maximumFractionDigits: 0 }).format(val);

  const fmtRate = (val: number) => val.toFixed(2) + '%';

  return (
    <div className="flex flex-col h-full gap-4">

      {/* Header */}
      <div className="flex flex-col md:flex-row gap-4 h-32 md:h-24">
        <div className="w-full md:w-1/4 bg-slate-900 border border-slate-800 p-4 rounded shadow flex flex-col justify-center">
          <div className="text-[10px] uppercase font-bold text-slate-500 mb-2 flex items-center gap-2">
            <Building2 size={12} /> Business Unit View
          </div>
          <SelectInput
            value={selectedUnit}
            onChange={(e) => { setSelectedUnit(e.target.value); setSelectedEntry(null); }}
            className="w-full"
          >
            <option value="ALL">Global Consolidated</option>
            {buNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </SelectInput>
        </div>

        <div className="w-full md:w-3/4 bg-slate-900 border border-slate-800 p-4 rounded shadow grid grid-cols-4 divide-x divide-slate-800">
          <div className="px-4 flex flex-col justify-center">
            <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Assets (Loans)</div>
            <div className="text-xl font-mono text-emerald-400 font-bold">{fmtCurrency(balanceSummary.assets, 'USD')}</div>
          </div>
          <div className="px-4 flex flex-col justify-center">
            <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Liabilities (Deposits)</div>
            <div className="text-xl font-mono text-rose-400 font-bold">{fmtCurrency(balanceSummary.liabilities, 'USD')}</div>
          </div>
          <div className="px-4 flex flex-col justify-center">
            <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Net Position</div>
            <div className={`text-xl font-mono font-bold ${balanceSummary.net > 0 ? 'text-cyan-400' : 'text-amber-400'}`}>
              {balanceSummary.net > 0 ? 'Long' : 'Short'} {fmtCurrency(Math.abs(balanceSummary.net), 'USD')}
            </div>
          </div>
          <div className="px-4 flex flex-col justify-center">
            <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Ann. FTP Income</div>
            <div className="text-xl font-mono text-cyan-400 font-bold">{fmtCurrency(balanceSummary.totalFTPIncome, 'USD')}</div>
          </div>
        </div>
      </div>

      {/* General Journal */}
      <Panel title={`FTP Ledger — ${selectedUnit === 'ALL' ? 'Consolidated' : selectedUnit}`} className="flex-1 min-h-[250px]">
        <div className="h-full overflow-auto flex flex-col">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-950 sticky top-0 z-10 text-[10px] uppercase font-bold text-slate-500">
              <tr>
                <th className="p-3 border-b border-r border-slate-800">Date</th>
                <th className="p-3 border-b border-r border-slate-800">Deal ID</th>
                <th className="p-3 border-b border-r border-slate-800">Unit</th>
                <th className="p-3 border-b border-r border-slate-800">Type / Product</th>
                <th className="p-3 border-b border-r border-slate-800 text-right">Amount</th>
                <th className="p-3 border-b border-r border-slate-800 text-right">Client Rate</th>
                <th className="p-3 border-b border-r border-slate-800 text-right text-amber-500">FTP Rate</th>
                <th className="p-3 border-b border-slate-800 text-right text-cyan-400">NIM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-xs font-mono">
              {filteredLedger.map((entry) => (
                <tr
                  key={entry.id}
                  onClick={() => setSelectedEntry(entry)}
                  className={`cursor-pointer transition-colors ${activeEntry?.id === entry.id ? 'bg-cyan-900/20' : 'hover:bg-slate-800/30'}`}
                >
                  <td className="p-3 border-r border-slate-800/50 text-slate-500">{entry.timestamp}</td>
                  <td className="p-3 border-r border-slate-800/50 text-cyan-400 font-bold">{entry.id}</td>
                  <td className="p-3 border-r border-slate-800/50">
                    <span className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[10px]">{entry.unit}</span>
                  </td>
                  <td className="p-3 border-r border-slate-800/50">
                    <div className="flex items-center gap-2">
                      <Badge variant={entry.type === 'LOAN' ? 'success' : 'warning'}>{entry.type}</Badge>
                      <span className="font-sans text-slate-400 truncate max-w-[150px]">{entry.product}</span>
                    </div>
                  </td>
                  <td className="p-3 border-r border-slate-800/50 text-right text-slate-200">{fmtCurrency(entry.amount, entry.currency)}</td>
                  <td className="p-3 border-r border-slate-800/50 text-right text-slate-300">{fmtRate(entry.clientRate)}</td>
                  <td className="p-3 border-r border-slate-800/50 text-right text-amber-500 font-bold">{fmtRate(entry.ftpRate)}</td>
                  <td className={`p-3 text-right font-bold ${entry.margin >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>{fmtRate(entry.margin)}</td>
                </tr>
              ))}
              {filteredLedger.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No booked deals found. Book deals in the Blotter to see GL entries here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* T-Account Visualizer */}
      {activeEntry && (
        <div className="h-64 grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* BU T-Account */}
          <Panel title={`${activeEntry.unit} Ledger`} className="border-l-4 border-l-emerald-500">
            <div className="p-4 flex flex-col h-full">
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg flex-1 relative">
                <div className="absolute -top-3 left-4 bg-slate-900 px-2 text-xs font-bold text-emerald-400 uppercase">{activeEntry.unit}</div>
                <div className="flex h-full text-xs font-mono">
                  <div className="flex-1 border-r-2 border-slate-700 pr-4 flex flex-col">
                    <div className="text-[10px] text-slate-500 text-center border-b border-slate-700 pb-1 mb-2">DEBIT</div>
                    <div className={`p-2 rounded border mb-2 ${activeEntry.type === 'LOAN' ? 'bg-emerald-900/20 text-emerald-400 border-emerald-900/50' : 'bg-amber-900/20 text-amber-500 border-amber-900/50'}`}>
                      <div className="font-bold">{activeEntry.type === 'LOAN' ? 'CLIENT LOAN' : 'FTP TO ALM'}</div>
                      <div>{fmtCurrency(activeEntry.amount, activeEntry.currency)}</div>
                    </div>
                  </div>
                  <div className="flex-1 pl-4 flex flex-col">
                    <div className="text-[10px] text-slate-500 text-center border-b border-slate-700 pb-1 mb-2">CREDIT</div>
                    <div className={`p-2 rounded border mb-2 ${activeEntry.type === 'LOAN' ? 'bg-amber-900/20 text-amber-500 border-amber-900/50' : 'bg-rose-900/20 text-rose-400 border-rose-900/50'}`}>
                      <div className="font-bold">{activeEntry.type === 'LOAN' ? 'FTP FUNDING' : 'CLIENT DEPOSIT'}</div>
                      <div>{fmtCurrency(activeEntry.amount, activeEntry.currency)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          {/* FTP Breakdown */}
          <Panel title="FTP Composition" className="bg-slate-900/50">
            <div className="p-4 flex flex-col justify-center h-full space-y-2">
              <div className="text-center">
                <div className="text-2xl font-mono font-bold text-amber-500">{fmtRate(activeEntry.ftpRate)}</div>
                <div className="text-[10px] text-slate-500 uppercase">Transfer Rate</div>
              </div>
              <div className="flex items-center justify-between text-xs px-4 py-1 border-b border-slate-800">
                <span className="text-slate-400">IRRBB Base</span>
                <span className="font-mono text-slate-200">{fmtRate(activeEntry.ftpComponents.baseRate)}</span>
              </div>
              <div className="flex items-center justify-between text-xs px-4 py-1 border-b border-slate-800">
                <span className="text-slate-400">Liquidity</span>
                <span className="font-mono text-amber-500">{activeEntry.ftpComponents.liquidityPrem >= 0 ? '+' : ''}{fmtRate(activeEntry.ftpComponents.liquidityPrem)}</span>
              </div>
              <div className="flex items-center justify-between text-xs px-4 py-1 border-b border-slate-800">
                <span className="text-slate-400">Strategic</span>
                <span className="font-mono text-blue-400">{activeEntry.ftpComponents.strategicAdj >= 0 ? '+' : ''}{fmtRate(activeEntry.ftpComponents.strategicAdj)}</span>
              </div>
              <div className="flex items-center justify-between text-xs px-4 py-1 font-bold">
                <span className="text-slate-300">Net Margin</span>
                <span className={`font-mono ${activeEntry.margin >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>{fmtRate(activeEntry.margin)}</span>
              </div>
            </div>
          </Panel>

          {/* Treasury Mirror */}
          <Panel title={`Central Treasury (ALM) — ${activeEntry.currency}`} className="border-l-4 border-l-cyan-500">
            <div className="p-4 flex flex-col h-full">
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg flex-1 relative">
                <div className="absolute -top-3 left-4 bg-slate-900 px-2 text-xs font-bold text-cyan-400">ALM MIRROR</div>
                <div className="flex h-full text-xs font-mono">
                  <div className="flex-1 border-r-2 border-slate-700 pr-4 flex flex-col">
                    <div className="text-[10px] text-slate-500 text-center border-b border-slate-700 pb-1 mb-2">DEBIT</div>
                    <div className="p-2 bg-amber-900/20 text-amber-500 rounded border border-amber-900/50 mb-2">
                      <div className="font-bold">{activeEntry.type === 'LOAN' ? 'FUND BU LOAN' : 'RECEIVE DEPOSIT'}</div>
                    </div>
                  </div>
                  <div className="flex-1 pl-4 flex flex-col">
                    <div className="text-[10px] text-slate-500 text-center border-b border-slate-700 pb-1 mb-2">CREDIT</div>
                    <div className="p-2 bg-slate-800 text-slate-300 rounded border border-slate-600 mb-2">
                      <div className="font-bold">{activeEntry.type === 'LOAN' ? 'WHOLESALE / MARKET' : 'INVEST / LEND'}</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-2 text-[10px] text-slate-500 text-center">
                Treasury manages the net interest rate and liquidity risk.
              </div>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
};

export default AccountingLedger;
