
import React, { useMemo, useState } from 'react';
import { Transaction, FTPResult, ApprovalMatrixConfig } from '../../types';
import { calculatePricing, PricingShocks } from '../../utils/pricingEngine';
import { MOCK_BEHAVIOURAL_MODELS, MOCK_TRANSITION_GRID, MOCK_PHYSICAL_GRID } from '../../constants';
import { Panel, Badge } from '../ui/LayoutComponents';
import { ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, XCircle, TrendingUp, BarChart4, Zap } from 'lucide-react';
import { translations, Language } from '../../translations';

interface Props {
   deal: Transaction;
   setMatchedMethod: (m: string) => void;
   approvalMatrix: ApprovalMatrixConfig;
   language: Language;
   shocks?: PricingShocks;
}

const PricingReceipt: React.FC<Props> = ({ deal, setMatchedMethod, approvalMatrix, language, shocks }) => {
   const [showAccounting, setShowAccounting] = useState(false);
   const [applyShocks, setApplyShocks] = useState(false);
   const t = translations[language];

   // SIMULATE REAL-TIME CALCULATION ENGINE
   const result: FTPResult = useMemo(() => {
      // Use shared pricing engine with optional shocks
      const activeShocks = (applyShocks && shocks) ? shocks : { interestRate: 0, liquiditySpread: 0 };
      const baseResult = calculatePricing(deal, approvalMatrix, activeShocks);
      setMatchedMethod(baseResult.matchedMethodology);
      return baseResult;
   }, [deal, setMatchedMethod, approvalMatrix, shocks, applyShocks]);

   const fmtCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: deal.currency }).format(n);

   return (
      <Panel title={t.pricingResult || "Profitability & Pricing Construction"} className="h-full border-l-4 border-l-cyan-500 bg-white dark:bg-[#0a0a0a]">
         <div className="flex flex-col h-full">

            {/* Shocks Toggle Banner */}
            {shocks && (shocks.interestRate !== 0 || shocks.liquiditySpread !== 0) && (
               <div className={`mx-4 mt-4 p-3 rounded-lg border flex items-center justify-between transition-colors ${applyShocks ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                  <div className="flex items-center gap-2">
                     <Zap size={16} className={applyShocks ? 'text-amber-500' : 'text-slate-400'} />
                     <div className="text-xs">
                        <span className={`font-bold block ${applyShocks ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500'}`}>
                           {t.shockedScenario || 'Shocked Scenario'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                           {shocks.interestRate > 0 ? '+' : ''}{shocks.interestRate}bps IR, {shocks.liquiditySpread > 0 ? '+' : ''}{shocks.liquiditySpread}bps Liq.
                        </span>
                     </div>
                  </div>
                  <button
                     onClick={() => setApplyShocks(!applyShocks)}
                     className={`text-[10px] font-bold px-3 py-1 rounded-full transition-colors ${applyShocks ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}
                  >
                     {applyShocks ? 'ON' : 'OFF'}
                  </button>
               </div>
            )}

            {/* RAROC Scorecard */}
            <div className="p-4 bg-slate-50 dark:bg-black border-b border-slate-200 dark:border-slate-700/50">
               <div className="flex justify-between items-start mb-3">
                  <div>
                     <h4 className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Projected RAROC</h4>
                     <div className={`text-3xl font-mono font-bold tracking-tight ${result.raroc >= approvalMatrix.autoApprovalThreshold ? 'text-emerald-600 dark:text-emerald-400' : result.raroc > 0 ? 'text-amber-500 dark:text-amber-400' : 'text-red-500'}`}>
                        {result.raroc.toFixed(2)}%
                     </div>
                     <div className="text-[10px] text-slate-500">Target {deal.targetROE}%</div>
                  </div>

                  <div className="text-right">
                     <h4 className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{t.customerRate}</h4>
                     <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white">
                        {result.finalClientRate.toFixed(2)}%
                     </div>
                     <div className="text-[10px] text-slate-500">All-in Price</div>
                  </div>
               </div>

               {/* Approval Matrix Badge */}
               <div className={`flex items-center gap-2 p-2 rounded border ${result.approvalLevel === 'Auto' ? 'bg-emerald-950/30 border-emerald-900 text-emerald-400' :
                  result.approvalLevel === 'L1_Manager' ? 'bg-amber-950/30 border-amber-900 text-amber-400' :
                     result.approvalLevel === 'L2_Committee' ? 'bg-orange-950/30 border-orange-900 text-orange-400' :
                        'bg-red-950/30 border-red-900 text-red-400'
                  }`}>
                  {result.approvalLevel === 'Auto' && <CheckCircle2 size={16} />}
                  {result.approvalLevel === 'L1_Manager' && <AlertTriangle size={16} />}
                  {result.approvalLevel === 'L2_Committee' && <TrendingUp size={16} />}
                  {result.approvalLevel === 'Rejected' && <XCircle size={16} />}

                  <div className="flex-1 text-xs font-bold uppercase">
                     {result.approvalLevel === 'Auto' && 'Automatic Approval'}
                     {result.approvalLevel === 'L1_Manager' && 'Requires L1 Manager Review'}
                     {result.approvalLevel === 'L2_Committee' && 'Escalation: Pricing Committee'}
                     {result.approvalLevel === 'Rejected' && 'Deal Below Floor - Rejected'}
                  </div>
               </div>
            </div>

            {/* Pricing Waterfall */}
            <div className="flex-1 p-4 space-y-1 overflow-auto bg-white dark:bg-[#050505]">
               <div className="text-[10px] uppercase text-slate-500 font-bold mb-2">Price Construction</div>

               <WaterfallItem label="Base Interest Rate" value={result.baseRate} />
               <WaterfallItem label={t.liquidityCost} value={result.liquiditySpread} isAdd color="text-amber-600 dark:text-amber-400" />
               <WaterfallItem label="Strategic Spread" value={result.strategicSpread} isAdd color="text-blue-600 dark:text-blue-400" />

               <div className="my-1 border-t border-slate-200 dark:border-slate-800 border-dashed opacity-50"></div>
               <WaterfallItem label={t.ftpRate} value={result.totalFTP} highlight />

               <div className="pl-2 border-l-2 border-slate-800 ml-1 my-1 space-y-1">
                  <WaterfallItem label="Expected Loss (Credit)" value={result.regulatoryCost} isAdd color="text-red-300" />
                  <WaterfallItem label="Operational Cost" value={result.operationalCost} isAdd color="text-red-300" />
                  <WaterfallItem label="ESG Transition" value={result.esgTransitionCharge} isAdd color={result.esgTransitionCharge > 0 ? "text-red-300" : "text-emerald-400"} />
                  <WaterfallItem label="ESG Physical" value={result.esgPhysicalCharge} isAdd color="text-red-300" />
               </div>

               <div className="bg-slate-800/50 p-2 rounded border border-slate-700 my-2">
                  <WaterfallItem label="Floor Price (Break-even)" value={result.floorPrice} highlight color="text-slate-300" />
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pl-2 mt-1">
                     <span>+ Cost of Capital (Hurdle)</span>
                     <span>+{result.capitalCharge.toFixed(2)}%</span>
                  </div>
                  <WaterfallItem label="Technical Price (ROE 15%)" value={result.technicalPrice} highlight color="text-cyan-300" />
               </div>

               <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-slate-400">Net Economic Profit</div>
                  <div className={`font-mono font-bold ${result.economicProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                     {result.economicProfit >= 0 ? '+' : ''}{result.economicProfit.toFixed(2)}%
                  </div>
               </div>
            </div>

            {/* Accounting Toggle */}
            <div className="border-t border-slate-700 bg-slate-900 p-2">
               <button
                  onClick={() => setShowAccounting(!showAccounting)}
                  className="w-full flex items-center justify-between p-2 text-xs text-slate-400 hover:bg-slate-800 rounded transition-colors"
               >
                  <span className="flex items-center gap-2 font-mono uppercase font-bold">
                     {showAccounting ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                     GL Posting Preview
                  </span>
                  <Badge variant="default">GL: 102-393</Badge>
               </button>

               {showAccounting && (
                  <div className="mt-2 p-3 bg-slate-950 rounded border border-slate-800 font-mono text-[10px] space-y-2 animate-in fade-in slide-in-from-top-2">
                     <div className="grid grid-cols-12 gap-2 text-slate-300">
                        <div className="col-span-1 text-slate-500">DR</div>
                        <div className="col-span-5">{result.accountingEntry.source}</div>
                        <div className="col-span-2 text-right text-slate-500">EXP</div>
                        <div className="col-span-4 text-right">{fmtCurrency(result.accountingEntry.amountDebit)}</div>
                     </div>
                     <div className="grid grid-cols-12 gap-2 text-slate-300">
                        <div className="col-span-1 text-slate-500">CR</div>
                        <div className="col-span-5">{result.accountingEntry.dest}</div>
                        <div className="col-span-2 text-right text-slate-500">INC</div>
                        <div className="col-span-4 text-right">{fmtCurrency(result.accountingEntry.amountCredit)}</div>
                     </div>
                  </div>
               )}
            </div>

         </div>
      </Panel>
   );
};

const WaterfallItem: React.FC<{
   label: string;
   value: number;
   subtext?: string;
   isAdd?: boolean;
   highlight?: boolean;
   color?: string;
   compact?: boolean;
}> = ({ label, value, subtext, isAdd, highlight, color = 'text-slate-200', compact }) => (
   <div className={`flex items-center justify-between ${highlight ? 'py-1' : 'py-0.5'} ${compact ? 'opacity-80' : ''}`}>
      <div>
         <div className={`text-xs ${highlight ? 'font-bold text-white' : 'font-medium text-slate-400'}`}>{label}</div>
         {subtext && <div className="text-[10px] text-slate-600 font-mono">{subtext}</div>}
      </div>
      <div className={`font-mono font-bold ${color} ${highlight ? 'text-sm' : 'text-xs'}`}>
         {isAdd && value > 0 ? '+' : ''}{value.toFixed(3)}%
      </div>
   </div>
);

export default PricingReceipt;
