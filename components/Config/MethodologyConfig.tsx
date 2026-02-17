
import React, { useState, useEffect } from 'react';
import { Panel, Badge, TextInput, InputGroup, SelectInput } from '../ui/LayoutComponents';
import { Drawer } from '../ui/Drawer';
import { MOCK_TRANSITION_GRID, MOCK_PHYSICAL_GRID, MOCK_FTP_RATE_CARDS } from '../../constants';
import { ApprovalMatrixConfig, ProductDefinition, BusinessUnit, ClientEntity, GeneralRule, FtpRateCard } from '../../types';
import { Search, Plus, Save, Edit, Settings, Leaf, ShieldCheck, CheckCircle2, AlertTriangle, TrendingUp, XCircle, Database, Briefcase, UserPlus, FileSpreadsheet, Trash2, X, GitBranch, Users, Layers, Building2, Upload } from 'lucide-react';
import { storage } from '../../utils/storage';
import { supabaseService } from '../../utils/supabaseService';
import { downloadTemplate, parseExcel } from '../../utils/excelUtils';

interface Props {
   mode: 'METHODOLOGY' | 'SYS_CONFIG';
   rules: GeneralRule[];
   setRules: React.Dispatch<React.SetStateAction<GeneralRule[]>>;
   approvalMatrix?: ApprovalMatrixConfig;
   setApprovalMatrix?: (config: ApprovalMatrixConfig) => void;
   products?: ProductDefinition[];
   setProducts?: React.Dispatch<React.SetStateAction<ProductDefinition[]>>;
   businessUnits?: BusinessUnit[];
   setBusinessUnits?: React.Dispatch<React.SetStateAction<BusinessUnit[]>>;
   clients?: ClientEntity[];
   setClients?: React.Dispatch<React.SetStateAction<ClientEntity[]>>;
   user: any;
}

const MethodologyConfig: React.FC<Props> = ({
   mode,
   rules, setRules,
   approvalMatrix, setApprovalMatrix,
   products = [], setProducts,
   businessUnits = [], setBusinessUnits,
   clients = [], setClients,
   user
}) => {
   // Determine initial tab based on mode
   const [activeTab, setActiveTab] = useState<'GENERAL' | 'ESG' | 'GOVERNANCE' | 'MASTER' | 'RATE_CARDS'>(
      mode === 'METHODOLOGY' ? 'GENERAL' : 'RATE_CARDS'
   );

   const [esgSubTab, setEsgSubTab] = useState<'TRANSITION' | 'PHYSICAL'>('TRANSITION');

   // Local States for Grids
   const [transitionGrid, setTransitionGrid] = useState(MOCK_TRANSITION_GRID);
   const [physicalGrid, setPhysicalGrid] = useState(MOCK_PHYSICAL_GRID);
   const [ftpRateCards, setFtpRateCards] = useState<FtpRateCard[]>(MOCK_FTP_RATE_CARDS);

   const [isDrawerOpen, setDrawerOpen] = useState(false);

   // Drawer Editing States
   const [editingRule, setEditingRule] = useState<Partial<GeneralRule>>({});
   const [editingEsg, setEditingEsg] = useState<any>(null);
   const [editingRateCard, setEditingRateCard] = useState<Partial<FtpRateCard> | null>(null);

   // Master Data Editing States
   const [editingClient, setEditingClient] = useState<Partial<ClientEntity> | null>(null);
   const [editingProduct, setEditingProduct] = useState<Partial<ProductDefinition> | null>(null);
   const [editingBU, setEditingBU] = useState<Partial<BusinessUnit> | null>(null);

   // Constants for Base Curves (In a real app, these would come from Market Data service)
   const AVAILABLE_BASE_CURVES = ['USD-SOFR', 'USD-GOVT', 'EUR-ESTR', 'EUR-IBOR', 'GBP-SONIA', 'JPY-TONA'];

   // Sync tab if mode changes
   useEffect(() => {
      if (mode === 'METHODOLOGY') setActiveTab('GENERAL');
      else if (activeTab === 'GENERAL') setActiveTab('RATE_CARDS');
   }, [mode]);

   const closeDrawer = () => {
      setDrawerOpen(false);
      setEditingClient(null);
      setEditingProduct(null);
      setEditingBU(null);
      setEditingRule({});
      setEditingEsg(null);
      setEditingRateCard(null);
   };

   // --- Handlers for General Rules ---
   const handleAddNewRule = () => {
      setEditingRule({
         id: 0,
         businessUnit: 'Commercial Banking',
         product: 'Commercial Loan',
         segment: 'All',
         tenor: 'Any',
         baseMethod: 'Matched Maturity',
         baseReference: 'USD-SOFR',
         spreadMethod: 'Curve Lookup',
         liquidityReference: '',
         strategicSpread: 0
      });
      setDrawerOpen(true);
   };

   const handleEditRule = (rule: GeneralRule) => {
      setEditingRule(rule);
      setDrawerOpen(true);
   };

   const handleSaveRule = async () => {
      if (editingRule.product) {
         let action = '';
         if (editingRule.id === 0) {
            const newId = Math.max(...rules.map(r => r.id), 0) + 1;
            setRules([...rules, { ...editingRule, id: newId } as GeneralRule]);
            action = 'CREATE_RULE';
         } else {
            setRules(rules.map(r => r.id === editingRule.id ? editingRule as GeneralRule : r));
            action = 'UPDATE_RULE';
         }

         // PERSIST TO SUPABASE
         await supabaseService.saveRule({ ...editingRule, id: editingRule.id || Math.floor(Math.random() * 10000) } as GeneralRule);

         storage.addAuditEntry({
            userEmail: user?.email || 'unknown',
            userName: user?.name || 'Unknown User',
            action,
            module: 'METHODOLOGY',
            description: `${action === 'CREATE_RULE' ? 'Created' : 'Updated'} methodology rule for ${editingRule.businessUnit} - ${editingRule.product}`
         });

         closeDrawer();
      }
   };

   const handleDeleteRule = async (id: number) => {
      const rule = rules.find(r => r.id === id);
      setRules(rules.filter(r => r.id !== id));
      storage.addAuditEntry({
         userEmail: user?.email || 'unknown',
         userName: user?.name || 'Unknown User',
         action: 'DELETE_RULE',
         module: 'METHODOLOGY',
         description: `Deleted methodology rule ${id} (${rule?.product})`
      });
      await supabaseService.deleteRule(id);
   };

   const handleDownloadRulesTemplate = () => downloadTemplate('METHODOLOGY', 'Methodology_Rules_Template');

   const handleImportRules = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
         const data = await parseExcel(file);
         const newRules: GeneralRule[] = data.map((row, i) => ({
            id: Math.max(...rules.map(r => r.id), 0) + i + 1,
            businessUnit: row.BusinessUnit || row.businessUnit,
            product: row.Product || row.product,
            segment: row.Segment || row.segment,
            tenor: row.Tenor || row.tenor,
            baseMethod: row.BaseMethod || row.baseMethod,
            baseReference: row.BaseReference || row.baseReference,
            spreadMethod: row.SpreadMethod || row.spreadMethod,
            liquidityReference: row.LiquidityReference || row.liquidityReference,
            strategicSpread: parseFloat(row.StrategicSpread || row.strategicSpread) || 0
         }));
         setRules([...rules, ...newRules]);
         storage.addAuditEntry({
            userEmail: user?.email || 'unknown',
            userName: user?.name || 'Unknown User',
            action: 'IMPORT_RULES',
            module: 'METHODOLOGY',
            description: `Imported ${newRules.length} methodology rules from Excel`
         });
      }
   };

   // --- Handlers for Rate Cards ---
   const handleAddRateCard = () => {
      setEditingRateCard({
         id: `RC-NEW-${Math.floor(Math.random() * 1000)}`,
         name: '',
         type: 'Liquidity',
         currency: 'USD',
         grid: [{ tenor: '1Y', spread: 0 }]
      });
      setDrawerOpen(true);
   }

   const handleEditRateCard = (card: FtpRateCard) => {
      setEditingRateCard({ ...card });
      setDrawerOpen(true);
   }

   const handleSaveRateCard = () => {
      if (editingRateCard && editingRateCard.id) {
         const exists = ftpRateCards.find(c => c.id === editingRateCard.id);
         if (exists) {
            setFtpRateCards(ftpRateCards.map(c => c.id === editingRateCard.id ? editingRateCard as FtpRateCard : c));
         } else {
            setFtpRateCards([...ftpRateCards, editingRateCard as FtpRateCard]);
         }
         closeDrawer();
      }
   }

   const handleDeleteRateCard = (id: string) => {
      setFtpRateCards(ftpRateCards.filter(c => c.id !== id));
   };

   // --- Handlers for ESG Grid ---
   const handleEditEsg = (item: any) => {
      setEditingEsg({ ...item, type: esgSubTab });
      setDrawerOpen(true);
   }

   const handleSaveEsg = () => {
      if (editingEsg) {
         if (editingEsg.type === 'TRANSITION') {
            setTransitionGrid(transitionGrid.map(g => g.id === editingEsg.id ? editingEsg : g));
         } else {
            setPhysicalGrid(physicalGrid.map(g => g.id === editingEsg.id ? editingEsg : g));
         }
         closeDrawer();
      }
   }

   // --- Handlers for Client Master Data ---
   const handleAddClient = () => {
      setEditingClient({ id: '', name: '', type: 'Corporate', segment: '', rating: 'BB' });
      setDrawerOpen(true);
   }
   const handleEditClient = (client: ClientEntity) => {
      setEditingClient({ ...client });
      setDrawerOpen(true);
   }
   const handleSaveClient = async () => {
      if (editingClient && editingClient.id && editingClient.name && setClients) {
         const exists = clients.find(c => c.id === editingClient.id);
         if (exists) {
            setClients(clients.map(c => c.id === editingClient.id ? editingClient as ClientEntity : c));
         } else {
            setClients([...clients, editingClient as ClientEntity]);
         }
         await supabaseService.saveClient(editingClient as ClientEntity);
         closeDrawer();
      }
   }
   const handleDeleteClient = async (id: string) => {
      if (setClients) setClients(clients.filter(c => c.id !== id));
      await supabaseService.deleteClient(id);
   }

   // --- Handlers for Product Master Data ---
   const handleAddProduct = () => {
      setEditingProduct({ id: '', name: '', category: 'Asset' });
      setDrawerOpen(true);
   }
   const handleEditProduct = (prod: ProductDefinition) => {
      setEditingProduct({ ...prod });
      setDrawerOpen(true);
   }
   const handleSaveProduct = async () => {
      if (editingProduct && editingProduct.id && editingProduct.name && setProducts) {
         const exists = products.find(p => p.id === editingProduct.id);
         if (exists) {
            setProducts(products.map(p => p.id === editingProduct.id ? editingProduct as ProductDefinition : p));
         } else {
            setProducts([...products, editingProduct as ProductDefinition]);
         }
         await supabaseService.saveProduct(editingProduct as ProductDefinition);
         closeDrawer();
      }
   }
   const handleDeleteProduct = async (id: string) => {
      if (setProducts) setProducts(products.filter(p => p.id !== id));
      await supabaseService.deleteProduct(id);
   }

   // --- Handlers for Business Unit Master Data ---
   const handleAddBU = () => {
      setEditingBU({ id: '', name: '', code: '' });
      setDrawerOpen(true);
   }
   const handleEditBU = (bu: BusinessUnit) => {
      setEditingBU({ ...bu });
      setDrawerOpen(true);
   }
   const handleSaveBU = async () => {
      if (editingBU && editingBU.id && editingBU.name && setBusinessUnits) {
         const exists = businessUnits.find(b => b.id === editingBU.id);
         if (exists) {
            setBusinessUnits(businessUnits.map(b => b.id === editingBU.id ? editingBU as BusinessUnit : b));
         } else {
            setBusinessUnits([...businessUnits, editingBU as BusinessUnit]);
         }
         await supabaseService.saveBusinessUnit(editingBU as BusinessUnit);
         closeDrawer();
      }
   }
   const handleDeleteBU = async (id: string) => {
      if (setBusinessUnits) setBusinessUnits(businessUnits.filter(b => b.id !== id));
      await supabaseService.deleteBusinessUnit(id);
   }

   // --- Handlers for Governance ---
   const handleGovernanceChange = (key: keyof ApprovalMatrixConfig, value: string) => {
      if (setApprovalMatrix && approvalMatrix) {
         setApprovalMatrix({
            ...approvalMatrix,
            [key]: parseFloat(value)
         });
      }
   }

   return (
      <Panel title={mode === 'METHODOLOGY' ? "Methodology & Rules Engine" : "System Configuration & Master Data"} className="h-full">
         <div className="flex flex-col h-full">

            {/* Main Tab Navigation */}
            <div className="flex border-b border-slate-700 bg-slate-900 overflow-x-auto">

               {mode === 'METHODOLOGY' && (
                  <button
                     onClick={() => setActiveTab('GENERAL')}
                     className={`px-6 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === 'GENERAL' ? 'border-cyan-500 text-white bg-slate-800/50' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                  >
                     <div className="flex items-center gap-2">
                        <GitBranch size={14} className="text-cyan-500" /> General Rules
                     </div>
                  </button>
               )}

               {mode === 'SYS_CONFIG' && (
                  <>
                     <button
                        onClick={() => setActiveTab('RATE_CARDS')}
                        className={`px-6 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === 'RATE_CARDS' ? 'border-purple-500 text-white bg-slate-800/50' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                     >
                        <div className="flex items-center gap-2">
                           <FileSpreadsheet size={14} className="text-purple-500" /> FTP Curves & Spreads
                        </div>
                     </button>
                     <button
                        onClick={() => setActiveTab('ESG')}
                        className={`px-6 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === 'ESG' ? 'border-emerald-500 text-white bg-slate-800/50' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                     >
                        <div className="flex items-center gap-2">
                           <Leaf size={14} className="text-emerald-500" /> ESG Rate Cards
                        </div>
                     </button>
                     <button
                        onClick={() => setActiveTab('GOVERNANCE')}
                        className={`px-6 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === 'GOVERNANCE' ? 'border-amber-500 text-white bg-slate-800/50' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                     >
                        <div className="flex items-center gap-2">
                           <ShieldCheck size={14} className="text-amber-500" /> Governance
                        </div>
                     </button>
                     <button
                        onClick={() => setActiveTab('MASTER')}
                        className={`px-6 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === 'MASTER' ? 'border-blue-500 text-white bg-slate-800/50' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                     >
                        <div className="flex items-center gap-2">
                           <Database size={14} className="text-blue-500" /> Master Data
                        </div>
                     </button>
                  </>
               )}
            </div>

            {/* Content Area */}
            {activeTab === 'GENERAL' ? (
               <>
                  {/* General Toolbar */}
                  <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900">
                     <div className="flex gap-2">
                        <div className="relative">
                           <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                           <input
                              type="text"
                              placeholder="Search rules..."
                              className="bg-slate-950 border border-slate-700 rounded pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 w-64"
                           />
                        </div>
                     </div>
                     <div className="flex gap-2">
                        <button onClick={handleDownloadRulesTemplate} className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 text-amber-400 rounded border border-slate-700 text-xs hover:bg-slate-700" title="Download Template">
                           <FileSpreadsheet size={12} /> Template
                        </button>
                        <label className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 text-cyan-400 rounded border border-slate-700 text-xs hover:bg-slate-700 cursor-pointer">
                           <Upload size={12} /> Import
                           <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleImportRules} />
                        </label>
                        <button onClick={handleAddNewRule} className="flex items-center gap-1 px-3 py-1.5 bg-cyan-900/40 text-cyan-400 rounded border border-cyan-800 text-xs hover:bg-cyan-900/60 font-bold">
                           <Plus size={12} /> Add Rule
                        </button>
                     </div>
                  </div>

                  {/* General Rules Grid */}
                  <div className="flex-1 overflow-auto">
                     <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-950 sticky top-0 z-10">
                           <tr>
                              <th className="p-3 text-[10px] uppercase font-bold text-slate-500 border-b border-r border-slate-800">Priority</th>
                              <th className="p-3 text-[10px] uppercase font-bold text-slate-500 border-b border-r border-slate-800">Business Unit</th>
                              <th className="p-3 text-[10px] uppercase font-bold text-slate-500 border-b border-r border-slate-800">Product Dimension</th>
                              <th className="p-3 text-[10px] uppercase font-bold text-slate-500 border-b border-r border-slate-800">Segment</th>
                              <th className="p-3 text-[10px] uppercase font-bold text-slate-500 border-b border-r border-slate-800">Tenor</th>

                              <th className="p-3 text-[10px] uppercase font-bold text-slate-500 border-b border-r border-slate-800">Base Method</th>
                              <th className="p-3 text-[10px] uppercase font-bold text-slate-500 border-b border-r border-slate-800">Base Ref</th>

                              <th className="p-3 text-[10px] uppercase font-bold text-slate-500 border-b border-r border-slate-800">Liq. Method</th>
                              <th className="p-3 text-[10px] uppercase font-bold text-slate-500 border-b border-r border-slate-800">Liq. Ref</th>

                              <th className="p-3 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-800">Strategic Spread</th>
                              <th className="p-3 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-800 w-16"></th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 font-mono text-xs text-slate-300">
                           {rules.map((rule) => (
                              <tr key={rule.id} className="hover:bg-slate-800/30 group cursor-pointer transition-colors">
                                 <td className="p-3 border-r border-slate-800/50 text-center text-slate-600">{rule.id}</td>
                                 <td className="p-3 border-r border-slate-800/50">{rule.businessUnit || 'All'}</td>
                                 <td className="p-3 border-r border-slate-800/50 font-sans">{rule.product}</td>
                                 <td className="p-3 border-r border-slate-800/50">
                                    <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px]">{rule.segment}</span>
                                 </td>
                                 <td className="p-3 border-r border-slate-800/50">{rule.tenor}</td>
                                 <td className="p-3 border-r border-slate-800/50">
                                    <Badge variant={rule.baseMethod === 'Matched Maturity' ? 'success' : 'default'}>{rule.baseMethod}</Badge>
                                 </td>
                                 <td className="p-3 border-r border-slate-800/50 text-slate-400">
                                    {rule.baseReference || '-'}
                                 </td>
                                 <td className="p-3 border-r border-slate-800/50">
                                    <Badge variant="warning">{rule.spreadMethod}</Badge>
                                 </td>
                                 <td className="p-3 border-r border-slate-800/50 text-slate-400">
                                    {rule.liquidityReference || '-'}
                                 </td>
                                 <td className="p-3 flex justify-between items-center">
                                    <span className={`${rule.strategicSpread > 0 ? 'text-cyan-400' : 'text-slate-500'}`}>{rule.strategicSpread} bps</span>
                                 </td>
                                 <td className="p-3 text-right flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEditRule(rule)} className="text-slate-400 hover:text-cyan-400"><Edit size={14} /></button>
                                    <button onClick={() => handleDeleteRule(rule.id)} className="text-slate-400 hover:text-red-400"><Trash2 size={14} /></button>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </>
            ) : activeTab === 'RATE_CARDS' ? (
               // --- FTP RATE CARDS TAB ---
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
                                    {card.grid.map((pt, i) => (
                                       <div key={i} className="flex-shrink-0 bg-slate-800 rounded px-2 py-1 text-center min-w-[50px]">
                                          <div className="text-[9px] text-slate-400 font-bold">{pt.tenor}</div>
                                          <div className={`text-xs font-mono font-bold ${pt.spread >= 0 ? 'text-cyan-400' : 'text-emerald-400'}`}>
                                             {pt.spread}
                                          </div>
                                       </div>
                                    ))}
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               </>
            ) : activeTab === 'ESG' ? (
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
               </>
            ) : activeTab === 'GOVERNANCE' ? (
               // --- GOVERNANCE TAB ---
               <div className="flex-1 p-6 overflow-auto">
                  <div className="max-w-2xl mx-auto space-y-8">

                     <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                           <ShieldCheck size={120} className="text-amber-500" />
                        </div>

                        <h3 className="text-lg font-bold text-white mb-2">Approval Matrix Configuration</h3>
                        <p className="text-xs text-slate-400 mb-6">
                           Define the RAROC (Risk Adjusted Return on Capital) hurdles that trigger different levels of approval workflows.
                           Calculated as <span className="font-mono text-cyan-400">Net Income / Economic Capital</span>.
                        </p>

                        <div className="space-y-6">
                           {/* Thresholds Input */}
                           <div className="flex items-center gap-4 p-4 bg-emerald-950/20 border border-emerald-900/50 rounded-md">
                              <div className="p-2 bg-emerald-900/50 rounded-full">
                                 <CheckCircle2 size={24} className="text-emerald-400" />
                              </div>
                              <div className="flex-1">
                                 <h4 className="text-sm font-bold text-emerald-400 uppercase">Auto Approval</h4>
                                 <p className="text-[10px] text-slate-500">Deals exceeding this RAROC are automatically approved.</p>
                              </div>
                              <div className="w-32">
                                 <InputGroup label="Min RAROC (%)">
                                    <TextInput
                                       type="number"
                                       value={approvalMatrix?.autoApprovalThreshold}
                                       onChange={(e) => handleGovernanceChange('autoApprovalThreshold', e.target.value)}
                                       className="text-right font-bold text-emerald-400"
                                    />
                                 </InputGroup>
                              </div>
                           </div>

                           <div className="flex items-center gap-4 p-4 bg-amber-950/20 border border-amber-900/50 rounded-md">
                              <div className="p-2 bg-amber-900/50 rounded-full">
                                 <AlertTriangle size={24} className="text-amber-400" />
                              </div>
                              <div className="flex-1">
                                 <h4 className="text-sm font-bold text-amber-400 uppercase">L1 Manager Review</h4>
                                 <p className="text-[10px] text-slate-500">Requires desk head sign-off.</p>
                              </div>
                              <div className="w-32">
                                 <InputGroup label="Min RAROC (%)">
                                    <TextInput
                                       type="number"
                                       value={approvalMatrix?.l1Threshold}
                                       onChange={(e) => handleGovernanceChange('l1Threshold', e.target.value)}
                                       className="text-right font-bold text-amber-400"
                                    />
                                 </InputGroup>
                              </div>
                           </div>

                           <div className="flex items-center gap-4 p-4 bg-red-950/20 border border-red-900/50 rounded-md">
                              <div className="p-2 bg-red-900/50 rounded-full">
                                 <TrendingUp size={24} className="text-red-400" />
                              </div>
                              <div className="flex-1">
                                 <h4 className="text-sm font-bold text-red-400 uppercase">Pricing Committee (L2)</h4>
                                 <p className="text-[10px] text-slate-500">Mandatory escalation to ALCO/Pricing Committee.</p>
                              </div>
                              <div className="w-32">
                                 <InputGroup label="Min RAROC (%)">
                                    <TextInput
                                       type="number"
                                       value={approvalMatrix?.l2Threshold}
                                       onChange={(e) => handleGovernanceChange('l2Threshold', e.target.value)}
                                       className="text-right font-bold text-red-400"
                                    />
                                 </InputGroup>
                              </div>
                           </div>

                           <div className="text-center p-4 border border-dashed border-slate-700 rounded text-slate-500 text-xs">
                              <XCircle size={16} className="mx-auto mb-1 text-slate-600" />
                              Deals below L2 threshold are automatically rejected.
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            ) : (
               // --- MASTER DATA TAB ---
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
               </div>
            )}

            {/* Edit Drawer */}
            <Drawer
               isOpen={isDrawerOpen}
               onClose={closeDrawer}
               title={
                  activeTab === 'MASTER' ? "Master Data Editor" :
                     mode === 'METHODOLOGY' ? (editingRule.id ? "Edit Rule" : "New Rule") : "Configuration Editor"
               }
               footer={
                  <div className="flex justify-end gap-2">
                     <button onClick={closeDrawer} className="px-4 py-2 text-xs text-slate-400 hover:text-white">Cancel</button>
                     <button
                        onClick={
                           activeTab === 'GENERAL' ? handleSaveRule :
                              activeTab === 'RATE_CARDS' ? handleSaveRateCard :
                                 activeTab === 'ESG' ? handleSaveEsg :
                                    activeTab === 'MASTER' ? (
                                       editingClient ? handleSaveClient :
                                          editingProduct ? handleSaveProduct :
                                             editingBU ? handleSaveBU : closeDrawer
                                    ) :
                                       closeDrawer
                        }
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded"
                     >
                        Save Changes
                     </button>
                  </div>
               }
            >
               {/* Conditional Forms based on Tab */}
               {activeTab === 'GENERAL' && (
                  <div className="space-y-4">
                     <InputGroup label="Business Unit">
                        <SelectInput value={editingRule.businessUnit} onChange={(e) => setEditingRule({ ...editingRule, businessUnit: e.target.value })}>
                           {businessUnits.map(bu => <option key={bu.id} value={bu.name}>{bu.name}</option>)}
                           <option value="All">All Units</option>
                        </SelectInput>
                     </InputGroup>
                     <InputGroup label="Product Type">
                        <SelectInput value={editingRule.product} onChange={(e) => setEditingRule({ ...editingRule, product: e.target.value })}>
                           <option>Commercial Loan</option><option>Mortgage</option><option>Term Deposit</option><option>Any</option>
                        </SelectInput>
                     </InputGroup>
                     <InputGroup label="Segment">
                        <SelectInput value={editingRule.segment} onChange={(e) => setEditingRule({ ...editingRule, segment: e.target.value })}>
                           <option>Corporate</option><option>SME</option><option>Retail</option><option>All</option>
                        </SelectInput>
                     </InputGroup>
                     <InputGroup label="Tenor Logic">
                        <SelectInput value={editingRule.tenor} onChange={(e) => setEditingRule({ ...editingRule, tenor: e.target.value })}>
                           <option>{'< 1Y'}</option><option>{'> 1Y'}</option><option>Any</option><option>Fixed</option>
                        </SelectInput>
                     </InputGroup>

                     {/* Base Method Selector */}
                     <div className="p-3 bg-slate-900 rounded border border-slate-800 my-4">
                        <h5 className="text-[10px] font-bold text-slate-500 mb-2 uppercase">Base Method</h5>
                        <div className="space-y-2 mb-3">
                           <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                              <input type="radio" checked={editingRule.baseMethod === 'Matched Maturity'} onChange={() => setEditingRule({ ...editingRule, baseMethod: 'Matched Maturity' })} />
                              Matched Maturity (Standard)
                           </label>
                           <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                              <input type="radio" checked={editingRule.baseMethod === 'Rate Card'} onChange={() => setEditingRule({ ...editingRule, baseMethod: 'Rate Card' })} />
                              Rate Card / Grid Pricing
                           </label>
                           <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                              <input type="radio" checked={editingRule.baseMethod === 'Moving Average'} onChange={() => setEditingRule({ ...editingRule, baseMethod: 'Moving Average' })} />
                              Moving Average (Smoothed)
                           </label>
                        </div>

                        <InputGroup label="Base Reference Curve">
                           <SelectInput value={editingRule.baseReference} onChange={(e) => setEditingRule({ ...editingRule, baseReference: e.target.value })}>
                              {AVAILABLE_BASE_CURVES.map(c => <option key={c} value={c}>{c}</option>)}
                           </SelectInput>
                        </InputGroup>
                     </div>

                     {/* Liquidity/Spread Method Selector */}
                     <div className="p-3 bg-slate-900 rounded border border-slate-800 my-4">
                        <h5 className="text-[10px] font-bold text-slate-500 mb-2 uppercase">Liquidity / Spread Method</h5>
                        <div className="space-y-2 mb-3">
                           <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                              <input type="radio" checked={editingRule.spreadMethod === 'Curve Lookup'} onChange={() => setEditingRule({ ...editingRule, spreadMethod: 'Curve Lookup' })} />
                              Curve Lookup (Standard)
                           </label>
                           <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                              <input type="radio" checked={editingRule.spreadMethod === 'Fixed Spread'} onChange={() => setEditingRule({ ...editingRule, spreadMethod: 'Fixed Spread' })} />
                              Fixed Spread (Flat)
                           </label>
                           <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                              <input type="radio" checked={editingRule.spreadMethod === 'Grid Pricing'} onChange={() => setEditingRule({ ...editingRule, spreadMethod: 'Grid Pricing' })} />
                              Grid Pricing (Tenor/Credit)
                           </label>
                           <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                              <input type="radio" checked={editingRule.spreadMethod === 'Dynamic Beta'} onChange={() => setEditingRule({ ...editingRule, spreadMethod: 'Dynamic Beta' })} />
                              Dynamic Beta
                           </label>
                        </div>

                        <InputGroup label="Liquidity Reference">
                           <SelectInput value={editingRule.liquidityReference} onChange={(e) => setEditingRule({ ...editingRule, liquidityReference: e.target.value })}>
                              <option value="">-- Select Liquidity Curve --</option>
                              {ftpRateCards.filter(c => c.type === 'Liquidity').map(c => (
                                 <option key={c.id} value={c.id}>{c.name} ({c.currency})</option>
                              ))}
                           </SelectInput>
                        </InputGroup>
                     </div>

                     <InputGroup label="Strategic Spread (bps)">
                        <TextInput type="number" value={editingRule.strategicSpread} onChange={(e) => setEditingRule({ ...editingRule, strategicSpread: parseFloat(e.target.value) })} />
                     </InputGroup>
                  </div>
               )}

               {activeTab === 'RATE_CARDS' && editingRateCard && (
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
                           <button onClick={() => setEditingRateCard({ ...editingRateCard, grid: [...editingRateCard.grid!, { tenor: '1Y', spread: 0 }] })} className="text-xs text-cyan-400 hover:text-white flex items-center gap-1"><Plus size={10} /> Add</button>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                           {editingRateCard.grid?.map((pt, i) => (
                              <div key={i} className="flex gap-2 items-center">
                                 <TextInput value={pt.tenor} onChange={(e) => {
                                    const g = [...editingRateCard.grid!]; g[i].tenor = e.target.value; setEditingRateCard({ ...editingRateCard, grid: g });
                                 }} className="w-16 text-center" />
                                 <div className="flex-1 relative">
                                    <TextInput type="number" value={pt.spread} onChange={(e) => {
                                       const g = [...editingRateCard.grid!]; g[i].spread = parseFloat(e.target.value); setEditingRateCard({ ...editingRateCard, grid: g });
                                    }} className="w-full text-right pr-8" />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">bps</span>
                                 </div>
                                 <button onClick={() => setEditingRateCard({ ...editingRateCard, grid: editingRateCard.grid!.filter((_, idx) => idx !== i) })} className="text-slate-600 hover:text-red-400"><X size={14} /></button>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
               )}

               {activeTab === 'ESG' && editingEsg && (
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

               {activeTab === 'MASTER' && editingClient && (
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

               {activeTab === 'MASTER' && editingProduct && (
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

               {activeTab === 'MASTER' && editingBU && (
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
      </Panel>
   );
};

export default MethodologyConfig;
