
import React, { useState } from 'react';
import { GitMerge, TrendingDown, Info, Save, Plus, Trash2, ChartBar, LineChart, Activity } from 'lucide-react';
import { Panel, Badge, Button } from '../ui/LayoutComponents';
import { translations } from '../../translations';
import { BehaviouralModel, UserProfile } from '../../types';

interface Props {
   models: BehaviouralModel[];
   setModels: React.Dispatch<React.SetStateAction<BehaviouralModel[]>>;
   user: UserProfile | null;
}

export const BehaviouralModels: React.FC<Props> = ({ models, setModels, user }) => {
   const [activeTab, setActiveTab] = useState<'NMD' | 'PREPAYMENT'>('NMD');
   const [selectedModel, setSelectedModel] = useState<BehaviouralModel | null>(models[0] || null);

   const nmdModels = models.filter(m => m.type === 'NMD_Replication');
   const prepaymentModels = models.filter(m => m.type === 'Prepayment_CPR');

   return (
      <div className="flex flex-col h-full space-y-4">
         {/* Method Selection Tabs */}
         <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-fit">
            <button
               onClick={() => { setActiveTab('NMD'); setSelectedModel(nmdModels[0]); }}
               className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'NMD' ? 'bg-white dark:bg-slate-800 text-emerald-500 shadow-sm border border-slate-200 dark:border-slate-700' : 'text-slate-500 hover:text-slate-300'}`}
            >
               <GitMerge size={16} /> NMD / Caterpillar
            </button>
            <button
               onClick={() => { setActiveTab('PREPAYMENT'); setSelectedModel(prepaymentModels[0]); }}
               className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'PREPAYMENT' ? 'bg-white dark:bg-slate-800 text-amber-500 shadow-sm border border-slate-200 dark:border-slate-700' : 'text-slate-500 hover:text-slate-300'}`}
            >
               <TrendingDown size={16} /> Prepayment / CPR
            </button>
         </div>

         <div className="grid grid-cols-12 gap-4 flex-1">
            {/* Sidebar List */}
            <div className="col-span-3 flex flex-col space-y-2 overflow-auto">
               <div className="flex items-center justify-between px-2 mb-2">
                  <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{activeTab} Prototypes</span>
                  <button className="p-1 hover:bg-emerald-500/10 text-emerald-500 rounded transition-colors">
                     <Plus size={16} />
                  </button>
               </div>
               {(activeTab === 'NMD' ? nmdModels : prepaymentModels).map(model => (
                  <button
                     key={model.id}
                     onClick={() => setSelectedModel(model)}
                     className={`p-3 rounded-xl border text-left transition-all ${selectedModel?.id === model.id ? 'bg-emerald-500/10 border-emerald-500/50 shadow-inner' : 'bg-white dark:bg-[#0a0a0a] border-slate-200 dark:border-slate-800 hover:border-slate-700'}`}
                  >
                     <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-200">{model.name}</span>
                        <Badge variant="default">{model.id}</Badge>
                     </div>
                     <p className="text-[10px] text-slate-500 line-clamp-2">{model.description}</p>
                  </button>
               ))}
            </div>

            {/* Editor Main Content */}
            <div className="col-span-9">
               {selectedModel ? (
                  <div className="h-full flex flex-col gap-4">
                     <div className="grid grid-cols-2 gap-4">
                        <Panel title="Methodology Parameters" className="bg-white dark:bg-[#0a0a0a]">
                           <div className="space-y-4 mt-2">
                              {activeTab === 'NMD' ? (
                                 <>
                                    <div className="grid grid-cols-2 gap-4">
                                       <div>
                                          <label className="text-[10px] text-slate-500 font-bold uppercase mb-1 block">Core Ratio (%)</label>
                                          <input type="number" value={selectedModel.coreRatio} className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm font-mono text-emerald-400 focus:border-emerald-500 outline-none" />
                                       </div>
                                       <div>
                                          <label className="text-[10px] text-slate-500 font-bold uppercase mb-1 block">Beta Factor</label>
                                          <input type="number" step="0.01" value={selectedModel.betaFactor} className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm font-mono text-emerald-400 focus:border-emerald-500 outline-none" />
                                       </div>
                                    </div>
                                    <div>
                                       <label className="text-[10px] text-slate-500 font-bold uppercase mb-1 block">Decay Rate (λ)</label>
                                       <input type="number" value={selectedModel.decayRate} className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm font-mono text-emerald-400 focus:border-emerald-500 outline-none" />
                                    </div>
                                 </>
                              ) : (
                                 <>
                                    <div>
                                       <label className="text-[10px] text-slate-500 font-bold uppercase mb-1 block">Constant Prepayment Rate (CPR)</label>
                                       <div className="flex items-center gap-3">
                                          <input type="range" min="0" max="50" step="0.5" value={selectedModel.cpr} className="w-full" />
                                          <span className="text-sm font-mono font-bold text-amber-500 whitespace-nowrap">{selectedModel.cpr}%</span>
                                       </div>
                                    </div>
                                    <div>
                                       <label className="text-[10px] text-slate-500 font-bold uppercase mb-1 block">Penalty Exemption (%)</label>
                                       <input type="number" value={selectedModel.penaltyExempt} className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm font-mono text-amber-400 focus:border-amber-500 outline-none" />
                                    </div>
                                 </>
                              )}
                              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                                 <Button variant="outline" size="sm" className="text-red-500 hover:bg-red-500/10">
                                    <Trash2 size={14} /> Delete
                                 </Button>
                                 <Button variant="primary" size="sm">
                                    <Save size={14} /> Update Model
                                 </Button>
                              </div>
                           </div>
                        </Panel>

                        <Panel title="Structural Impact" className="bg-white dark:bg-[#0a0a0a]">
                           <div className="flex flex-col h-full mt-2">
                              {activeTab === 'NMD' ? (
                                 <div className="space-y-3">
                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                                       <ChartBar size={12} /> Replication Tranches
                                    </div>
                                    <div className="space-y-2">
                                       {selectedModel.replicationProfile?.map((t: any, i: number) => (
                                          <div key={i} className="flex items-center gap-3">
                                             <span className="text-[10px] font-mono text-slate-500 w-8">{t.term}</span>
                                             <div className="flex-1 h-3 bg-slate-900 rounded-full overflow-hidden flex">
                                                <div className="h-full bg-emerald-500/40" style={{ width: `${t.weight}%` }} />
                                             </div>
                                             <span className="text-[10px] font-mono text-emerald-400 w-8 text-right">{t.weight}%</span>
                                          </div>
                                       ))}
                                    </div>
                                 </div>
                              ) : (
                                 <div className="flex-1 flex flex-col justify-center items-center opacity-50">
                                    <LineChart size={48} className="mb-2 text-slate-700" />
                                    <span className="text-xs text-slate-500">Survival Probability Chart</span>
                                 </div>
                              )}
                           </div>
                        </Panel>
                     </div>

                     <div className="bg-emerald-950/20 border border-emerald-900/50 p-4 rounded-xl flex gap-4">
                        <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-lg h-fit">
                           <Activity size={24} />
                        </div>
                        <div>
                           <h5 className="text-sm font-bold text-emerald-400 mb-1">Methodological Validation</h5>
                           <p className="text-xs text-slate-400 leading-relaxed italic">
                              "This model uses the Caterpillar algorithm for stable core identification. The current calibration suggests a 95% confidence interval for core stability over a 5-year horizon based on historical volatility."
                           </p>
                        </div>
                     </div>
                  </div>
               ) : (
                  <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-800 rounded-2xl">
                     <span className="text-slate-500 text-sm">Select a prototype to begin editing</span>
                  </div>
               )}
            </div>
         </div>
      </div>
   );
};

export default BehaviouralModels;
