import React, { useState } from 'react';
import { Badge, TextInput, InputGroup, SelectInput } from '../../ui/LayoutComponents';
import { Drawer } from '../../ui/Drawer';
import { ClientEntity, ProductDefinition, BusinessUnit } from '../../../types';
import { Plus, Edit, Trash2, Users, Briefcase, Building2 } from 'lucide-react';
import { useAudit } from '../../../hooks/useAudit';
import { supabaseService } from '../../../utils/supabaseService';

interface Props {
   clients: ClientEntity[];
   setClients?: React.Dispatch<React.SetStateAction<ClientEntity[]>>;
   products: ProductDefinition[];
   setProducts?: React.Dispatch<React.SetStateAction<ProductDefinition[]>>;
   businessUnits: BusinessUnit[];
   setBusinessUnits?: React.Dispatch<React.SetStateAction<BusinessUnit[]>>;
   user: any;
}

const MasterDataTab: React.FC<Props> = ({ clients, setClients, products, setProducts, businessUnits, setBusinessUnits, user }) => {
   const logAudit = useAudit(user);
   const [isDrawerOpen, setDrawerOpen] = useState(false);
   const [editingClient, setEditingClient] = useState<Partial<ClientEntity> | null>(null);
   const [editingProduct, setEditingProduct] = useState<Partial<ProductDefinition> | null>(null);
   const [editingBU, setEditingBU] = useState<Partial<BusinessUnit> | null>(null);

   const closeDrawer = () => {
      setDrawerOpen(false);
      setEditingClient(null);
      setEditingProduct(null);
      setEditingBU(null);
   };

   // --- Handlers for Client Master Data ---
   const handleAddClient = () => {
      setEditingClient({ id: '', name: '', type: 'Corporate', segment: '', rating: 'BB' });
      setDrawerOpen(true);
   };
   const handleEditClient = (client: ClientEntity) => {
      setEditingClient({ ...client });
      setDrawerOpen(true);
   };
   const handleSaveClient = async () => {
      if (editingClient && editingClient.id && editingClient.name && setClients) {
         const exists = clients.find(c => c.id === editingClient.id);
         if (exists) {
            setClients(clients.map(c => c.id === editingClient.id ? editingClient as ClientEntity : c));
         } else {
            setClients([...clients, editingClient as ClientEntity]);
         }
         await supabaseService.saveClient(editingClient as ClientEntity);

         logAudit({
            action: exists ? 'UPDATE_CLIENT' : 'CREATE_CLIENT',
            module: 'METHODOLOGY',
            description: `${exists ? 'Updated' : 'Created'} client record: ${editingClient.name} (${editingClient.id})`
         });

         closeDrawer();
      }
   };
   const handleDeleteClient = async (id: string) => {
      const client = clients.find(c => c.id === id);
      if (setClients) setClients(clients.filter(c => c.id !== id));
      await supabaseService.deleteClient(id);

      logAudit({
         action: 'DELETE_CLIENT',
         module: 'MASTER_DATA',
         description: `Deleted client record: ${client?.name || id}`
      });
   };

   // --- Handlers for Product Master Data ---
   const handleAddProduct = () => {
      setEditingProduct({ id: '', name: '', category: 'Asset' });
      setDrawerOpen(true);
   };
   const handleEditProduct = (prod: ProductDefinition) => {
      setEditingProduct({ ...prod });
      setDrawerOpen(true);
   };
   const handleSaveProduct = async () => {
      if (editingProduct && editingProduct.id && editingProduct.name && setProducts) {
         const exists = products.find(p => p.id === editingProduct.id);
         if (exists) {
            setProducts(products.map(p => p.id === editingProduct.id ? editingProduct as ProductDefinition : p));
         } else {
            setProducts([...products, editingProduct as ProductDefinition]);
         }
         await supabaseService.saveProduct(editingProduct as ProductDefinition);

         logAudit({
            action: exists ? 'UPDATE_PRODUCT' : 'CREATE_PRODUCT',
            module: 'METHODOLOGY',
            description: `${exists ? 'Updated' : 'Created'} product definition: ${editingProduct.name}`
         });

         closeDrawer();
      }
   };
   const handleDeleteProduct = async (id: string) => {
      const prod = products.find(p => p.id === id);
      if (setProducts) setProducts(products.filter(p => p.id !== id));
      await supabaseService.deleteProduct(id);

      logAudit({
         action: 'DELETE_PRODUCT',
         module: 'MASTER_DATA',
         description: `Deleted product definition: ${prod?.name || id}`
      });
   };

   // --- Handlers for Business Unit Master Data ---
   const handleAddBU = () => {
      setEditingBU({ id: '', name: '', code: '' });
      setDrawerOpen(true);
   };
   const handleEditBU = (bu: BusinessUnit) => {
      setEditingBU({ ...bu });
      setDrawerOpen(true);
   };
   const handleSaveBU = async () => {
      if (editingBU && editingBU.id && editingBU.name && setBusinessUnits) {
         const exists = businessUnits.find(b => b.id === editingBU.id);
         if (exists) {
            setBusinessUnits(businessUnits.map(b => b.id === editingBU.id ? editingBU as BusinessUnit : b));
         } else {
            setBusinessUnits([...businessUnits, editingBU as BusinessUnit]);
         }
         await supabaseService.saveBusinessUnit(editingBU as BusinessUnit);

         logAudit({
            action: exists ? 'UPDATE_BUSINESS_UNIT' : 'CREATE_BUSINESS_UNIT',
            module: 'METHODOLOGY',
            description: `${exists ? 'Updated' : 'Created'} business unit: ${editingBU.name}`
         });

         closeDrawer();
      }
   };
   const handleDeleteBU = async (id: string) => {
      const bu = businessUnits.find(b => b.id === id);
      if (setBusinessUnits) setBusinessUnits(businessUnits.filter(b => b.id !== id));
      await supabaseService.deleteBusinessUnit(id);

      logAudit({
         action: 'DELETE_BUSINESS_UNIT',
         module: 'MASTER_DATA',
         description: `Deleted business unit: ${bu?.name || id}`
      });
   };

   const drawerTitle = "Master Data Editor";
   const handleSave = editingClient ? handleSaveClient : editingProduct ? handleSaveProduct : editingBU ? handleSaveBU : closeDrawer;

   return (
      <div className="flex-1 p-6 overflow-auto">
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* Client Registry */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 col-span-1 lg:col-span-2">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                     <Users size={16} className="text-emerald-500" /> Client Registry (ID/Name)
                  </h3>
                  <button
                     onClick={handleAddClient}
                     className="flex items-center gap-1 px-3 py-1 bg-slate-800 text-slate-300 rounded border border-slate-700 text-xs hover:bg-slate-700"
                  >
                     <Plus size={12} /> Add Client
                  </button>
               </div>
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
            </div>

            {/* Product Defs */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                     <Briefcase size={16} className="text-cyan-500" /> Product Definitions
                  </h3>
                  <button
                     onClick={handleAddProduct}
                     className="flex items-center gap-1 px-2 py-1 bg-slate-800 text-slate-300 rounded border border-slate-700 text-[10px] hover:bg-slate-700"
                  >
                     <Plus size={10} /> Add
                  </button>
               </div>
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
            </div>

            {/* Business Units */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                     <Building2 size={16} className="text-purple-500" /> Business Units
                  </h3>
                  <button
                     onClick={handleAddBU}
                     className="flex items-center gap-1 px-2 py-1 bg-slate-800 text-slate-300 rounded border border-slate-700 text-[10px] hover:bg-slate-700"
                  >
                     <Plus size={10} /> Add
                  </button>
               </div>
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
            </div>

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
            {editingClient && (
               <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800">
                     <Users size={16} className="text-emerald-500" />
                     <span className="text-xs font-bold text-slate-300 uppercase">Client Details</span>
                  </div>
                  <InputGroup label="Client ID (Unique)">
                     <TextInput
                        value={editingClient.id}
                        onChange={(e) => setEditingClient({ ...editingClient, id: e.target.value })}
                        placeholder="CL-XXXX"
                        disabled={!!clients.find(c => c.id === editingClient.id && editingClient.name)}
                     />
                  </InputGroup>
                  <InputGroup label="Legal Entity Name">
                     <TextInput
                        value={editingClient.name}
                        onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                     />
                  </InputGroup>
                  <InputGroup label="Type">
                     <SelectInput value={editingClient.type} onChange={(e) => setEditingClient({ ...editingClient, type: e.target.value as any })}>
                        <option value="Corporate">Corporate</option>
                        <option value="Retail">Retail</option>
                        <option value="SME">SME</option>
                        <option value="Institution">Institution</option>
                     </SelectInput>
                  </InputGroup>
                  <InputGroup label="Segment">
                     <TextInput
                        value={editingClient.segment}
                        onChange={(e) => setEditingClient({ ...editingClient, segment: e.target.value })}
                     />
                  </InputGroup>
                  <InputGroup label="Internal Rating">
                     <SelectInput value={editingClient.rating} onChange={(e) => setEditingClient({ ...editingClient, rating: e.target.value })}>
                        <option>AAA</option><option>AA</option><option>A</option>
                        <option>BBB</option><option>BB</option><option>B</option>
                        <option>CCC</option>
                     </SelectInput>
                  </InputGroup>
               </div>
            )}

            {editingProduct && (
               <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800">
                     <Briefcase size={16} className="text-cyan-500" />
                     <span className="text-xs font-bold text-slate-300 uppercase">Product Definition</span>
                  </div>
                  <InputGroup label="Product ID">
                     <TextInput
                        value={editingProduct.id}
                        onChange={(e) => setEditingProduct({ ...editingProduct, id: e.target.value })}
                        placeholder="LOAN_XXXX"
                        disabled={!!products.find(p => p.id === editingProduct.id && editingProduct.name)}
                     />
                  </InputGroup>
                  <InputGroup label="Product Name">
                     <TextInput
                        value={editingProduct.name}
                        onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                     />
                  </InputGroup>
                  <InputGroup label="Category">
                     <SelectInput value={editingProduct.category} onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value as any })}>
                        <option value="Asset">Asset (Loan)</option>
                        <option value="Liability">Liability (Deposit)</option>
                        <option value="Off-Balance">Off-Balance Sheet</option>
                     </SelectInput>
                  </InputGroup>
               </div>
            )}

            {editingBU && (
               <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800">
                     <Building2 size={16} className="text-purple-500" />
                     <span className="text-xs font-bold text-slate-300 uppercase">Business Unit</span>
                  </div>
                  <InputGroup label="Unit ID">
                     <TextInput
                        value={editingBU.id}
                        onChange={(e) => setEditingBU({ ...editingBU, id: e.target.value })}
                        placeholder="BU-XXX"
                        disabled={!!businessUnits.find(b => b.id === editingBU.id && editingBU.name)}
                     />
                  </InputGroup>
                  <InputGroup label="Unit Name">
                     <TextInput
                        value={editingBU.name}
                        onChange={(e) => setEditingBU({ ...editingBU, name: e.target.value })}
                     />
                  </InputGroup>
                  <InputGroup label="Code">
                     <TextInput
                        value={editingBU.code}
                        onChange={(e) => setEditingBU({ ...editingBU, code: e.target.value })}
                        placeholder="Ex: CIB"
                     />
                  </InputGroup>
               </div>
            )}
         </Drawer>
      </div>
   );
};

export default MasterDataTab;
