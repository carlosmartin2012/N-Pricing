
import React, { useState } from 'react';
import { Panel, Badge, InputGroup, TextInput, SelectInput } from '../ui/LayoutComponents';
import { Drawer } from '../ui/Drawer';
import { MOCK_BEHAVIOURAL_MODELS } from '../../constants';
import { BehaviouralModel, ReplicationTranche } from '../../types';
import { Search, Plus, Edit, Trash2, Activity, TrendingDown, Layers, BarChart, X, Split, GitMerge, FileSpreadsheet, Upload } from 'lucide-react';
import { downloadTemplate, parseExcel } from '../../utils/excelUtils';

import { storage } from '../../utils/storage';

interface Props {
   models: BehaviouralModel[];
   setModels: React.Dispatch<React.SetStateAction<BehaviouralModel[]>>;
   user: any;
}

const BehaviouralModels: React.FC<Props> = ({ models, setModels, user }) => {
   const [activeTab, setActiveTab] = useState<'NMD_Replication' | 'Prepayment_CPR'>('NMD_Replication');

   const [isDrawerOpen, setDrawerOpen] = useState(false);
   const [editingModel, setEditingModel] = useState<Partial<BehaviouralModel> | null>(null);

   const filteredModels = models.filter(m => m.type === activeTab);

   const handleAddNew = () => {
      setEditingModel({
         id: `MOD-${Math.floor(Math.random() * 1000)}`,
         name: '',
         type: activeTab,
         nmdMethod: 'Caterpillar', // Defaulting to Caterpillar as requested
         description: '',
         // Default NMD
         coreRatio: 50,
         decayRate: 0, // Deprecated/Hidden in UI favoring Caterpillar
         betaFactor: 0.5,
         // Default Prepay
         cpr: 5,
         penaltyExempt: 0,
         // Default Caterpillar Profile
         replicationProfile: [
            { term: '1M', weight: 30, spread: 0 },
            { term: '3M', weight: 20, spread: 5 },
            { term: '1Y', weight: 50, spread: 10 }
         ]
      });
      setDrawerOpen(true);
   };

   const handleEdit = (model: BehaviouralModel) => {
      setEditingModel({ ...model });
      setDrawerOpen(true);
   };

   const handleSave = async () => {
      if (!editingModel || !editingModel.name || !editingModel.description) {
         alert('Please provide a name and description for the model.');
         return;
      }

      if (editingModel.id) {
         try {
            console.log('Attempting to save model:', editingModel);
            const exists = models.find(m => m.id === editingModel.id);

            // Ensure all critical fields are present and valid
            const finalModel: BehaviouralModel = {
               id: editingModel.id,
               name: editingModel.name.trim(),
               type: (editingModel.type || activeTab) as any,
               nmdMethod: editingModel.nmdMethod || 'Caterpillar',
               description: editingModel.description?.trim() || '',
               coreRatio: isNaN(Number(editingModel.coreRatio)) ? 50 : Number(editingModel.coreRatio),
               decayRate: isNaN(Number(editingModel.decayRate)) ? 0 : Number(editingModel.decayRate),
               betaFactor: isNaN(Number(editingModel.betaFactor)) ? 0.5 : Number(editingModel.betaFactor),
               cpr: isNaN(Number(editingModel.cpr)) ? 5 : Number(editingModel.cpr),
               penaltyExempt: isNaN(Number(editingModel.penaltyExempt)) ? 0 : Number(editingModel.penaltyExempt),
               replicationProfile: editingModel.replicationProfile && editingModel.replicationProfile.length > 0
                  ? editingModel.replicationProfile
                  : [
                     { term: '1M', weight: 40, spread: 0 },
                     { term: '3M', weight: 30, spread: 5 },
                     { term: '1Y', weight: 30, spread: 10 }
                  ]
            };

            const savedRecord = await storage.saveBehaviouralModel(finalModel);

            // Optimistic Update: Use the record returned from database if available
            setModels(prev => {
               const recordToUse = savedRecord || finalModel;
               const existingIndex = prev.findIndex(m => m.id === recordToUse.id);
               if (existingIndex >= 0) {
                  const next = [...prev];
                  next[existingIndex] = recordToUse;
                  return next;
               }
               return [recordToUse, ...prev];
            });

            await storage.addAuditEntry({
               userEmail: user?.email || 'unknown',
               userName: user?.name || 'Unknown User',
               action: exists ? 'UPDATE_MODEL' : 'CREATE_MODEL',
               module: 'BEHAVIOURAL',
               description: `${exists ? 'Updated' : 'Created'} behavioural model: ${finalModel.name}`
            });

            alert(`Modelo "${finalModel.name}" guardado correctamente.`);
            setDrawerOpen(false);
         } catch (error) {
            console.error('CRITICAL: Error saving model:', error);
            alert(`Error al guardar el modelo: ${error instanceof Error ? error.message : 'Unknown error'}`);
         }
      }
   }

   const handleDownloadTemplate = () => {
      downloadTemplate('BEHAVIOURAL', `Behavioural_Model_Template_${activeTab}`);
   };

   const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
         const data = await parseExcel(file);
         const newModels: BehaviouralModel[] = data.map(row => ({
            id: row.ID || row.id || `MOD-IMP-${Math.floor(Math.random() * 1000)}`,
            name: row.Name || row.name || 'Imported Model',
            type: (row.Type || row.type || activeTab) as any,
            description: row.Description || row.description || '',
            coreRatio: parseFloat(row.CoreRatio || row.coreRatio) || 50,
            decayRate: parseFloat(row.DecayRate || row.decayRate) || 0,
            betaFactor: parseFloat(row.BetaFactor || row.betaFactor) || 0.5,
            cpr: parseFloat(row.CPR || row.cpr) || 5,
            penaltyExempt: parseFloat(row.PenaltyExempt || row.penaltyExempt) || 0,
            replicationProfile: row.ReplicationProfile ? JSON.parse(row.ReplicationProfile) : []
         }));

         for (const model of newModels) {
            await storage.saveBehaviouralModel(model);
         }

         await storage.addAuditEntry({
            userEmail: user?.email || 'unknown',
            userName: user?.name || 'Unknown User',
            action: 'IMPORT_MODELS',
            module: 'BEHAVIOURAL',
            description: `Imported ${newModels.length} behavioural models from Excel.`
         });
      }
   };

   const handleDelete = async (id: string) => {
      if (window.confirm('Are you sure you want to delete this model?')) {
         await storage.deleteBehaviouralModel(id);

         await storage.addAuditEntry({
            userEmail: user?.email || 'unknown',
            userName: user?.name || 'Unknown User',
            action: 'DELETE_MODEL',
            module: 'BEHAVIOURAL',
            description: `Deleted behavioural model: ${id}`
         });
      }
   }

   // --- Tranche Helpers for Caterpillar ---
   const handleTrancheChange = (index: number, field: keyof ReplicationTranche, value: any) => {
      if (editingModel?.replicationProfile) {
         const updatedProfile = [...editingModel.replicationProfile];
         updatedProfile[index] = { ...updatedProfile[index], [field]: value };
         setEditingModel({ ...editingModel, replicationProfile: updatedProfile });
      }
   }

   const addTranche = () => {
      if (editingModel?.replicationProfile) {
         setEditingModel({ ...editingModel, replicationProfile: [...editingModel.replicationProfile, { term: '1Y', weight: 0, spread: 0 }] });
      } else {
         setEditingModel({ ...editingModel, replicationProfile: [{ term: '1Y', weight: 100, spread: 0 }] });
      }
   }

   const removeTranche = (index: number) => {
      if (editingModel?.replicationProfile) {
         const updatedProfile = editingModel.replicationProfile.filter((_, i) => i !== index);
         setEditingModel({ ...editingModel, replicationProfile: updatedProfile });
      }
   }

   const totalWeight = editingModel?.replicationProfile?.reduce((sum, t) => sum + t.weight, 0) || 0;

   return (
      <Panel title="Behavioural Models Engine" className="h-full">
         <div className="flex flex-col h-full">

            {/* Header Tabs */}
            <div className="flex border-b border-slate-700 bg-slate-900 overflow-x-auto">
               <button
                  onClick={() => setActiveTab('NMD_Replication')}
                  className={`flex-1 min-w-[150px] px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === 'NMD_Replication' ? 'border-purple-500 text-white bg-slate-800/50' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
               >
                  <div className="flex items-center gap-2 justify-center">
                     <GitMerge size={14} className="text-purple-500" /> NMD (Core & Caterpillar)
                  </div>
               </button>
               <button
                  onClick={() => setActiveTab('Prepayment_CPR')}
                  className={`flex-1 min-w-[150px] px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === 'Prepayment_CPR' ? 'border-amber-500 text-white bg-slate-800/50' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
               >
                  <div className="flex items-center gap-2 justify-center">
                     <TrendingDown size={14} className="text-amber-500" /> Prepayment Models
                  </div>
               </button>
            </div>

            {/* Toolbar */}
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
               <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                     type="text"
                     placeholder="Search models..."
                     className="bg-slate-950 border border-slate-700 rounded pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 w-64"
                  />
               </div>
               <div className="flex gap-2">
                  <button onClick={handleDownloadTemplate} className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 text-amber-400 rounded border border-slate-700 text-xs hover:bg-slate-700" title="Download Template">
                     <FileSpreadsheet size={12} /> Template
                  </button>
                  <label className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 text-cyan-400 rounded border border-slate-700 text-xs hover:bg-slate-700 cursor-pointer">
                     <Upload size={12} /> Import
                     <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleImport} />
                  </label>
                  <button
                     onClick={handleAddNew}
                     className="flex items-center gap-1 px-3 py-1.5 bg-cyan-900/40 text-cyan-400 rounded border border-cyan-800 text-xs hover:bg-cyan-900/50 font-bold"
                  >
                     <Plus size={12} /> Create Model
                  </button>
               </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-auto p-4">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredModels.map(model => (
                     <div key={model.id} className="bg-slate-950 border border-slate-800 p-4 rounded hover:border-slate-600 transition-colors group relative flex flex-col">
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                           <button onClick={() => handleEdit(model)} className="text-slate-400 hover:text-cyan-400"><Edit size={14} /></button>
                           <button onClick={() => handleDelete(model.id)} className="text-slate-400 hover:text-red-400"><Trash2 size={14} /></button>
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                           <div className={`w-2 h-8 rounded-sm ${model.type === 'Prepayment_CPR' ? 'bg-amber-500' : 'bg-purple-500'}`}></div>
                           <div>
                              <h4 className="text-sm font-bold text-slate-200">{model.name}</h4>
                              <span className="text-[10px] text-cyan-500 font-mono">{model.id}</span>
                           </div>
                        </div>

                        <p className="text-xs text-slate-500 mb-4 h-8 overflow-hidden">{model.description}</p>

                        <div className="bg-slate-900 rounded p-3 grid grid-cols-2 gap-y-3 gap-x-2 border border-slate-800 flex-1">
                           {/* NMD View - Shows both Core/Beta AND Caterpillar */}
                           {model.type === 'NMD_Replication' && (
                              <>
                                 {/* Section 1: Core Parameters */}
                                 <div className="col-span-2 border-b border-slate-800 pb-2 mb-1">
                                    <div className="text-[9px] text-slate-400 uppercase font-bold mb-2">Core & Sensitivity</div>
                                    <div className="flex justify-between items-center">
                                       <div>
                                          <div className="text-[9px] text-slate-500">Core Ratio</div>
                                          <div className="text-sm font-mono text-emerald-400">{model.coreRatio}%</div>
                                       </div>
                                       <div className="text-right">
                                          <div className="text-[9px] text-slate-500">Beta</div>
                                          <div className="text-sm font-mono text-cyan-400">{model.betaFactor}</div>
                                       </div>
                                    </div>
                                 </div>

                                 {/* Section 2: Caterpillar Profile Summary */}
                                 <div className="col-span-2 mt-1">
                                    <div className="flex justify-between items-end mb-1">
                                       <span className="text-[9px] text-slate-400 uppercase font-bold">Replication Profile</span>
                                       <span className="text-[9px] text-slate-500">{model.replicationProfile?.length || 0} Tranches</span>
                                    </div>
                                    <div className="space-y-1">
                                       {model.replicationProfile?.slice(0, 2).map((t, i) => (
                                          <div key={i} className="flex justify-between text-[10px] font-mono">
                                             <span className="text-slate-300">{t.term}</span>
                                             <div className="flex items-center gap-2">
                                                <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                   <div className="h-full bg-purple-500" style={{ width: `${t.weight}%` }}></div>
                                                </div>
                                                <span className="text-purple-400 w-6 text-right">{t.weight}%</span>
                                             </div>
                                          </div>
                                       ))}
                                       {(model.replicationProfile?.length || 0) > 2 && (
                                          <div className="text-[9px] text-slate-600 text-center pt-1">+ {model.replicationProfile!.length - 2} more tranches</div>
                                       )}
                                    </div>
                                 </div>
                              </>
                           )}

                           {/* Prepayment View */}
                           {model.type === 'Prepayment_CPR' && (
                              <>
                                 <div>
                                    <div className="text-[9px] text-slate-500 uppercase font-bold">CPR (Speed)</div>
                                    <div className="text-sm font-mono text-amber-400">{model.cpr}%</div>
                                 </div>
                                 <div>
                                    <div className="text-[9px] text-slate-500 uppercase font-bold">Penalty Free</div>
                                    <div className="text-sm font-mono text-white">{model.penaltyExempt}%</div>
                                 </div>
                                 <div className="col-span-2">
                                    <div className="text-[9px] text-slate-500 uppercase font-bold">Prepayment Curve</div>
                                    <div className="h-6 flex items-end gap-0.5 mt-1">
                                       {[2, 3, 4, 5, 5, 5, 5, 4, 3, 2].map((h, i) => (
                                          <div key={i} className="flex-1 bg-amber-500/30 border-t border-amber-500" style={{ height: `${h * 20}%` }}></div>
                                       ))}
                                    </div>
                                 </div>
                              </>
                           )}
                        </div>
                     </div>
                  ))}
               </div>
            </div>

            {/* Edit Drawer */}
            <Drawer
               isOpen={isDrawerOpen}
               onClose={() => setDrawerOpen(false)}
               title={editingModel?.id ? `Edit Model: ${editingModel.id}` : 'New Model Config'}
               footer={
                  <div className="flex justify-end gap-2">
                     <button onClick={() => setDrawerOpen(false)} className="px-4 py-2 text-xs text-slate-400 hover:text-white">Cancel</button>
                     <button onClick={handleSave} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded">Save Model</button>
                  </div>
               }
            >
               {editingModel && (
                  <div className="space-y-6">
                     <InputGroup label="Model Type">
                        <SelectInput
                           value={editingModel.type}
                           onChange={(e) => setEditingModel({ ...editingModel, type: e.target.value as any })}
                        >
                           <option value="NMD_Replication">NMD (Core & Caterpillar)</option>
                           <option value="Prepayment_CPR">Prepayment (CPR)</option>
                        </SelectInput>
                        <p className="text-[9px] text-slate-500 mt-1">Select the behavioural methodology</p>
                     </InputGroup>

                     <InputGroup label="Model Name">
                        <TextInput
                           value={editingModel.name}
                           onChange={(e) => setEditingModel({ ...editingModel, name: e.target.value })}
                           placeholder="e.g. Retail Savings"
                        />
                     </InputGroup>
                     <InputGroup label="Description">
                        <TextInput
                           value={editingModel.description}
                           onChange={(e) => setEditingModel({ ...editingModel, description: e.target.value })}
                        />
                     </InputGroup>

                     <div className="border-t border-slate-800 pt-4">
                        <h4 className="text-xs font-bold text-cyan-400 uppercase mb-4">Parameters</h4>

                        {/* NMD Configuration: Two sections as requested */}
                        {editingModel.type === 'NMD_Replication' && (
                           <div className="space-y-6">

                              {/* SECTION 1: Core & Beta */}
                              <div className="bg-slate-900/50 p-3 rounded border border-slate-800">
                                 <h5 className="text-[10px] text-emerald-400 uppercase font-bold mb-3 flex items-center gap-2">
                                    <Activity size={12} /> Core & Sensitivity
                                 </h5>
                                 <div className="grid grid-cols-2 gap-4">
                                    <InputGroup label="Core Ratio (%)">
                                       <div className="relative">
                                          <TextInput
                                             type="number"
                                             value={editingModel.coreRatio}
                                             onChange={(e) => setEditingModel({ ...editingModel, coreRatio: parseFloat(e.target.value) })}
                                             className="text-emerald-400 font-bold"
                                          />
                                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
                                       </div>
                                       <p className="text-[9px] text-slate-500 mt-1">Stable volume portion</p>
                                    </InputGroup>
                                    <InputGroup label="Beta Factor (0-1)">
                                       <TextInput
                                          type="number"
                                          step="0.05"
                                          value={editingModel.betaFactor}
                                          onChange={(e) => setEditingModel({ ...editingModel, betaFactor: parseFloat(e.target.value) })}
                                          className="text-cyan-400 font-bold"
                                       />
                                       <p className="text-[9px] text-slate-500 mt-1">Rate sensitivity</p>
                                    </InputGroup>
                                 </div>
                              </div>

                              {/* SECTION 2: Caterpillar Replication */}
                              <div className="bg-slate-900/50 p-3 rounded border border-slate-800">
                                 <div className="flex justify-between items-center mb-3">
                                    <h5 className="text-[10px] text-purple-400 uppercase font-bold flex items-center gap-2">
                                       <Split size={12} /> Replication Profile (Caterpillar)
                                    </h5>
                                    <button onClick={addTranche} className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-bold border border-cyan-900/50 bg-cyan-950/30 px-2 py-1 rounded">
                                       <Plus size={10} /> Add Tranche
                                    </button>
                                 </div>

                                 <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                    {editingModel.replicationProfile?.map((tranche, idx) => (
                                       <div key={idx} className="flex gap-2 items-center bg-slate-950 p-1.5 rounded border border-slate-800">
                                          <div className="w-20 shrink-0">
                                             <label className="text-[9px] text-slate-500 block mb-0.5">Term</label>
                                             <SelectInput
                                                value={tranche.term}
                                                onChange={(e) => handleTrancheChange(idx, 'term', e.target.value)}
                                                className="w-full text-xs py-1"
                                             >
                                                <option>ON</option><option>1M</option><option>3M</option><option>6M</option>
                                                <option>1Y</option><option>2Y</option><option>3Y</option><option>5Y</option>
                                                <option>7Y</option><option>10Y</option>
                                             </SelectInput>
                                          </div>
                                          <div className="flex-1">
                                             <label className="text-[9px] text-slate-500 block mb-0.5">Weight (%)</label>
                                             <TextInput
                                                type="number"
                                                value={tranche.weight}
                                                onChange={(e) => handleTrancheChange(idx, 'weight', parseFloat(e.target.value))}
                                                className="w-full text-xs py-1 text-purple-400 font-bold"
                                             />
                                          </div>
                                          <div className="flex-1">
                                             <label className="text-[9px] text-slate-500 block mb-0.5">Spread (bps)</label>
                                             <TextInput
                                                type="number"
                                                value={tranche.spread}
                                                onChange={(e) => handleTrancheChange(idx, 'spread', parseFloat(e.target.value))}
                                                className="w-full text-xs py-1"
                                             />
                                          </div>
                                          <button onClick={() => removeTranche(idx)} className="text-slate-600 hover:text-red-400 p-1 mt-3"><X size={14} /></button>
                                       </div>
                                    ))}
                                    {(!editingModel.replicationProfile || editingModel.replicationProfile.length === 0) && (
                                       <div className="text-center p-4 border border-dashed border-slate-700 rounded text-[10px] text-slate-500">
                                          No replication tranches defined.
                                       </div>
                                    )}
                                 </div>

                                 <div className={`mt-3 p-2 rounded text-xs text-center font-bold border ${totalWeight === 100 ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900' : 'bg-red-950/30 text-red-400 border-red-900'}`}>
                                    Total Weight: {totalWeight}%
                                 </div>
                              </div>

                           </div>
                        )}

                        {editingModel.type === 'Prepayment_CPR' && (
                           <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                 <InputGroup label="Constant Prep. Rate (CPR %)">
                                    <TextInput
                                       type="number"
                                       value={editingModel.cpr}
                                       onChange={(e) => setEditingModel({ ...editingModel, cpr: parseFloat(e.target.value) })}
                                    />
                                 </InputGroup>
                                 <InputGroup label="Penalty Free Allowance (%)">
                                    <TextInput
                                       type="number"
                                       value={editingModel.penaltyExempt}
                                       onChange={(e) => setEditingModel({ ...editingModel, penaltyExempt: parseFloat(e.target.value) })}
                                    />
                                 </InputGroup>
                              </div>
                              <InputGroup label="Curve Type">
                                 <SelectInput>
                                    <option>Constant (CPR)</option>
                                    <option>PSA Standard</option>
                                    <option>Custom Seasonality</option>
                                 </SelectInput>
                              </InputGroup>
                           </div>
                        )}
                     </div>
                  </div>
               )}
            </Drawer>

         </div>
      </Panel>
   );
};

export default BehaviouralModels;
