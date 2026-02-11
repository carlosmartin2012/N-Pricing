import React from 'react';
import { Transaction } from '../../types';
import { Panel, Badge } from '../ui/LayoutComponents';
import { ArrowRight, GitBranch, Layers, Zap } from 'lucide-react';

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

          <div className="border-t border-slate-700/50"></div>

          {/* Active Method Card */}
          <div className="bg-slate-950 border border-cyan-500/50 rounded p-4 relative overflow-hidden shadow-[0_0_15px_rgba(34,211,238,0.1)]">
             <div className="absolute top-0 right-0 p-2">
                <Zap size={16} className="text-cyan-400 fill-cyan-400 animate-pulse" />
             </div>
             
             <h4 className="text-xs text-cyan-400 font-bold uppercase mb-1">Active Methodology</h4>
             <h2 className="text-xl text-white font-medium tracking-tight mb-3">{matchedMethod}</h2>
             
             <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
                <div className="flex flex-col">
                   <span>CURVE INTERPOLATION</span>
                   <span className="text-slate-200">Cubic Spline</span>
                </div>
                <div className="flex flex-col">
                   <span>LIQUIDITY ADJ.</span>
                   <span className="text-slate-200">{deal.productType.includes('LOAN') ? 'Ask Spread' : 'Bid Spread'}</span>
                </div>
                <div className="flex flex-col">
                   <span>RISK WEIGHT</span>
                   <span className="text-slate-200">{isHighValue ? 'Custom' : 'Standard'}</span>
                </div>
                <div className="flex flex-col">
                   <span>LEDGER</span>
                   <span className="text-slate-200">Accrual</span>
                </div>
             </div>
          </div>
          
          <div className="mt-auto">
             <div className="flex items-center gap-2 mb-2">
                 <Layers size={14} className="text-slate-500" />
                 <span className="text-[10px] font-bold uppercase text-slate-500">Yield Curve Source</span>
             </div>
             <div className="text-xs text-slate-300 bg-slate-950 p-2 border border-slate-800 rounded font-mono">
                USD.LIBOR.SWAP + 18bps (Spread)
             </div>
          </div>

        </div>
      </div>
    </Panel>
  );
};

export default MethodologyVisualizer;