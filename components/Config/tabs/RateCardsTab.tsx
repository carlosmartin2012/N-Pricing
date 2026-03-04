import React, { useState } from 'react';
import { Badge, TextInput, InputGroup, SelectInput } from '../../ui/LayoutComponents';
import { Drawer } from '../../ui/Drawer';
import { FtpRateCard } from '../../../types';
import { Plus, Edit, Trash2, X } from 'lucide-react';
import { useAudit } from '../../../hooks/useAudit';
import { supabaseService } from '../../../utils/supabaseService';

interface Props {
   ftpRateCards: FtpRateCard[];
   setFtpRateCards: React.Dispatch<React.SetStateAction<FtpRateCard[]>>;
   user: any;
}

const RateCardsTab: React.FC<Props> = ({ ftpRateCards, setFtpRateCards, user }) => {
   const logAudit = useAudit(user);
   const [isDrawerOpen, setDrawerOpen] = useState(false);
   const [editingRateCard, setEditingRateCard] = useState<Partial<FtpRateCard> | null>(null);

   const closeDrawer = () => {
      setDrawerOpen(false);
      setEditingRateCard(null);
   };

   const handleAddRateCard = () => {
      setEditingRateCard({
         id: `RC-NEW-${Math.floor(Math.random() * 1000)}`,
         name: '',
         type: 'Liquidity',
         currency: 'USD',
         grid: [{ tenor: '1Y', spread: 0 }]
      } as any);
      setDrawerOpen(true);
   };

   const handleEditRateCard = (card: FtpRateCard) => {
      setEditingRateCard({ ...card });
      setDrawerOpen(true);
   };

   const handleSaveRateCard = async () => {
      if (editingRateCard && editingRateCard.id) {
         let newCards;
         const exists = ftpRateCards.find(c => c.id === editingRateCard.id);
         if (exists) {
            newCards = ftpRateCards.map(c => c.id === editingRateCard.id ? editingRateCard as FtpRateCard : c);
         } else {
            newCards = [...ftpRateCards, editingRateCard as FtpRateCard];
         }
         setFtpRateCards(newCards);
         await supabaseService.saveRateCards(newCards);

         logAudit({
            action: exists ? 'UPDATE_RATE_CARD' : 'CREATE_RATE_CARD',
            module: 'CONFIG',
            description: `${exists ? 'Updated' : 'Created'} FTP rate card: ${editingRateCard.name} (${editingRateCard.currency})`
         });

         closeDrawer();
      }
   };

   const handleDeleteRateCard = async (id: string) => {
      const card = ftpRateCards.find(c => c.id === id);
      const newCards = ftpRateCards.filter(c => c.id !== id);
      setFtpRateCards(newCards);
      await supabaseService.saveRateCards(newCards);

      logAudit({
         action: 'DELETE_RATE_CARD',
         module: 'SYS_CONFIG',
         description: `Deleted FTP rate card: ${card?.name || id}`
      });
   };

   return (
      <>
         <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
            <div className="text-[10px] text-slate-500">
               Manage FTP Components, Liquidity Add-ons, and Commercial Pricing Grids.
            </div>
            <button onClick={handleAddRateCard} className="flex items-center gap-1 px-3 py-1.5 bg-purple-900/30 text-purple-400 rounded border border-purple-800 text-xs hover:bg-purple-900/50 font-medium">
               <Plus size={12} /> New Curve / Grid
            </button>
         </div>

         <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
               {ftpRateCards.map(card => (
                  <div key={card.id} className="bg-slate-950 border border-slate-800 rounded p-4 relative group hover:border-slate-600 transition-colors">
                     <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEditRateCard(card)} className="text-slate-400 hover:text-cyan-400"><Edit size={14} /></button>
                        <button onClick={() => handleDeleteRateCard(card.id)} className="text-slate-400 hover:text-red-400"><Trash2 size={14} /></button>
                     </div>

                     <div className="flex items-center gap-2 mb-2">
                        <Badge variant={card.type === 'Liquidity' ? 'warning' : card.type === 'Commercial' ? 'success' : 'default'}>{card.type}</Badge>
                        <Badge variant="default">{card.currency}</Badge>
                     </div>
                     <h4 className="text-sm font-bold text-slate-200 mb-1">{card.name}</h4>
                     <div className="text-[10px] font-mono text-slate-500 mb-4">{card.id}</div>

                     <div className="bg-slate-900/50 rounded border border-slate-800/50 p-2">
                        <div className="flex gap-2 overflow-x-auto pb-1">
                           {(card.points || []).map((pt, i) => (
                              <div key={i} className="flex-shrink-0 bg-slate-800 rounded px-2 py-1 text-center min-w-[50px]">
                                 <div className="text-[9px] text-slate-400 font-bold">{pt.tenor}</div>
                                 <div className={`text-xs font-mono font-bold ${pt.rate >= 0 ? 'text-cyan-400' : 'text-emerald-400'}`}>
                                    {pt.rate}
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
               ))}
            </div>
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
                     onClick={handleSaveRateCard}
                     className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded"
                  >
                     Save Changes
                  </button>
               </div>
            }
         >
            {editingRateCard && (
               <div className="space-y-4">
                  <InputGroup label="Curve Name">
                     <TextInput value={editingRateCard.name} onChange={(e) => setEditingRateCard({ ...editingRateCard, name: e.target.value })} placeholder="e.g. USD Liquidity Std" />
                  </InputGroup>
                  <div className="grid grid-cols-2 gap-4">
                     <InputGroup label="Type">
                        <SelectInput value={editingRateCard.type} onChange={(e) => setEditingRateCard({ ...editingRateCard, type: e.target.value as any })}>
                           <option value="Liquidity">Liquidity</option><option value="Commercial">Commercial</option><option value="Basis">Basis</option>
                        </SelectInput>
                     </InputGroup>
                     <InputGroup label="Currency">
                        <SelectInput value={editingRateCard.currency} onChange={(e) => setEditingRateCard({ ...editingRateCard, currency: e.target.value })}>
                           <option>USD</option><option>EUR</option><option>GBP</option>
                        </SelectInput>
                     </InputGroup>
                  </div>

                  <div className="mt-4">
                     <div className="flex justify-between items-center mb-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Grid Points (Tenor / Spread)</label>
                        <button onClick={() => setEditingRateCard({ ...editingRateCard, grid: [...(editingRateCard as any).grid!, { tenor: '1Y', spread: 0 }] })} className="text-xs text-cyan-400 hover:text-white flex items-center gap-1"><Plus size={10} /> Add</button>
                     </div>
                     <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {(editingRateCard as any).grid?.map((pt: any, i: number) => (
                           <div key={i} className="flex gap-2 items-center">
                              <TextInput value={pt.tenor} onChange={(e) => {
                                 const g = [...(editingRateCard as any).grid!]; g[i].tenor = e.target.value; setEditingRateCard({ ...editingRateCard, grid: g } as any);
                              }} className="w-16 text-center" />
                              <div className="flex-1 relative">
                                 <TextInput type="number" value={pt.spread} onChange={(e) => {
                                    const g = [...(editingRateCard as any).grid!]; g[i].spread = parseFloat(e.target.value); setEditingRateCard({ ...editingRateCard, grid: g } as any);
                                 }} className="w-full text-right pr-8" />
                                 <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">bps</span>
                              </div>
                              <button onClick={() => setEditingRateCard({ ...editingRateCard, grid: (editingRateCard as any).grid!.filter((_: any, idx: number) => idx !== i) } as any)} className="text-slate-600 hover:text-red-400"><X size={14} /></button>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
            )}
         </Drawer>
      </>
   );
};

export default RateCardsTab;
