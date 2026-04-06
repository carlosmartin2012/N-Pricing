import React from 'react';
import { Transaction } from '../../types';
import { Panel, Badge } from '../ui/LayoutComponents';
import { ArrowRight, GitBranch, Layers, Settings } from 'lucide-react';
import { useUI } from '../../contexts/UIContext';

interface Props {
   deal: Transaction;
   matchedMethod: string;
}

const MethodologyVisualizer: React.FC<Props> = ({ deal, matchedMethod }) => {
   const { t } = useUI();

   // Visual logic helpers
   const isShortTerm = deal.durationMonths < 12;
   const hasDeal = deal.productType && deal.amount > 0;

   return (
      <Panel title={t.methodologyLogicEngine} className="h-full">
         <div className="p-4 flex flex-col h-full relative overflow-auto">

            {/* Background Grid FX */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
               style={{ backgroundImage: 'radial-gradient(circle, rgba(6, 182, 212, 0.8) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
            </div>

            {!hasDeal ? (
               <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center text-[color:var(--nfq-text-muted)]">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)]">
                     <GitBranch size={24} className="text-[color:var(--nfq-text-faint)]" />
                  </div>
                  <h3 className="mb-1 text-sm font-bold uppercase text-[color:var(--nfq-text-secondary)]">{t.noScenarioActive}</h3>
                  <p className="max-w-[200px] text-xs text-[color:var(--nfq-text-muted)]">{t.noScenarioDescription}</p>
               </div>
            ) : (
               <div className="relative z-10 flex flex-col space-y-6">

                  {/* Active Rules Flow */}
                  <div className="flex flex-col space-y-2">
                     <div className="text-[10px] uppercase text-slate-500 font-bold tracking-widest flex items-center gap-2">
                        <GitBranch size={12} /> {t.decisionTree}
                     </div>

                     {/* Step 1: Product */}
                     <div className="flex items-center gap-3 text-sm">
                        <div className={`w-8 h-8 rounded border flex items-center justify-center ${deal.productType.includes('LOAN') ? 'border-cyan-500 bg-cyan-950/30 text-cyan-400' : 'border-slate-600 text-slate-600'}`}>
                           L
                        </div>
                        <ArrowRight size={14} className="text-slate-600" />
                        <div className={`w-8 h-8 rounded border flex items-center justify-center ${deal.productType.includes('DEP') ? 'border-cyan-500 bg-cyan-950/30 text-cyan-400' : 'border-slate-600 text-slate-600'}`}>
                           D
                        </div>
                        <div className="ml-auto text-xs font-mono text-slate-400">
                           Product: <span className="text-slate-200">{deal.productType}</span>
                        </div>
                     </div>

                     {/* Step 2: Tenor */}
                     <div className="flex items-center gap-3 text-sm mt-2">
                        <div className={`w-8 h-8 rounded border flex items-center justify-center ${!isShortTerm ? 'border-cyan-500 bg-cyan-950/30 text-cyan-400' : 'border-slate-600 text-slate-600'}`}>
                           &gt;1Y
                        </div>
                        <ArrowRight size={14} className="text-slate-600" />
                        <div className={`w-8 h-8 rounded border flex items-center justify-center ${isShortTerm ? 'border-cyan-500 bg-cyan-950/30 text-cyan-400' : 'border-slate-600 text-slate-600'}`}>
                           &lt;1Y
                        </div>
                        <div className="ml-auto text-xs font-mono text-slate-400">
                           Duration: <span className="text-slate-200">{deal.durationMonths}m</span>
                        </div>
                     </div>
                  </div>

                  {/* Methodology Details Expanded */}
                  <div className="space-y-3 rounded-lg border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] p-3">
                     <div className="flex items-center justify-between border-b border-[color:var(--nfq-border-ghost)] pb-2">
                        <div className="flex items-center gap-2">
                           <Settings size={12} className="text-cyan-500" />
                           <span className="text-xs font-bold uppercase text-[color:var(--nfq-text-secondary)]">{t.configurationDetected}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{deal.businessLine || 'N/A'}</Badge>
                     </div>

                     <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                           <span className="nfq-label text-[10px]">{t.baseRateMethod}</span>
                           <div className="rounded border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-highest)] px-2 py-1 text-xs text-[color:var(--nfq-text-primary)]">
                              {matchedMethod}
                           </div>
                        </div>
                        <div className="space-y-1">
                           <span className="nfq-label text-[10px]">{t.liquidityPremium}</span>
                           <div className="rounded border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-highest)] px-2 py-1 text-xs text-[color:var(--nfq-text-primary)]">
                              Lookup Table (Std)
                           </div>
                        </div>
                     </div>

                     <div className="space-y-1">
                        <span className="nfq-label text-[10px]">{t.adjustmentsAndCosts}</span>
                        <div className="grid grid-cols-3 gap-1">
                           <div className="rounded border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-input)] p-1.5 text-center">
                              <div className="text-[9px] text-[color:var(--nfq-text-muted)]">Op. Cost</div>
                              <div className="text-xs font-mono text-[color:var(--nfq-text-secondary)]">{deal.operationalCostBps} bps</div>
                           </div>
                           <div className="rounded border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-input)] p-1.5 text-center">
                              <div className="text-[9px] text-[color:var(--nfq-text-muted)]">Cap. Chg</div>
                              <div className="text-xs font-mono text-[color:var(--nfq-text-secondary)]">{deal.capitalRatio}%</div>
                           </div>
                           <div className="rounded border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-input)] p-1.5 text-center">
                              <div className="text-[9px] text-[color:var(--nfq-text-muted)]">ESG</div>
                              <div className="text-xs font-mono text-[color:var(--nfq-text-secondary)]">{deal.transitionRisk}</div>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="mt-auto pt-4">
                     <div className="flex items-center gap-2 mb-2">
                        <Layers size={14} className="text-slate-500" />
                        <span className="text-[10px] font-bold uppercase text-slate-500">{t.activeYieldCurveSource}</span>
                     </div>
                     <div className="flex items-center justify-between rounded border border-cyan-500/20 bg-cyan-500/10 p-2 font-mono text-xs text-cyan-400">
                        <span>USD.SOFR.OIS</span>
                        <span className="text-[10px] opacity-70">Live (14ms)</span>
                     </div>
                  </div>
               </div>
            )}
         </div>
      </Panel>
   );
};

export default MethodologyVisualizer;
