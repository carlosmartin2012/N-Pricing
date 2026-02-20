
import React, { useMemo, useState } from 'react';
import { Transaction, FTPResult, ApprovalMatrixConfig } from '../../types';
import { calculatePricing, PricingShocks } from '../../utils/pricingEngine';
import { MOCK_BEHAVIOURAL_MODELS, MOCK_TRANSITION_GRID, MOCK_PHYSICAL_GRID } from '../../constants';
import { Panel, Badge } from '../ui/LayoutComponents';
import { ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, XCircle, TrendingUp, BarChart4, Zap, Droplets } from 'lucide-react';
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

               {/* Consolidated Liquidity Cost V3.0 / V4.0 */}
               <div className="group relative">
                  <WaterfallItem
                     label={t.liquidityCost || "Liquidity Cost"}
                     value={result.liquiditySpread}
                     isAdd
                     color="text-amber-600 dark:text-cyan-400"
                     icon={<Droplets size={12} className="inline mr-1" />}
                  />

                  {/* V4.0 DEMO TOOLTIP */}
                  {deal.id?.startsWith('DL-DEMO-') && (
                     <div className="absolute -left-1 -top-1 w-2 h-2 bg-cyan-500 rounded-full animate-pulse border border-white dark:border-black z-20"></div>
                  )}

                  {/* Technical Details (Auditor/Expert View) */}
                  <div className="hidden group-hover:block absolute left-0 top-full z-10 w-full bg-slate-900 border border-slate-700 p-2 rounded shadow-xl animate-in fade-in slide-in-from-top-1">
                     <div className="text-[9px] uppercase text-slate-500 font-bold mb-1 border-b border-slate-800 pb-1 flex justify-between">
                        <span>Technical Breakdown</span>
                        <span className="text-cyan-500 font-mono">V4.0</span>
                     </div>

                     {/* Demo Context Tooltip */}
                     {deal.id === 'DL-DEMO-001' && (
                        <div className="mb-2 p-1.5 bg-cyan-950/30 border border-cyan-900/50 rounded text-[9px] text-cyan-400 italic">
                           Regulatory Trigger: NSFR Short-Term Floor (1Y) applied due to {"<"} 12M maturity.
                        </div>
                     )}
                     {deal.id === 'DL-DEMO-002' && (
                        <div className="mb-2 p-1.5 bg-emerald-950/30 border border-emerald-900/50 rounded text-[9px] text-emerald-400 italic">
                           Segment Incentive: Operational deposit benefit detected (LCR / Balance Split).
                        </div>
                     )}
                     {deal.id === 'DL-DEMO-004' && (
                        <div className="mb-2 p-1.5 bg-amber-950/30 border border-amber-900/50 rounded text-[9px] text-amber-400 italic">
                           Massive CLC: Impact from undrawn committed line buffer requirement.
                        </div>
                     )}

                     <div className="space-y-1 pl-2 border-l border-slate-700">
                        <div className="flex justify-between text-[10px]">
                           <span className="text-slate-400">Liquidity Premium (NSFR)</span>
                           <span className="font-mono text-amber-500">{result._liquidityPremiumDetails.toFixed(3)}%</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                           <span className="text-slate-400">CLC Charge (LCR Buffer)</span>
                           <span className="font-mono text-amber-500">{result._clcChargeDetails.toFixed(3)}%</span>
                        </div>
                     </div>
                  </div>
               </div>

               <WaterfallItem label="Strategic Spread" value={result.strategicSpread} isAdd color="text-blue-600 dark:text-blue-400" />

               <div className="my-1 border-t border-slate-200 dark:border-slate-800 border-dashed opacity-50"></div>
               <WaterfallItem label={t.ftpRate} value={result.totalFTP} highlight />

               <div className="pl-2 border-l-2 border-slate-800 ml-1 my-1 space-y-1">
                  <WaterfallItem label="Expected Loss (Credit)" value={result.regulatoryCost} isAdd color="text-rose-400" />

                  {/* Liquidity & Regulatory Costs */}
                  <WaterfallItem
                     label="LCR Buffer Cost"
                     value={result.lcrCost || 0}
                     isAdd
                     color={(result.lcrCost || 0) > 0 ? "text-rose-400" : "text-emerald-400"}
                     subtext={deal.lcrClassification ? `Class: ${deal.lcrClassification}` : undefined}
                  />
                  <WaterfallItem
                     label="NSFR Optimization"
                     value={result.nsfrCost || 0}
                     isAdd
                     color={(result.nsfrCost || 0) > 0 ? "text-rose-400" : "text-emerald-400"}
                     subtext={deal.durationMonths > 12 ? 'Long Term Stable Funding' : undefined}
                  />

                  <WaterfallItem label="Operational Cost" value={result.operationalCost} isAdd color="text-rose-400" />
                  <WaterfallItem label="ESG Transition" value={result.esgTransitionCharge} isAdd color={result.esgTransitionCharge > 0 ? "text-rose-400" : "text-emerald-400"} />
                  <WaterfallItem label="ESG Physical" value={result.esgPhysicalCharge} isAdd color="text-rose-400" />
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
                  <div className={`font-mono font-bold ${result.economicProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
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
   icon?: React.ReactNode;
}> = ({ label, value, subtext, isAdd, highlight, color = 'text-slate-200', compact, icon }) => (
   <div className={`flex items-center justify-between ${highlight ? 'py-1' : 'py-0.5'} ${compact ? 'opacity-80' : ''}`}>
      <div>
         <div className={`text-xs ${highlight ? 'font-bold text-white' : 'font-medium text-slate-400'} flex items-center`}>
            {icon && icon}
            {label}
         </div>
         {subtext && <div className="text-[10px] text-slate-600 font-mono">{subtext}</div>}
      </div>
      <div className={`font-mono font-bold ${color} ${highlight ? 'text-sm' : 'text-xs'}`}>
         {isAdd && value > 0 ? '+' : ''}{value.toFixed(3)}%
      </div>
   </div>
);

export default PricingReceipt;
