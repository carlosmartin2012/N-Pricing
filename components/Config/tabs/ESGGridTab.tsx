import React, { useState } from 'react';
import { Badge, TextInput, InputGroup } from '../../ui/LayoutComponents';
import { Drawer } from '../../ui/Drawer';
import { Plus, Edit } from 'lucide-react';
import { useAudit } from '../../../hooks/useAudit';
import { supabaseService } from '../../../utils/supabaseService';

interface Props {
   transitionGrid: any[];
   setTransitionGrid: React.Dispatch<React.SetStateAction<any[]>>;
   physicalGrid: any[];
   setPhysicalGrid: React.Dispatch<React.SetStateAction<any[]>>;
   user: any;
}

const ESGGridTab: React.FC<Props> = ({ transitionGrid, setTransitionGrid, physicalGrid, setPhysicalGrid, user }) => {
   const logAudit = useAudit(user);
   const [esgSubTab, setEsgSubTab] = useState<'TRANSITION' | 'PHYSICAL'>('TRANSITION');
   const [isDrawerOpen, setDrawerOpen] = useState(false);
   const [editingEsg, setEditingEsg] = useState<any>(null);

   const closeDrawer = () => {
      setDrawerOpen(false);
      setEditingEsg(null);
   };

   const handleEditEsg = (item: any) => {
      setEditingEsg({ ...item, type: esgSubTab });
      setDrawerOpen(true);
   };

   const handleSaveEsg = async () => {
      if (editingEsg) {
         let newGrid;
         const type = editingEsg.type === 'TRANSITION' ? 'transition' : 'physical';
         if (editingEsg.type === 'TRANSITION') {
            newGrid = transitionGrid.map(g => g.id === editingEsg.id ? editingEsg : g);
            setTransitionGrid(newGrid);
         } else {
            newGrid = physicalGrid.map(g => g.id === editingEsg.id ? editingEsg : g);
            setPhysicalGrid(newGrid);
         }

         await supabaseService.saveEsgGrid(type, newGrid);

         logAudit({
            action: 'UPDATE_ESG_GRID',
            module: 'CONFIG',
            description: `Updated ESG ${type} grid entry: ${editingEsg.classification || editingEsg.riskLevel}`
         });

         closeDrawer();
      }
   };

   return (
      <>
         {/* ESG Sub-Tabs */}
         <div className="flex bg-slate-900 border-b border-slate-700">
            <button
               onClick={() => setEsgSubTab('TRANSITION')}
               className={`flex-1 py-2 text-[10px] uppercase font-bold tracking-wider ${esgSubTab === 'TRANSITION' ? 'bg-slate-800 text-emerald-400 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-300'}`}
            >
               Transition Risk (Carbon)
            </button>
            <button
               onClick={() => setEsgSubTab('PHYSICAL')}
               className={`flex-1 py-2 text-[10px] uppercase font-bold tracking-wider ${esgSubTab === 'PHYSICAL' ? 'bg-slate-800 text-blue-400 border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}
            >
               Physical Risk (Climate)
            </button>
         </div>

         {/* ESG Toolbar */}
         <div className="p-3 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
            <div className="text-[10px] text-slate-500">
               {esgSubTab === 'TRANSITION' ? 'Penalties for high-carbon, incentives for green.' : 'Premiums for asset location risk exposure.'}
            </div>
            {/* ESG Add button placeholder */}
            <button className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 text-slate-300 rounded border border-slate-700 text-xs hover:bg-slate-700 cursor-not-allowed opacity-50">
               <Plus size={12} /> Add Entry (System Only)
            </button>
         </div>

         {/* ESG Grids */}
         <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
               <thead className="bg-slate-950 sticky top-0 z-10">
                  <tr>
                     <th className="p-3 text-[10px] uppercase font-bold text-slate-500 border-b border-r border-slate-800">
                        {esgSubTab === 'TRANSITION' ? 'Classification' : 'Risk Level'}
                     </th>
                     <th className="p-3 text-[10px] uppercase font-bold text-slate-500 border-b border-r border-slate-800">
                        {esgSubTab === 'TRANSITION' ? 'Sector' : 'Location / Asset Type'}
                     </th>
                     <th className="p-3 text-[10px] uppercase font-bold text-slate-500 border-b border-r border-slate-800">Description</th>
                     <th className="p-3 text-[10px] uppercase font-bold text-slate-500 border-b border-r border-slate-800 text-right">Spread (bps)</th>
                     <th className="p-3 w-16 border-b border-slate-800"></th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-800 font-mono text-xs text-slate-300">
                  {(esgSubTab === 'TRANSITION' ? transitionGrid : physicalGrid).map((item: any) => (
                     <tr key={item.id} className="hover:bg-slate-800/30 group">
                        <td className="p-3 border-r border-slate-800/50">
                           {esgSubTab === 'TRANSITION' ? (
                              <Badge variant={item.classification === 'Green' ? 'success' : item.classification === 'Brown' ? 'danger' : 'default'}>
                                 {item.classification}
                              </Badge>
                           ) : (
                              <Badge variant={item.riskLevel === 'Low' ? 'success' : item.riskLevel === 'High' ? 'danger' : 'warning'}>
                                 {item.riskLevel}
                              </Badge>
                           )}
                        </td>
                        <td className="p-3 border-r border-slate-800/50">
                           {esgSubTab === 'TRANSITION' ? item.sector : item.locationType}
                        </td>
                        <td className="p-3 border-r border-slate-800/50 text-slate-400">{item.description}</td>
                        <td className={`p-3 border-r border-slate-800/50 text-right font-bold ${item.adjustmentBps < 0 ? 'text-emerald-400' : item.adjustmentBps > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                           {item.adjustmentBps > 0 ? '+' : ''}{item.adjustmentBps}
                        </td>
                        <td className="p-3 text-right flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => handleEditEsg(item)} className="text-slate-400 hover:text-cyan-400"><Edit size={14} /></button>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>

         {/* Edit Drawer */}
         <Drawer
            isOpen={isDrawerOpen}
            onClose={closeDrawer}
            title="Configuration Editor"
            footer={
               <div className="flex justify-end gap-2">
                  <button onClick={closeDrawer} className="px-4 py-2 text-xs text-slate-400 hover:text-white">Cancel</button>
                  <button
                     onClick={handleSaveEsg}
                     className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded"
                  >
                     Save Changes
                  </button>
               </div>
            }
         >
            {editingEsg && (
               <div className="space-y-4">
                  <InputGroup label="Classification / Risk Level">
                     <TextInput value={editingEsg.classification || editingEsg.riskLevel} onChange={(e) => setEditingEsg({ ...editingEsg, classification: e.target.value, riskLevel: e.target.value })} />
                  </InputGroup>
                  <InputGroup label="Description">
                     <TextInput value={editingEsg.description} onChange={(e) => setEditingEsg({ ...editingEsg, description: e.target.value })} />
                  </InputGroup>
                  <InputGroup label="Adjustment (bps)">
                     <TextInput type="number" value={editingEsg.adjustmentBps} onChange={(e) => setEditingEsg({ ...editingEsg, adjustmentBps: parseFloat(e.target.value) })} />
                  </InputGroup>
               </div>
            )}
         </Drawer>
      </>
   );
};

export default ESGGridTab;
