import React from 'react';
import { Transaction } from '../../types';
import { Panel, Badge } from '../ui/LayoutComponents';
import { ArrowRight, GitBranch, Layers, Zap, Settings } from 'lucide-react';

interface Props {
   deal: Transaction;
   matchedMethod: string;
}

const MethodologyVisualizer: React.FC<Props> = ({ deal, matchedMethod }) => {

   // Visual logic helpers
   const isShortTerm = deal.durationMonths < 12;
   const isHighValue = deal.amount > 10000000;

   return (
      <Panel title="Methodology Logic Engine" className="h-full bg-slate-850/50">
         <div className="p-4 flex flex-col h-full relative overflow-hidden">

            {/* Background Grid FX */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
               style={{ backgroundImage: 'radial-gradient(circle, #22d3ee 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
            </div>

            <div className="relative z-10 flex flex-col space-y-6">

               {/* Active Rules Flow */}
               <div className="flex flex-col space-y-2">
                  <div className="text-[10px] uppercase text-slate-500 font-bold tracking-widest flex items-center gap-2">
                     <GitBranch size={12} /> Decision Tree
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
               <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                     <div className="flex items-center gap-2">
                        <Settings size={12} className="text-cyan-500" />
                        <span className="text-xs font-bold text-slate-300 uppercase">Configuration Detected</span>
                     </div>
                     <Badge variant="outline" className="text-[10px]">{deal.businessLine || 'N/A'}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                     <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">Base Rate Method</span>
                        <div className="text-xs text-white bg-slate-800 px-2 py-1 rounded border border-slate-700">
                           {matchedMethod}
                        </div>
                     </div>
                     <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">Liquidity Premium</span>
                        <div className="text-xs text-white bg-slate-800 px-2 py-1 rounded border border-slate-700">
                           Lookup Table (Std)
                        </div>
                     </div>
                  </div>

                  <div className="space-y-1">
                     <span className="text-[10px] text-slate-500 uppercase font-semibold">Adjustments & Costs</span>
                     <div className="grid grid-cols-3 gap-1">
                        <div className="bg-slate-950 p-1.5 rounded border border-slate-800 text-center">
                           <div className="text-[9px] text-slate-500">Op. Cost</div>
                           <div className="text-xs font-mono text-slate-300">{deal.operationalCostBps} bps</div>
                        </div>
                        <div className="bg-slate-950 p-1.5 rounded border border-slate-800 text-center">
                           <div className="text-[9px] text-slate-500">Cap. Chg</div>
                           <div className="text-xs font-mono text-slate-300">{deal.capitalRatio}%</div>
                        </div>
                        <div className="bg-slate-950 p-1.5 rounded border border-slate-800 text-center">
                           <div className="text-[9px] text-slate-500">ESG</div>
                           <div className="text-xs font-mono text-slate-300">{deal.transitionRisk}</div>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="mt-auto pt-4">
                  <div className="flex items-center gap-2 mb-2">
                     <Layers size={14} className="text-slate-500" />
                     <span className="text-[10px] font-bold uppercase text-slate-500">Active Yield Curve Source</span>
                  </div>
                  <div className="text-xs text-cyan-400 bg-cyan-950/20 p-2 border border-cyan-900/50 rounded font-mono flex items-center justify-between">
                     <span>USD.SOFR.OIS</span>
                     <span className="text-[10px] opacity-70">Live (14ms)</span>
                  </div>
               </div>
            </div>
         </div>
      </Panel>
   );
};

export default MethodologyVisualizer;