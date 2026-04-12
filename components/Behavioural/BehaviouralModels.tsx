
import React, { useMemo, useState } from 'react';
import { createAuditEntry } from '../../api/audit';
import { deleteBehaviouralModel, upsertBehaviouralModel } from '../../api/marketData';
import { Panel } from '../ui/LayoutComponents';
import { Drawer } from '../ui/Drawer';
import { BehaviouralModel, ReplicationTranche } from '../../types';
import { Search, Plus, TrendingDown, GitMerge, FileSpreadsheet, Upload } from 'lucide-react';
import { downloadTemplate, parseExcel } from '../../utils/excelUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { createLogger } from '../../utils/logger';
import BehaviouralModelCard from './BehaviouralModelCard';
import BehaviouralModelEditor from './BehaviouralModelEditor';
import {
   buildBehaviouralExportData,
   createDefaultBehaviouralModel,
   matchesBehaviouralSearch,
   mergeBehaviouralModels,
   normalizeBehaviouralModel,
   parseImportedBehaviouralModel,
} from './behaviouralModelUtils';

const log = createLogger('BehaviouralModels');

const BehaviouralModels: React.FC = () => {
   const { currentUser: user } = useAuth();
   const { behaviouralModels: models, setBehaviouralModels: setModels } = useData();
   const { t } = useUI();
   const [activeTab, setActiveTab] = useState<'NMD_Replication' | 'Prepayment_CPR'>('NMD_Replication');
   const [searchTerm, setSearchTerm] = useState('');

   const [isDrawerOpen, setDrawerOpen] = useState(false);
   const [editingModel, setEditingModel] = useState<Partial<BehaviouralModel> | null>(null);

   const filteredModels = useMemo(
      () => models.filter(model => model.type === activeTab && matchesBehaviouralSearch(model, searchTerm)),
      [models, activeTab, searchTerm],
   );

   const handleAddNew = () => {
      setEditingModel(createDefaultBehaviouralModel(activeTab));
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
            const exists = models.find(m => m.id === editingModel.id);
            const finalModel = normalizeBehaviouralModel(editingModel, activeTab);

            const savedRecord = await upsertBehaviouralModel(finalModel);

            // Optimistic Update: Use the record returned from database if available
            setModels(prev => mergeBehaviouralModels(prev, [savedRecord || finalModel]));

            await createAuditEntry({
               userEmail: user?.email || 'unknown',
               userName: user?.name || 'Unknown User',
               action: exists ? 'UPDATE_MODEL' : 'CREATE_MODEL',
               module: 'BEHAVIOURAL',
               description: `${exists ? 'Updated' : 'Created'} behavioural model: ${finalModel.name}`
            });

            alert(`Modelo "${finalModel.name}" guardado correctamente.`);
            setDrawerOpen(false);
         } catch (error) {
            log.error('Error saving model', {}, error instanceof Error ? error : undefined);
            alert(`Error al guardar el modelo: ${error instanceof Error ? error.message : 'Unknown error'}`);
         }
      }
   }

   const handleDownloadTemplate = async () => {
      const liveData = buildBehaviouralExportData(models);
      await downloadTemplate('BEHAVIOURAL', `Behavioural_Models_Export`, liveData);
   };

   const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
         const data = await parseExcel(file);
         const newModels: BehaviouralModel[] = data.map(row => parseImportedBehaviouralModel(row, activeTab));
         const savedModels = await Promise.all(newModels.map(model => upsertBehaviouralModel(model)));
         setModels(prev => mergeBehaviouralModels(prev, savedModels.filter(Boolean) as BehaviouralModel[]));

         await createAuditEntry({
            userEmail: user?.email || 'unknown',
            userName: user?.name || 'Unknown User',
            action: 'IMPORT_MODELS',
            module: 'BEHAVIOURAL',
            description: `Imported ${newModels.length} behavioural models from Excel.`
         });
         e.target.value = '';
      }
   };

   const handleDelete = async (id: string) => {
      if (window.confirm(t.confirmDeleteModel)) {
         // Optimistic Update
         const modelToDelete = models.find(m => m.id === id);
         setModels(prev => prev.filter(m => m.id !== id));

         try {
            await deleteBehaviouralModel(id);

            await createAuditEntry({
               userEmail: user?.email || 'unknown',
               userName: user?.name || 'Unknown User',
               action: 'DELETE_MODEL',
               module: 'BEHAVIOURAL',
               description: `Deleted behavioural model: ${modelToDelete?.name || id}`
            });
         } catch (error) {
            log.error('Error deleting model', { modelId: id }, error instanceof Error ? error : undefined);
            // Rollback if failed
            if (modelToDelete) setModels(prev => [...prev, modelToDelete]);
            alert('Failed to delete model. Please try again.');
         }
      }
   }

   // --- Tranche Helpers for Caterpillar ---
   const handleTrancheChange = (
      index: number,
      field: keyof ReplicationTranche,
      value: ReplicationTranche[keyof ReplicationTranche],
   ) => {
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
      <Panel title={t.behaviouralModelsEngine} className="h-full">
         <div className="flex flex-col h-full">

            {/* Header Tabs */}
            <div className="nfq-tab-list">
               <button
                  onClick={() => setActiveTab('NMD_Replication')}
                  className={`nfq-tab ${activeTab === 'NMD_Replication' ? 'nfq-tab--active' : ''}`}
               >
                  <div className="flex items-center gap-2 justify-center">
                     <GitMerge size={14} /> NMD (Core & Caterpillar)
                  </div>
               </button>
               <button
                  onClick={() => setActiveTab('Prepayment_CPR')}
                  className={`nfq-tab ${activeTab === 'Prepayment_CPR' ? 'nfq-tab--active' : ''}`}
               >
                  <div className="flex items-center gap-2 justify-center">
                     <TrendingDown size={14} /> {t.prepaymentModels}
                  </div>
               </button>
            </div>

            {/* Toolbar */}
            <div className="p-4 border-b border-[var(--nfq-border-ghost)] flex justify-between items-center bg-[var(--nfq-bg-surface)]">
               <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--nfq-text-muted)]" />
                  <input
                     type="text"
                     placeholder={t.searchModels}
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     className="nfq-input-field pl-9 pr-3 text-xs w-64"
                  />
               </div>
               <div className="flex gap-2">
                  <button onClick={handleDownloadTemplate} className="nfq-button nfq-button-outline text-xs text-[color:var(--nfq-warning)]" title="Download Template">
                     <FileSpreadsheet size={12} /> Template
                  </button>
                  <label className="nfq-button nfq-button-outline text-xs text-[color:var(--nfq-accent)] cursor-pointer">
                     <Upload size={12} /> Import
                     <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleImport} />
                  </label>
                  <button
                     onClick={handleAddNew}
                     className="nfq-button nfq-button-primary text-xs"
                  >
                     <Plus size={12} /> {t.createModel}
                  </button>
               </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-auto p-4">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredModels.map(model => (
                     <BehaviouralModelCard
                        key={model.id}
                        model={model}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                     />
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
                     <button onClick={() => setDrawerOpen(false)} className="px-4 py-2 text-xs text-slate-400 hover:text-white">{t.cancel}</button>
                     <button onClick={handleSave} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded">{t.saveModel}</button>
                  </div>
               }
            >
               {editingModel && (
                  <BehaviouralModelEditor
                     editingModel={editingModel}
                     totalWeight={totalWeight}
                     onChange={(updates) => setEditingModel(prev => prev ? { ...prev, ...updates } : prev)}
                     onTrancheChange={handleTrancheChange}
                     onAddTranche={addTranche}
                     onRemoveTranche={removeTranche}
                  />
               )}
            </Drawer>

         </div>
      </Panel>
   );
};

export default BehaviouralModels;
