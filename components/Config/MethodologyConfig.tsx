
import React, { useState } from 'react';
import { GitBranch, ShieldCheck, Zap, Database, Filter, Plus, Save, Trash2, Edit3, Settings, Users, Droplets, Target, LayoutDashboard } from 'lucide-react';
import { Panel, Badge, Button } from '../ui/LayoutComponents';
import { GeneralRule, ApprovalMatrixConfig, ProductDefinition, BusinessUnit, ClientEntity, UserProfile } from '../../types';

interface Props {
   mode?: 'METHODOLOGY' | 'SYS_CONFIG';
   rules: GeneralRule[];
   setRules: React.Dispatch<React.SetStateAction<GeneralRule[]>>;
   approvalMatrix: ApprovalMatrixConfig;
   setApprovalMatrix: (m: ApprovalMatrixConfig) => void;
   products: ProductDefinition[];
   setProducts: React.Dispatch<React.SetStateAction<ProductDefinition[]>>;
   businessUnits: BusinessUnit[];
   setBusinessUnits: React.Dispatch<React.SetStateAction<BusinessUnit[]>>;
   clients: ClientEntity[];
   setClients: React.Dispatch<React.SetStateAction<ClientEntity[]>>;
   ftpRateCards: any[];
   setFtpRateCards: React.Dispatch<React.SetStateAction<any[]>>;
   transitionGrid: any[];
   setTransitionGrid: React.Dispatch<React.SetStateAction<any[]>>;
   physicalGrid: any[];
   setPhysicalGrid: React.Dispatch<React.SetStateAction<any[]>>;
   user: UserProfile | null;
}

export const MethodologyConfig: React.FC<Props> = ({
   mode = 'METHODOLOGY',
   rules,
   setRules,
   approvalMatrix,
   setApprovalMatrix,
   products,
   businessUnits,
   clients,
   user
}) => {
   const [activeTab, setActiveTab] = useState<'RULES' | 'ESG' | 'GOVERNANCE' | 'MASTERDATA'>(
      mode === 'METHODOLOGY' ? 'RULES' : 'GOVERNANCE'
   );

   return (
      <div className="flex flex-col h-full space-y-4">
         {/* Configuration Hub Tabs */}
         <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-fit">
            {mode === 'METHODOLOGY' && (
               <>
                  <button
                     onClick={() => setActiveTab('RULES')}
                     className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'RULES' ? 'bg-white dark:bg-slate-800 text-cyan-500 shadow-sm border border-slate-200 dark:border-slate-700' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                     <GitBranch size={16} /> General Rules
                  </button>
                  <button
                     onClick={() => setActiveTab('ESG')}
                     className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'ESG' ? 'bg-white dark:bg-slate-800 text-emerald-500 shadow-sm border border-slate-200 dark:border-slate-700' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                     <Droplets size={16} /> ESG Rate Cards
                  </button>
               </>
            )}
            <button
               onClick={() => setActiveTab('GOVERNANCE')}
               className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'GOVERNANCE' ? 'bg-white dark:bg-slate-800 text-indigo-500 shadow-sm border border-slate-200 dark:border-slate-700' : 'text-slate-500 hover:text-slate-300'}`}
            >
               <ShieldCheck size={16} /> Corporate Governance
            </button>
            <button
               onClick={() => setActiveTab('MASTERDATA')}
               className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'MASTERDATA' ? 'bg-white dark:bg-slate-800 text-amber-500 shadow-sm border border-slate-200 dark:border-slate-700' : 'text-slate-500 hover:text-slate-300'}`}
            >
               <Database size={16} /> Master Data
            </button>
         </div>

         <div className="flex-1 overflow-hidden">
            {activeTab === 'RULES' && (
               <Panel title="Methodological Routing Matrix" className="h-full flex flex-col bg-white dark:bg-[#0a0a0a]">
                  <div className="flex-1 overflow-auto mt-4 pr-2 custom-scrollbar">
                     <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-white dark:bg-[#0a0a0a] z-10">
                           <tr className="border-b border-slate-800 text-[10px] text-slate-500 font-black uppercase tracking-widest">
                              <th className="py-3 px-4">Entity / Product</th>
                              <th className="py-3 px-4">Base Method</th>
                              <th className="py-3 px-4">Spread Formula</th>
                              <th className="py-3 px-4">Ref. Curve</th>
                              <th className="py-3 px-4 text-right">Actions</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                           {rules.map(rule => (
                              <tr key={rule.id} className="text-xs hover:bg-slate-900/40 transition-colors group">
                                 <td className="py-4 px-4">
                                    <div className="font-bold text-slate-200">{rule.product}</div>
                                    <div className="text-[10px] text-slate-500">{rule.businessUnit} • {rule.segment}</div>
                                 </td>
                                 <td className="py-4 px-4">
                                    <Badge variant="default">{rule.baseMethod}</Badge>
                                    <div className="text-[10px] text-slate-500 mt-1 font-mono">{rule.baseReference}</div>
                                 </td>
                                 <td className="py-4 px-4 font-mono text-cyan-400">
                                    {rule.spreadMethod}
                                 </td>
                                 <td className="py-4 px-4">
                                    <div className="flex items-center gap-2">
                                       <Settings size={12} className="text-slate-500" />
                                       <span className="font-mono text-[10px]">{rule.liquidityReference}</span>
                                    </div>
                                 </td>
                                 <td className="py-4 px-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="flex justify-end gap-1">
                                       <button className="p-1.5 hover:bg-slate-800 rounded text-slate-400"><Edit3 size={14} /></button>
                                       <button className="p-1.5 hover:bg-red-950 text-red-500 rounded"><Trash2 size={14} /></button>
                                    </div>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </Panel>
            )}

            {activeTab === 'GOVERNANCE' && (
               <div className="grid grid-cols-2 gap-4 h-full">
                  <Panel title="Pricing Approval Workflow" className="bg-white dark:bg-[#0a0a0a]">
                     <div className="space-y-6 mt-4">
                        <div className="p-4 bg-indigo-950/20 border border-indigo-900/50 rounded-xl">
                           <h6 className="text-xs font-bold text-indigo-400 mb-3 flex items-center gap-2">
                              <ShieldCheck size={14} /> RAROC Threshold Strategy
                           </h6>
                           <div className="space-y-4">
                              <div>
                                 <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                    <span>AUTO-APPROVAL THRESHOLD</span>
                                    <span className="font-mono text-indigo-400">{approvalMatrix.autoApprovalThreshold}%</span>
                                 </div>
                                 <input type="range" min="5" max="25" step="0.5" value={approvalMatrix.autoApprovalThreshold} className="w-full accent-indigo-500" onChange={(e) => setApprovalMatrix({ ...approvalMatrix, autoApprovalThreshold: parseFloat(e.target.value) })} />
                              </div>
                              <div>
                                 <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                    <span>L1 MANAGER ESCALATION</span>
                                    <span className="font-mono text-indigo-400">{approvalMatrix.l1Threshold}%</span>
                                 </div>
                                 <input type="range" min="0" max="15" step="0.5" value={approvalMatrix.l1Threshold} className="w-full accent-indigo-500" onChange={(e) => setApprovalMatrix({ ...approvalMatrix, l1Threshold: parseFloat(e.target.value) })} />
                              </div>
                           </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded border border-slate-800">
                           <Info size={16} className="text-indigo-400 mt-0.5" />
                           <p className="text-[10px] text-slate-400 leading-relaxed italic">
                              "Thresholds are cross-referenced with the business line's Hurdle Rate. Automatic rejection applies if RAROC is below 0% or the technical floor."
                           </p>
                        </div>
                     </div>
                  </Panel>

                  <Panel title="Audit Level Assignments" className="bg-white dark:bg-[#0a0a0a]">
                     <div className="space-y-3 mt-4">
                        {[
                           { level: 'Tier 1', role: 'Treasury Analyst', icon: Filter },
                           { level: 'Tier 2', role: 'Head of ALM', icon: Target },
                           { level: 'Tier 3', role: 'Pricing Committee', icon: Users },
                        ].map((tier, i) => (
                           <div key={i} className="flex items-center justify-between p-3 bg-slate-900/30 border border-slate-800 rounded-lg">
                              <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 bg-indigo-500/10 rounded flex items-center justify-center text-indigo-400">
                                    <tier.icon size={16} />
                                 </div>
                                 <div>
                                    <div className="text-xs font-bold text-slate-200">{tier.level} Review</div>
                                    <div className="text-[10px] text-slate-500">{tier.role}</div>
                                 </div>
                              </div>
                              <Badge variant="default">Active</Badge>
                           </div>
                        ))}
                     </div>
                  </Panel>
               </div>
            )}

            {activeTab === 'MASTERDATA' && (
               <div className="grid grid-cols-3 gap-4 h-full">
                  <Panel title="Entities & Clients" className="bg-white dark:bg-[#0a0a0a]">
                     <div className="space-y-2 mt-4 max-h-[400px] overflow-auto pr-2 custom-scrollbar">
                        {clients.map(c => (
                           <div key={c.id} className="p-2 border border-slate-800 rounded flex justify-between items-center group">
                              <span className="text-xs font-medium text-slate-300">{c.name}</span>
                              <Badge variant="default">{c.rating}</Badge>
                           </div>
                        ))}
                     </div>
                  </Panel>

                  <Panel title="Business Units" className="bg-white dark:bg-[#0a0a0a]">
                     <div className="space-y-2 mt-4">
                        {businessUnits.map(bu => (
                           <div key={bu.id} className="p-2 border border-slate-800 rounded flex items-center gap-2">
                              <LayoutDashboard size={12} className="text-slate-500" />
                              <span className="text-xs text-slate-300">{bu.name}</span>
                           </div>
                        ))}
                     </div>
                  </Panel>

                  <Panel title="Product Catalog" className="bg-white dark:bg-[#0a0a0a]">
                     <div className="space-y-2 mt-4">
                        {products.map(p => (
                           <div key={p.id} className="p-2 border border-slate-800 rounded flex justify-between items-center">
                              <span className="text-xs text-slate-300">{p.name}</span>
                              <span className="text-[10px] text-slate-500 font-mono italic">{p.category}</span>
                           </div>
                        ))}
                     </div>
                  </Panel>
               </div>
            )}
         </div>
      </div>
   );
};

export default MethodologyConfig;
