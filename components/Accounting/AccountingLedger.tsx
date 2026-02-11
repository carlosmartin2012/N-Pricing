import React, { useState, useMemo } from 'react';
import { Panel, Badge, SelectInput } from '../ui/LayoutComponents';
import { ArrowRightLeft, TrendingUp, TrendingDown, DollarSign, Activity, Building2, Layers } from 'lucide-react';

// --- Types & Mock Data ---

interface LedgerEntry {
  id: string;
  timestamp: string;
  unit: 'Commercial' | 'Retail' | 'SME' | 'Treasury';
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

const MOCK_LEDGER: LedgerEntry[] = [
  {
    id: 'TXN-2023-8841',
    timestamp: '2023-10-24 14:45:00',
    unit: 'Commercial',
    type: 'LOAN',
    product: 'Comm. Real Estate Loan',
    amount: 15000000,
    clientRate: 6.75,
    ftpRate: 4.85,
    margin: 1.90,
    currency: 'USD',
    status: 'POSTED',
    ftpComponents: { baseRate: 4.50, liquidityPrem: 0.45, strategicAdj: -0.10 }
  },
  {
    id: 'TXN-2023-8842',
    timestamp: '2023-10-24 13:12:30',
    unit: 'Commercial',
    type: 'DEPOSIT',
    product: 'Corp. Term Deposit 1Y',
    amount: 5000000,
    clientRate: 3.25,
    ftpRate: 5.10,
    margin: 1.85,
    currency: 'EUR',
    status: 'POSTED',
    ftpComponents: { baseRate: 4.90, liquidityPrem: 0.20, strategicAdj: 0.00 }
  },
  {
    id: 'TXN-2023-8843',
    timestamp: '2023-10-24 11:05:15',
    unit: 'SME',
    type: 'LOAN',
    product: 'SME Revolving Credit',
    amount: 750000,
    clientRate: 7.20,
    ftpRate: 5.50,
    margin: 1.70,
    currency: 'GBP',
    status: 'PENDING',
    ftpComponents: { baseRate: 5.25, liquidityPrem: 0.25, strategicAdj: 0.00 }
  },
  {
    id: 'TXN-2023-8844',
    timestamp: '2023-10-23 16:55:00',
    unit: 'Retail',
    type: 'DEPOSIT',
    product: 'Retail Savings High Yield',
    amount: 250000,
    clientRate: 4.10,
    ftpRate: 4.95,
    margin: 0.85,
    currency: 'USD',
    status: 'POSTED',
    ftpComponents: { baseRate: 4.95, liquidityPrem: 0.00, strategicAdj: 0.00 }
  },
  {
    id: 'TXN-2023-8845',
    timestamp: '2023-10-23 15:30:00',
    unit: 'Retail',
    type: 'LOAN',
    product: 'Mortgage Fixed 30Y',
    amount: 450000,
    clientRate: 6.10,
    ftpRate: 4.20,
    margin: 1.90,
    currency: 'USD',
    status: 'POSTED',
    ftpComponents: { baseRate: 4.00, liquidityPrem: 0.20, strategicAdj: 0.00 }
  },
];

// --- Component ---

const AccountingLedger: React.FC = () => {
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL'); // ALL, Commercial, Retail, SME
  const [selectedEntry, setSelectedEntry] = useState<LedgerEntry | null>(null);

  // Filter Data
  const filteredLedger = useMemo(() => {
    return selectedUnit === 'ALL' 
      ? MOCK_LEDGER 
      : MOCK_LEDGER.filter(e => e.unit === selectedUnit);
  }, [selectedUnit]);

  // Aggregate Balances for Header
  const balanceSummary = useMemo(() => {
    let assets = 0;
    let liabilities = 0;
    filteredLedger.forEach(e => {
      // Basic simulation: Loans are assets, Deposits are liabilities
      // Note: Currencies mixed for mock simplicity, in real app would convert to base
      if (e.type === 'LOAN') assets += e.amount;
      else liabilities += e.amount;
    });
    return { assets, liabilities, net: assets - liabilities };
  }, [filteredLedger]);

  const activeEntry = selectedEntry || filteredLedger[0];

  const fmtCurrency = (val: number, ccy: string) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: ccy, maximumFractionDigits: 0 }).format(val);

  const fmtRate = (val: number) => val.toFixed(2) + '%';

  return (
    <div className="flex flex-col h-full gap-4">
      
      {/* Header: Balance Sheet Context Selector */}
      <div className="flex flex-col md:flex-row gap-4 h-32 md:h-24">
         
         {/* Context Selector */}
         <div className="w-full md:w-1/3 bg-slate-900 border border-slate-800 p-4 rounded shadow flex flex-col justify-center">
            <div className="text-[10px] uppercase font-bold text-slate-500 mb-2 flex items-center gap-2">
               <Building2 size={12} /> Organizational Unit View
            </div>
            <SelectInput 
              value={selectedUnit} 
              onChange={(e) => { setSelectedUnit(e.target.value); setSelectedEntry(null); }}
              className="w-full"
            >
               <option value="ALL">Global Consolidated (All Units)</option>
               <option value="Commercial">Commercial Banking</option>
               <option value="Retail">Retail Banking</option>
               <option value="SME">SME & Business</option>
            </SelectInput>
         </div>

         {/* Aggregated Balance Card */}
         <div className="w-full md:w-2/3 bg-slate-900 border border-slate-800 p-4 rounded shadow grid grid-cols-3 divide-x divide-slate-800">
             <div className="px-4 flex flex-col justify-center">
                <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Total Assets (Loans)</div>
                <div className="text-xl font-mono text-emerald-400 font-bold">{fmtCurrency(balanceSummary.assets, 'USD')}*</div>
                <div className="text-[9px] text-slate-600">Simulated Base Equiv.</div>
             </div>
             <div className="px-4 flex flex-col justify-center">
                <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Total Liab (Deposits)</div>
                <div className="text-xl font-mono text-rose-400 font-bold">{fmtCurrency(balanceSummary.liabilities, 'USD')}*</div>
             </div>
             <div className="px-4 flex flex-col justify-center">
                <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Net Funding Position</div>
                <div className={`text-xl font-mono font-bold ${balanceSummary.net > 0 ? 'text-cyan-400' : 'text-amber-400'}`}>
                   {balanceSummary.net > 0 ? 'Long' : 'Short'} {fmtCurrency(Math.abs(balanceSummary.net), 'USD')}
                </div>
             </div>
         </div>
      </div>

      {/* MID: General Journal Data Grid */}
      <Panel title={`General Journal - ${selectedUnit === 'ALL' ? 'Consolidated' : selectedUnit + ' Desk'}`} className="flex-1 min-h-[250px]">
        <div className="h-full overflow-hidden flex flex-col">
           <table className="w-full text-left border-collapse">
            <thead className="bg-slate-950 sticky top-0 z-10 text-[10px] uppercase font-bold text-slate-500">
              <tr>
                <th className="p-3 border-b border-r border-slate-800">Timestamp</th>
                <th className="p-3 border-b border-r border-slate-800">Deal ID</th>
                <th className="p-3 border-b border-r border-slate-800">Unit</th>
                <th className="p-3 border-b border-r border-slate-800">Type / Product</th>
                <th className="p-3 border-b border-r border-slate-800 text-right">Amount</th>
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
                  <td className="p-3 border-r border-slate-800/50 text-slate-300">{entry.id}</td>
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
                  <td className="p-3 border-r border-slate-800/50 text-right text-amber-500 font-bold">{fmtRate(entry.ftpRate)}</td>
                  <td className="p-3 text-right text-cyan-400 font-bold">{fmtRate(entry.margin)}</td>
                </tr>
              ))}
              {filteredLedger.length === 0 && (
                 <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">No transactions found for this unit.</td>
                 </tr>
              )}
            </tbody>
           </table>
        </div>
      </Panel>

      {/* BOTTOM: T-Account Visualizer (Shows Selected Transaction Context) */}
      {activeEntry && (
        <div className="h-64 grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* Left: Business Unit T-Account */}
            <Panel title={`Unit Balance Sheet: ${activeEntry.unit}`} className="border-l-4 border-l-emerald-500">
            <div className="p-4 flex flex-col h-full">
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg flex-1 relative">
                <div className="absolute -top-3 left-4 bg-slate-900 px-2 text-xs font-bold text-emerald-400 uppercase">{activeEntry.unit} Ledger</div>
                
                {/* T-Shape CSS */}
                <div className="flex h-full text-xs font-mono">
                    {/* DEBIT Side */}
                    <div className="flex-1 border-r-2 border-slate-700 pr-4 flex flex-col">
                        <div className="text-[10px] text-slate-500 text-center border-b border-slate-700 pb-1 mb-2">DEBIT (ASSETS)</div>
                        {activeEntry.type === 'LOAN' ? (
                        <div className="p-2 bg-emerald-900/20 text-emerald-400 rounded border border-emerald-900/50 mb-2">
                            <div className="font-bold">CLIENT LOAN</div>
                            <div>{fmtCurrency(activeEntry.amount, activeEntry.currency)}</div>
                        </div>
                        ) : (
                        <div className="p-2 bg-amber-900/20 text-amber-500 rounded border border-amber-900/50 mb-2">
                            <div className="font-bold">INTERNAL DEP (ALM)</div>
                            <div>{fmtCurrency(activeEntry.amount, activeEntry.currency)}</div>
                        </div>
                        )}
                    </div>
                    
                    {/* CREDIT Side */}
                    <div className="flex-1 pl-4 flex flex-col">
                        <div className="text-[10px] text-slate-500 text-center border-b border-slate-700 pb-1 mb-2">CREDIT (LIAB)</div>
                        {activeEntry.type === 'LOAN' ? (
                        <div className="p-2 bg-amber-900/20 text-amber-500 rounded border border-amber-900/50 mb-2">
                            <div className="font-bold">INTERNAL FUNDING</div>
                            <div>{fmtCurrency(activeEntry.amount, activeEntry.currency)}</div>
                        </div>
                        ) : (
                        <div className="p-2 bg-rose-900/20 text-rose-400 rounded border border-rose-900/50 mb-2">
                            <div className="font-bold">CLIENT DEPOSIT</div>
                            <div>{fmtCurrency(activeEntry.amount, activeEntry.currency)}</div>
                        </div>
                        )}
                    </div>
                </div>
                </div>
            </div>
            </Panel>

            {/* Center: FTP Breakdown */}
            <Panel title="FTP Composition" className="bg-slate-900/50">
                <div className="p-4 flex flex-col justify-center h-full space-y-2">
                    <div className="text-center">
                        <div className="text-2xl font-mono font-bold text-amber-500">{fmtRate(activeEntry.ftpRate)}</div>
                        <div className="text-[10px] text-slate-500 uppercase">Transfer Rate</div>
                    </div>
                    <div className="flex items-center justify-between text-xs px-4 py-1 border-b border-slate-800">
                        <span className="text-slate-400">Base</span>
                        <span className="font-mono text-slate-200">{fmtRate(activeEntry.ftpComponents.baseRate)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs px-4 py-1 border-b border-slate-800">
                        <span className="text-slate-400">Liquidity</span>
                        <span className="font-mono text-amber-500">+{fmtRate(activeEntry.ftpComponents.liquidityPrem)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs px-4 py-1">
                        <span className="text-slate-400">Strategy</span>
                        <span className="font-mono text-blue-400">{activeEntry.ftpComponents.strategicAdj > 0 ? '+' : ''}{fmtRate(activeEntry.ftpComponents.strategicAdj)}</span>
                    </div>
                </div>
            </Panel>

            {/* Right: Treasury T-Account */}
            <Panel title={`Central Treasury (ALM) - ${activeEntry.currency}`} className="border-l-4 border-l-cyan-500">
                <div className="p-4 flex flex-col h-full">
                    <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg flex-1 relative">
                        <div className="absolute -top-3 left-4 bg-slate-900 px-2 text-xs font-bold text-cyan-400">ALM MIRROR</div>
                        
                        <div className="flex h-full text-xs font-mono">
                            <div className="flex-1 border-r-2 border-slate-700 pr-4 flex flex-col">
                                <div className="text-[10px] text-slate-500 text-center border-b border-slate-700 pb-1 mb-2">DEBIT</div>
                                {activeEntry.type === 'LOAN' ? (
                                <div className="p-2 bg-amber-900/20 text-amber-500 rounded border border-amber-900/50 mb-2">
                                    <div className="font-bold">LOAN TO BU</div>
                                </div>
                                ) : (
                                <div className="p-2 bg-slate-800 text-slate-300 rounded border border-slate-600 mb-2">
                                    <div className="font-bold">CASH</div>
                                </div>
                                )}
                            </div>
                            
                            <div className="flex-1 pl-4 flex flex-col">
                                <div className="text-[10px] text-slate-500 text-center border-b border-slate-700 pb-1 mb-2">CREDIT</div>
                                {activeEntry.type === 'LOAN' ? (
                                <div className="p-2 bg-slate-800 text-slate-300 rounded border border-slate-600 mb-2">
                                    <div className="font-bold">CASH</div>
                                </div>
                                ) : (
                                <div className="p-2 bg-amber-900/20 text-amber-500 rounded border border-amber-900/50 mb-2">
                                    <div className="font-bold">DEP FROM BU</div>
                                </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="mt-2 text-[10px] text-slate-500 text-center">
                       Treasury manages the net interest rate risk.
                    </div>
                </div>
            </Panel>

        </div>
      )}
    </div>
  );
};

export default AccountingLedger;
