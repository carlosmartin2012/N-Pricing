
import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Transaction, FTPResult, ApprovalMatrixConfig } from '../../types';
import { calculatePricing, PricingShocks, PricingContext } from '../../utils/pricingEngine';
import { Panel, Badge } from '../ui/LayoutComponents';
import { ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, XCircle, TrendingUp, BarChart4, Zap, Droplets, Save, FilePlus, Check, FileDown } from 'lucide-react';
import { translations, Language } from '../../translations';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseService } from '../../utils/supabaseService';
import { storage } from '../../utils/storage';

interface Props {
   deal: Transaction;
   setMatchedMethod: (m: string) => void;
   approvalMatrix: ApprovalMatrixConfig;
   language: Language;
   shocks?: PricingShocks;
   onDealSaved?: (deal: Transaction) => void;
}

const PricingReceipt: React.FC<Props> = ({ deal, setMatchedMethod, approvalMatrix, language, shocks, onDealSaved }) => {
   const [showAccounting, setShowAccounting] = useState(false);
   const [applyShocks, setApplyShocks] = useState(false);
   const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
   const [dealSaveStatus, setDealSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
   const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
   const t = translations[language];
   const data = useData();
   const { currentUser } = useAuth();

   const pricingContext: PricingContext = useMemo(() => ({
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
   }), [data.yieldCurves, data.rules, data.ftpRateCards, data.transitionGrid, data.physicalGrid, data.behaviouralModels, data.clients, data.products, data.businessUnits]);

   const result: FTPResult = useMemo(() => {
      const activeShocks = (applyShocks && shocks) ? shocks : { interestRate: 0, liquiditySpread: 0 };
      const baseResult = calculatePricing(deal, approvalMatrix, pricingContext, activeShocks);
      setMatchedMethod(baseResult.matchedMethodology);
      return baseResult;
   }, [deal, setMatchedMethod, approvalMatrix, pricingContext, shocks, applyShocks]);

   // Auto-save pricing result to Supabase (debounced 3s after calculation stabilizes)
   useEffect(() => {
      if (!deal.id || !currentUser) return;
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
         supabaseService.savePricingResult(deal.id!, result, deal, currentUser.email)
            .then(() => { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000); })
            .catch(() => {});
      }, 3000);
      return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
   }, [result, deal.id, currentUser]);

   // Save as new deal in blotter
   const handleSaveAsDeal = useCallback(async () => {
      if (!currentUser) return;
      setDealSaveStatus('saving');
      const newDeal: Transaction = {
         ...deal,
         id: deal.id || `DL-${Date.now().toString(36).toUpperCase()}`,
         status: result.approvalLevel === 'Auto' ? 'Approved' : 'Pending_Approval',
         liquiditySpread: result.liquiditySpread,
         _liquidityPremiumDetails: result._liquidityPremiumDetails,
         _clcChargeDetails: result._clcChargeDetails,
      };
      try {
         await storage.saveDeal(newDeal);
         data.setDeals(prev => {
            const exists = prev.find(d => d.id === newDeal.id);
            return exists ? prev.map(d => d.id === newDeal.id ? newDeal : d) : [...prev, newDeal];
         });
         await supabaseService.savePricingResult(newDeal.id!, result, newDeal, currentUser.email);
         await storage.addAuditEntry({
            userEmail: currentUser.email,
            userName: currentUser.name,
            action: 'DEAL_SAVED_FROM_CALCULATOR',
            module: 'CALCULATOR',
            description: `Deal ${newDeal.id} saved with RAROC ${result.raroc.toFixed(2)}% — ${result.approvalLevel}`,
         });
         setDealSaveStatus('saved');
         onDealSaved?.(newDeal);
         setTimeout(() => setDealSaveStatus('idle'), 3000);
      } catch (e) {
         setDealSaveStatus('idle');
      }
   }, [deal, result, currentUser, data, onDealSaved]);

   // Sanitize strings for safe HTML insertion (prevent XSS)
   const sanitize = (str: string | number | undefined | null): string => {
      return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
   };

   // Generate printable pricing receipt (PDF-ready)
   const handleExportReceipt = useCallback(() => {
      const clientName = sanitize(data.clients.find(c => c.id === deal.clientId)?.name || deal.clientId);
      const html = `<!DOCTYPE html><html><head><title>Pricing Receipt — ${deal.id || 'New Deal'}</title>
<style>body{font-family:monospace;max-width:700px;margin:40px auto;color:#1e293b;font-size:12px}
h1{font-size:18px;border-bottom:2px solid #0891b2;padding-bottom:8px;color:#0891b2}
h2{font-size:14px;margin-top:20px;color:#334155}
.row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dotted #e2e8f0}
.row.highlight{font-weight:bold;background:#f0f9ff;padding:6px 4px}
.badge{display:inline-block;padding:4px 12px;border-radius:4px;font-weight:bold;font-size:11px}
.auto{background:#d1fae5;color:#065f46}.l1{background:#fef3c7;color:#92400e}.l2{background:#fed7aa;color:#9a3412}.rej{background:#fecaca;color:#991b1b}
.footer{margin-top:30px;text-align:center;color:#94a3b8;font-size:10px}
@media print{body{margin:20px}}</style></head><body>
<h1>N Pricing — FTP Pricing Receipt</h1>
<div class="row"><span>Deal ID</span><span><b>${sanitize(deal.id) || 'Unsaved'}</b></span></div>
<div class="row"><span>Client</span><span>${clientName} (${sanitize(deal.clientType)})</span></div>
<div class="row"><span>Product</span><span>${sanitize(deal.productType)} — ${sanitize(deal.category)}</span></div>
<div class="row"><span>Amount</span><span>${new Intl.NumberFormat('en-US', {style:'currency',currency:deal.currency}).format(deal.amount)}</span></div>
<div class="row"><span>Tenor</span><span>${deal.durationMonths}M ${sanitize(deal.amortization)} ${sanitize(deal.repricingFreq)}</span></div>
<h2>Pricing Construction</h2>
<div class="row"><span>IRRBB Base Rate</span><span>${result.baseRate.toFixed(3)}%</span></div>
<div class="row"><span>Liquidity Spread</span><span>${result.liquiditySpread >= 0?'+':''}${result.liquiditySpread.toFixed(3)}%</span></div>
<div class="row"><span>  └ LP</span><span>${result._liquidityPremiumDetails.toFixed(3)}%</span></div>
<div class="row"><span>  └ CLC (LCR)</span><span>+${result._clcChargeDetails.toFixed(3)}%</span></div>
${result.nsfrCost ? `<div class="row"><span>  └ NSFR</span><span>${result.nsfrCost.toFixed(3)}%</span></div>` : ''}
<div class="row"><span>Strategic Spread</span><span>${result.strategicSpread.toFixed(3)}%</span></div>
${result.incentivisationAdj ? `<div class="row"><span>Incentivisation</span><span>${result.incentivisationAdj.toFixed(3)}%</span></div>` : ''}
<div class="row highlight"><span>Total FTP</span><span>${result.totalFTP.toFixed(3)}%</span></div>
<div class="row"><span>Expected Loss</span><span>+${result.regulatoryCost.toFixed(3)}%</span></div>
<div class="row"><span>Operational Cost</span><span>+${result.operationalCost.toFixed(3)}%</span></div>
<div class="row"><span>ESG Transition</span><span>${result.esgTransitionCharge.toFixed(3)}%</span></div>
<div class="row"><span>ESG Physical</span><span>${result.esgPhysicalCharge.toFixed(3)}%</span></div>
<div class="row highlight"><span>Floor Price</span><span>${result.floorPrice.toFixed(3)}%</span></div>
<div class="row"><span>Capital Charge</span><span>+${result.capitalCharge.toFixed(3)}%</span></div>
<div class="row highlight"><span>Technical Price</span><span>${result.technicalPrice.toFixed(3)}%</span></div>
<h2>RAROC & Governance</h2>
<div class="row highlight"><span>RAROC</span><span>${result.raroc.toFixed(2)}%</span></div>
<div class="row"><span>Economic Profit</span><span>${result.economicProfit >= 0?'+':''}${result.economicProfit.toFixed(2)}%</span></div>
<div class="row"><span>Final Client Rate</span><span><b>${result.finalClientRate.toFixed(2)}%</b></span></div>
<div class="row"><span>Approval</span><span class="badge ${result.approvalLevel==='Auto'?'auto':result.approvalLevel==='L1_Manager'?'l1':result.approvalLevel==='L2_Committee'?'l2':'rej'}">${result.approvalLevel}</span></div>
${result.formulaUsed ? `<div class="row"><span>Formula</span><span>${sanitize(result.formulaUsed)}</span></div>` : ''}
<div class="row"><span>Methodology</span><span>${sanitize(result.matchedMethodology)}</span></div>
<div class="footer">Generated by N Pricing Platform — ${sanitize(new Date().toLocaleString())}<br>Calculated by ${sanitize(currentUser?.name || 'System')}</div>
</body></html>`;
      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); w.print(); }
   }, [deal, result, currentUser, data.clients]);

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

            {/* Pricing Waterfall V5.0: ALM Hierarchical Rigor */}
            <div className="flex-1 p-4 space-y-1 overflow-auto bg-white dark:bg-[#050505]">
               {/* Formula Badge */}
               {result.formulaUsed && (
                  <div className="mb-3 p-2 bg-indigo-950/30 border border-indigo-800/50 rounded-lg">
                     <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mb-1">Applied Formula</div>
                     <div className="text-xs text-indigo-300 font-mono">{result.formulaUsed}</div>
                     {result.behavioralMaturityUsed != null && result.behavioralMaturityUsed !== deal.durationMonths && (
                        <div className="text-[10px] text-indigo-500 mt-1">BM={Math.round(result.behavioralMaturityUsed)}M vs DTM={deal.durationMonths}M</div>
                     )}
                  </div>
               )}

               <div className="text-[10px] uppercase text-slate-500 font-bold mb-2 tracking-widest">Pricing Construction Flow</div>

               <WaterfallItem label="IRRBB — Base Rate" value={result.baseRate} color="text-slate-300" />

               {/* Consolidated Liquidity Module */}
               <div className="mt-3 mb-1 pt-2 border-t border-slate-800/50">
                  <WaterfallItem
                     label={t.liquidityCost || "Total Liquidity Spread"}
                     value={result.liquiditySpread}
                     isAdd
                     color="text-amber-400"
                     weight="font-mono font-bold"
                     icon={<Droplets size={12} className="inline mr-2 text-amber-600" />}
                  />

                  {/* Indented Breakdown: LP + CLC + NSFR + LR */}
                  <div className="ml-5 mt-1 space-y-0.5 border-l border-slate-800 pl-3">
                     <div className="flex justify-between items-center text-[10px] text-slate-500">
                        <span>Liquidity Premium (LP)</span>
                        <span className="font-mono">{result._liquidityPremiumDetails >= 0 ? '+' : ''}{result._liquidityPremiumDetails.toFixed(3)}%</span>
                     </div>
                     <div className="flex justify-between items-center text-[10px] text-slate-500">
                        <span>LCR Buffer Cost (CLC)</span>
                        <span className="font-mono">+{result._clcChargeDetails.toFixed(3)}%</span>
                     </div>
                     {(result.nsfrCost != null && result.nsfrCost !== 0) && (
                        <div className="flex justify-between items-center text-[10px] text-slate-500">
                           <span>NSFR {result.nsfrCost < 0 ? 'Benefit' : 'Charge'}</span>
                           <span className="font-mono">{result.nsfrCost >= 0 ? '+' : ''}{result.nsfrCost.toFixed(3)}%</span>
                        </div>
                     )}
                     {(result.liquidityRecharge != null && result.liquidityRecharge !== 0) && (
                        <div className="flex justify-between items-center text-[10px] text-purple-400">
                           <span>Liquidity Recharge (LR)</span>
                           <span className="font-mono">+{result.liquidityRecharge.toFixed(3)}%</span>
                        </div>
                     )}
                  </div>
               </div>

               <WaterfallItem label="Strategic Spread" value={result.strategicSpread} isAdd color="text-blue-600 dark:text-blue-400" />

               {/* Incentivisation */}
               {(result.incentivisationAdj != null && result.incentivisationAdj !== 0) && (
                  <WaterfallItem
                     label="Incentivisation Adj."
                     value={result.incentivisationAdj}
                     isAdd
                     color={result.incentivisationAdj < 0 ? "text-emerald-400" : "text-rose-400"}
                  />
               )}

               <div className="my-2 border-t border-slate-200 dark:border-slate-800 border-dotted opacity-60"></div>

               <WaterfallItem label={t.ftpRate} value={result.totalFTP} highlight />

               {/* Business & Regulatory Costs */}
               <div className="pl-2 border-l-2 border-slate-800 ml-1 mt-2 space-y-1">
                  <WaterfallItem label="Expected Loss (Credit)" value={result.regulatoryCost} isAdd color="text-rose-400" />
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
                  {(result.capitalIncome != null && result.capitalIncome > 0) && (
                     <div className="flex items-center justify-between text-[10px] text-emerald-500 pl-2 mt-0.5">
                        <span>- Capital Income (Risk-Free)</span>
                        <span className="font-mono">-{result.capitalIncome.toFixed(3)}%</span>
                     </div>
                  )}
                  <WaterfallItem label={`Technical Price (ROE ${deal.targetROE}%)`} value={result.technicalPrice} highlight color="text-cyan-300" />
               </div>

               <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-slate-400">Net Economic Profit</div>
                  <div className={`font-mono font-bold ${result.economicProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                     {result.economicProfit >= 0 ? '+' : ''}{result.economicProfit.toFixed(2)}%
                  </div>
               </div>
            </div>

            {/* Save as Deal + Auto-save indicator */}
            <div className="border-t border-slate-700 bg-slate-900 p-3 flex items-center gap-2">
               <button
                  onClick={handleSaveAsDeal}
                  disabled={dealSaveStatus === 'saving'}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                     dealSaveStatus === 'saved'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                  }`}
               >
                  {dealSaveStatus === 'saved' ? <Check size={14} /> : dealSaveStatus === 'saving' ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FilePlus size={14} />}
                  {dealSaveStatus === 'saved' ? 'Deal Saved to Blotter' : dealSaveStatus === 'saving' ? 'Saving...' : 'Save as Deal'}
               </button>
               <button
                  onClick={handleExportReceipt}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                  title="Print / Save as PDF"
               >
                  <FileDown size={14} /> PDF
               </button>
               {saveStatus === 'saved' && (
                  <div className="flex items-center gap-1 text-[10px] text-emerald-500">
                     <Save size={10} /> Auto-saved
                  </div>
               )}
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
      </Panel >
   );
};

const WaterfallItem: React.FC<{
   label: string;
   value: number;
   subtext?: string;
   isAdd?: boolean;
   highlight?: boolean;
   color?: string;
   weight?: string;
   compact?: boolean;
   icon?: React.ReactNode;
}> = ({ label, value, subtext, isAdd, highlight, color = 'text-slate-200', weight, compact, icon }) => (
   <div className={`flex items-center justify-between ${highlight ? 'py-1' : 'py-0.5'} ${compact ? 'opacity-80' : ''}`}>
      <div>
         <div className={`text-xs ${highlight ? 'font-bold text-white' : 'font-medium text-slate-400'} flex items-center`}>
            {icon && icon}
            {label}
         </div>
         {subtext && <div className="text-[10px] text-slate-600 font-mono">{subtext}</div>}
      </div>
      <div className={`${weight || 'font-mono'} font-bold ${color} ${highlight ? 'text-sm' : 'text-xs'}`}>
         {isAdd && value > 0 ? '+' : ''}{value.toFixed(3)}%
      </div>
   </div>
);

export default PricingReceipt;
