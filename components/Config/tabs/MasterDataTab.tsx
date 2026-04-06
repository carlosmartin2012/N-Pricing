import React, { useState } from 'react';
import { Drawer } from '../../ui/Drawer';
import { Badge } from '../../ui/LayoutComponents';
import { ClientEntity, ProductDefinition, BusinessUnit } from '../../../types';
import { Plus, Edit, Trash2, Users, Briefcase, Building2 } from 'lucide-react';
import { useAudit } from '../../../hooks/useAudit';
import { supabaseService } from '../../../utils/supabaseService';
import type { ConfigUser } from '../configTypes';
import MasterDataEditor from './MasterDataEditor';
import MasterDataSection from './MasterDataSection';
import {
   createBusinessUnitDraft,
   createClientDraft,
   createProductDraft,
   editBusinessUnitDraft,
   editClientDraft,
   editProductDraft,
   removeEntityById,
   type MasterDataEditorState,
   upsertEntityById,
} from './masterDataUtils';

interface Props {
   clients: ClientEntity[];
   setClients?: React.Dispatch<React.SetStateAction<ClientEntity[]>>;
   products: ProductDefinition[];
   setProducts?: React.Dispatch<React.SetStateAction<ProductDefinition[]>>;
   businessUnits: BusinessUnit[];
   setBusinessUnits?: React.Dispatch<React.SetStateAction<BusinessUnit[]>>;
   user: ConfigUser;
}

const MasterDataTab: React.FC<Props> = ({ clients, setClients, products, setProducts, businessUnits, setBusinessUnits, user }) => {
   const logAudit = useAudit(user);
   const [isDrawerOpen, setDrawerOpen] = useState(false);
   const [editorState, setEditorState] = useState<MasterDataEditorState>(null);

   const closeDrawer = () => {
      setDrawerOpen(false);
      setEditorState(null);
   };

   // --- Handlers for Client Master Data ---
   const handleAddClient = () => {
      setEditorState(createClientDraft());
      setDrawerOpen(true);
   };
   const handleEditClient = (client: ClientEntity) => {
      setEditorState(editClientDraft(client));
      setDrawerOpen(true);
   };
   const handleSaveClient = async () => {
      if (editorState?.kind === 'client' && editorState.value.id && editorState.value.name && setClients) {
         if (editorState.isNew && clients.some(client => client.id === editorState.value.id)) {
            window.alert('A client with this ID already exists.');
            return;
         }

         const nextClient = editorState.value as ClientEntity;
         const exists = clients.find(c => c.id === nextClient.id);
         setClients(prev => upsertEntityById(prev, nextClient));
         await supabaseService.saveClient(nextClient);

         logAudit({
            action: exists ? 'UPDATE_CLIENT' : 'CREATE_CLIENT',
            module: 'MASTER_DATA',
            description: `${exists ? 'Updated' : 'Created'} client record: ${nextClient.name} (${nextClient.id})`
         });

         closeDrawer();
      }
   };
   const handleDeleteClient = async (id: string) => {
      const client = clients.find(c => c.id === id);
      if (setClients) setClients(prev => removeEntityById(prev, id));
      await supabaseService.deleteClient(id);

      logAudit({
         action: 'DELETE_CLIENT',
         module: 'MASTER_DATA',
         description: `Deleted client record: ${client?.name || id}`
      });
   };

   // --- Handlers for Product Master Data ---
   const handleAddProduct = () => {
      setEditorState(createProductDraft());
      setDrawerOpen(true);
   };
   const handleEditProduct = (prod: ProductDefinition) => {
      setEditorState(editProductDraft(prod));
      setDrawerOpen(true);
   };
   const handleSaveProduct = async () => {
      if (editorState?.kind === 'product' && editorState.value.id && editorState.value.name && setProducts) {
         if (editorState.isNew && products.some(product => product.id === editorState.value.id)) {
            window.alert('A product with this ID already exists.');
            return;
         }

         const nextProduct = editorState.value as ProductDefinition;
         const exists = products.find(p => p.id === nextProduct.id);
         setProducts(prev => upsertEntityById(prev, nextProduct));
         await supabaseService.saveProduct(nextProduct);

         logAudit({
            action: exists ? 'UPDATE_PRODUCT' : 'CREATE_PRODUCT',
            module: 'MASTER_DATA',
            description: `${exists ? 'Updated' : 'Created'} product definition: ${nextProduct.name}`
         });

         closeDrawer();
      }
   };
   const handleDeleteProduct = async (id: string) => {
      const prod = products.find(p => p.id === id);
      if (setProducts) setProducts(prev => removeEntityById(prev, id));
      await supabaseService.deleteProduct(id);

      logAudit({
         action: 'DELETE_PRODUCT',
         module: 'MASTER_DATA',
         description: `Deleted product definition: ${prod?.name || id}`
      });
   };

   // --- Handlers for Business Unit Master Data ---
   const handleAddBU = () => {
      setEditorState(createBusinessUnitDraft());
      setDrawerOpen(true);
   };
   const handleEditBU = (bu: BusinessUnit) => {
      setEditorState(editBusinessUnitDraft(bu));
      setDrawerOpen(true);
   };
   const handleSaveBU = async () => {
      if (editorState?.kind === 'businessUnit' && editorState.value.id && editorState.value.name && setBusinessUnits) {
         if (editorState.isNew && businessUnits.some(unit => unit.id === editorState.value.id)) {
            window.alert('A business unit with this ID already exists.');
            return;
         }

         const nextBusinessUnit = editorState.value as BusinessUnit;
         const exists = businessUnits.find(b => b.id === nextBusinessUnit.id);
         setBusinessUnits(prev => upsertEntityById(prev, nextBusinessUnit));
         await supabaseService.saveBusinessUnit(nextBusinessUnit);

         logAudit({
            action: exists ? 'UPDATE_BUSINESS_UNIT' : 'CREATE_BUSINESS_UNIT',
            module: 'MASTER_DATA',
            description: `${exists ? 'Updated' : 'Created'} business unit: ${nextBusinessUnit.name}`
         });

         closeDrawer();
      }
   };
   const handleDeleteBU = async (id: string) => {
      const bu = businessUnits.find(b => b.id === id);
      if (setBusinessUnits) setBusinessUnits(prev => removeEntityById(prev, id));
      await supabaseService.deleteBusinessUnit(id);

      logAudit({
         action: 'DELETE_BUSINESS_UNIT',
         module: 'MASTER_DATA',
         description: `Deleted business unit: ${bu?.name || id}`
      });
   };

   const drawerTitle = "Master Data Editor";
   const handleSave = editorState?.kind === 'client'
      ? handleSaveClient
      : editorState?.kind === 'product'
         ? handleSaveProduct
         : editorState?.kind === 'businessUnit'
            ? handleSaveBU
            : closeDrawer;

   return (
      <div className="flex-1 p-6 overflow-auto">
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* Client Registry */}
            <MasterDataSection
               title="Client Registry (ID/Name)"
               icon={<Users size={16} className="text-emerald-500" />}
               addLabel={<><Plus size={12} /> Add Client</>}
               className="col-span-1 lg:col-span-2"
               onAdd={handleAddClient}
            >
               <div className="max-h-96 overflow-y-auto pr-1 space-y-2">
                  {clients.map(c => (
                     <div key={c.id} className="flex justify-between items-center p-2 bg-slate-950 rounded border border-slate-800 text-xs group hover:border-slate-600">
                        <div>
                           <span className="text-cyan-400 font-mono font-bold mr-3">{c.id}</span>
                           <span className="text-slate-300">{c.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <Badge variant="default">{c.type}</Badge>
                           <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 ml-2">
                              <button onClick={() => handleEditClient(c)} className="text-slate-400 hover:text-cyan-400"><Edit size={14} /></button>
                              <button onClick={() => handleDeleteClient(c.id)} className="text-slate-400 hover:text-red-400"><Trash2 size={14} /></button>
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
            </MasterDataSection>

            {/* Product Defs */}
            <MasterDataSection
               title="Product Definitions"
               icon={<Briefcase size={16} className="text-cyan-500" />}
               addLabel={<><Plus size={10} /> Add</>}
               compactAddButton
               onAdd={handleAddProduct}
            >
               <div className="space-y-2 mb-4">
                  {products.map(p => (
                     <div key={p.id} className="flex justify-between items-center p-2 bg-slate-950 rounded border border-slate-800 text-xs group hover:border-slate-600">
                        <div>
                           <span className="text-slate-300">{p.name}</span>
                           <div className="text-[9px] text-slate-500 font-mono">{p.id}</div>
                        </div>
                        <div className="flex items-center gap-2">
                           <Badge variant="default">{p.category}</Badge>
                           <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                              <button onClick={() => handleEditProduct(p)} className="text-slate-400 hover:text-cyan-400"><Edit size={12} /></button>
                              <button onClick={() => handleDeleteProduct(p.id)} className="text-slate-400 hover:text-red-400"><Trash2 size={12} /></button>
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
            </MasterDataSection>

            {/* Business Units */}
            <MasterDataSection
               title="Business Units"
               icon={<Building2 size={16} className="text-purple-500" />}
               addLabel={<><Plus size={10} /> Add</>}
               compactAddButton
               onAdd={handleAddBU}
            >
               <div className="space-y-2 mb-4">
                  {businessUnits.map(b => (
                     <div key={b.id} className="flex justify-between items-center p-2 bg-slate-950 rounded border border-slate-800 text-xs group hover:border-slate-600">
                        <div>
                           <span className="text-slate-300">{b.name}</span>
                           <div className="text-[9px] text-slate-500 font-mono">{b.code} ({b.id})</div>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                           <button onClick={() => handleEditBU(b)} className="text-slate-400 hover:text-cyan-400"><Edit size={12} /></button>
                           <button onClick={() => handleDeleteBU(b.id)} className="text-slate-400 hover:text-red-400"><Trash2 size={12} /></button>
                        </div>
                     </div>
                  ))}
               </div>
            </MasterDataSection>

         </div>

         {/* Edit Drawer */}
         <Drawer
            isOpen={isDrawerOpen}
            onClose={closeDrawer}
            title={drawerTitle}
            footer={
               <div className="flex justify-end gap-2">
                  <button onClick={closeDrawer} className="px-4 py-2 text-xs text-slate-400 hover:text-white">Cancel</button>
                  <button
                     onClick={handleSave}
                     className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded"
                  >
                     Save Changes
                  </button>
               </div>
            }
         >
            {editorState && (
               <MasterDataEditor
                  editorState={editorState}
                  onChange={(nextValue) => setEditorState(prev => prev ? { ...prev, value: nextValue } : prev)}
               />
            )}
         </Drawer>
      </div>
   );
};

export default MasterDataTab;
