
import React, { useState } from 'react';
import { Transaction, ClientEntity, ProductDefinition, BusinessUnit } from '../../types';
import { MOCK_BEHAVIOURAL_MODELS, INITIAL_DEAL, EMPTY_DEAL } from '../../constants';
import { InputGroup, TextInput, SelectInput, Panel, Badge } from '../ui/LayoutComponents';
import { Drawer } from '../ui/Drawer';
import { ShieldAlert, Leaf, Waves, BarChart3, UserPlus, Building2, Briefcase, FileSearch, Settings, ChevronDown, ChevronUp, Sliders, PlayCircle } from 'lucide-react';
import { translations, Language } from '../../translations';

interface Props {
   values: Transaction;
   onChange: (key: keyof Transaction, value: any) => void;
   setDealParams: React.Dispatch<React.SetStateAction<Transaction>>;
   deals: Transaction[];
   clients: ClientEntity[];
   setClients: React.Dispatch<React.SetStateAction<ClientEntity[]>>;
   products: ProductDefinition[];
   businessUnits: BusinessUnit[];
   language: Language;
}

const DealInputPanel: React.FC<Props> = ({ values, onChange, setDealParams, deals, clients, setClients, products, businessUnits, language }) => {
   const [showConfig, setShowConfig] = useState(false);
   const t = translations[language];

   // Resolve Client Name for Display
   const currentClient = clients.find(c => c.id === values.clientId);
   const clientDisplayName = currentClient ? currentClient.name : 'No Selection';

   const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>, field: keyof Transaction) => {
      // Handle number and range inputs as numeric values to prevent string concatenation issues and .toFixed errors
      const val = (e.target.type === 'number' || e.target.type === 'range') ? parseFloat(e.target.value) : e.target.value;
      onChange(field, val);
   };

   const handleTransactionSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      if (val === 'NEW') {
         setDealParams(EMPTY_DEAL);
      } else {
         const found = deals.find(d => d.id === val);
         if (found) {
            setDealParams(found);
         }
      }
   };

   const handleClientSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedId = e.target.value;
      const client = clients.find(c => c.id === selectedId);
      if (client) {
         onChange('clientId', client.id);
         onChange('clientType', client.type);
      }
   };

   // Filter models based on product definition category
   const selectedProductDef = products.find(p => p.id === values.productType);
   const availableModels = MOCK_BEHAVIOURAL_MODELS.filter(m => {
      if (selectedProductDef?.category === 'Asset') {
         return m.type === 'Prepayment_CPR';
      }
      return m.type === 'NMD_Replication';
   });

   return (
      <Panel title={t.pricingSimulationEngine || "Pricing Simulation Engine"} className="h-full dark:bg-[#0a0a0a]">
         <div className="flex flex-col h-full text-slate-900 dark:text-slate-200">

            {/* 1. TOP: Deal Selector & Context (Always Visible) */}
            <div className="p-4 bg-white dark:bg-black border-b border-slate-200 dark:border-slate-800">
               <InputGroup label="Active Scenario / Deal Source">
                  <div className="relative">
                     <FileSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-600 dark:text-cyan-400" />
                     <SelectInput
                        value={values.id || ''}
                        onChange={handleTransactionSelect}
                        className="pl-9 font-bold text-cyan-700 dark:text-cyan-200 border-cyan-500/50 focus:border-cyan-400 bg-slate-50 dark:bg-slate-900"
                     >
                        <option value="" disabled>-- Select Existing Deal --</option>
                        {deals.map(d => (
                           <option key={d.id} value={d.id}>{d.id} - {d.clientId} ({d.productType})</option>
                        ))}
                     </SelectInput>
                  </div>
               </InputGroup>

               <div className="flex items-center justify-between mt-2 px-1">
                  <div className="flex items-center gap-2">
                     <Badge variant="default">{clientDisplayName}</Badge>
                     <span className="text-xs text-slate-500">{values.clientType}</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <Badge variant="default">{values.productType}</Badge>
                     <Badge variant={values.currency === 'USD' ? 'success' : 'warning'}>{values.currency}</Badge>
                  </div>
               </div>
            </div>

            {/* 2. MIDDLE: The "Levers" (Simulation Controls) */}
            <div className="p-4 flex-1 overflow-y-auto space-y-6 relative custom-scrollbar">
               <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Sliders size={120} />
               </div>

               {/* Amount Slider */}
               <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center mb-3">
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Principal Amount</label>
                     <span className="text-xs font-mono text-cyan-700 dark:text-cyan-400 font-bold bg-cyan-100 dark:bg-cyan-950/50 px-2 py-0.5 rounded">
                        {values.amount ? new Intl.NumberFormat('en-US', { style: 'currency', currency: values.currency, maximumFractionDigits: 0 }).format(values.amount) : '-'}
                     </span>
                  </div>
                  <input
                     type="range"
                     min="0" max="100000000" step="100000"
                     value={values.amount || 0}
                     onChange={(e) => handleChange(e, 'amount')}
                     className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 transition-all mb-3"
                  />
                  <div className="flex justify-end">
                     <TextInput
                        type="number"
                        value={values.amount || ''}
                        onChange={(e) => handleChange(e, 'amount')}
                        placeholder="0.00"
                        className="w-28 text-right text-xs h-7 font-mono"
                     />
                  </div>
               </div>

               {/* Duration Slider */}
               <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center mb-3">
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t.tenor}</label>
                     <span className="text-xs font-mono text-slate-700 dark:text-slate-300 font-bold bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">
                        {values.durationMonths || 0}m
                     </span>
                  </div>
                  <input
                     type="range"
                     min="0" max="360" step="1"
                     value={values.durationMonths || 0}
                     onChange={(e) => handleChange(e, 'durationMonths')}
                     className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400 transition-all mb-3"
                  />
                  <div className="flex gap-2 items-center">
                     <div className="w-1/2">
                        <SelectInput
                           value={values.amortization}
                           onChange={(e) => handleChange(e, 'amortization')}
                           className="w-full text-xs h-7 py-0"
                        >
                           <option value="Bullet">Bullet</option>
                           <option value="French">French</option>
                           <option value="Linear">Linear</option>
                        </SelectInput>
                     </div>
                     <div className="w-1/2">
                        <TextInput
                           type="number"
                           value={values.durationMonths || ''}
                           onChange={(e) => handleChange(e, 'durationMonths')}
                           className="w-full text-right text-xs h-7 font-mono"
                           placeholder="0"
                        />
                     </div>
                  </div>
               </div>

               {/* Margin Slider */}
               <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center mb-3">
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Target Margin</label>
                     <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-950/30 px-2 py-0.5 rounded">
                        +{Number(values.marginTarget || 0).toFixed(2)}%
                     </span>
                  </div>
                  <input
                     type="range"
                     min="0" max="10" step="0.05"
                     value={values.marginTarget || 0}
                     onChange={(e) => handleChange(e, 'marginTarget')}
                     className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition-all mb-3"
                  />
                  <div className="flex gap-2 items-center justify-end">
                     <div className="w-24 relative">
                        <TextInput
                           type="number"
                           step="0.05"
                           value={values.marginTarget || ''}
                           onChange={(e) => handleChange(e, 'marginTarget')}
                           className="w-full text-right text-xs h-7 font-mono pr-6"
                           placeholder="0.00"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">%</span>
                     </div>
                  </div>
               </div>
            </div>

            {/* 3. BOTTOM: Configuration Drawer Toggle */}
            <div className="border-t border-slate-800 bg-slate-950">
               <button
                  onClick={() => setShowConfig(!showConfig)}
                  className="w-full flex items-center justify-between p-3 text-xs text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
               >
                  <div className="flex items-center gap-2">
                     <Settings size={14} />
                     <span className="uppercase font-bold tracking-wider">Deal Configuration & Assumptions</span>
                  </div>
                  {showConfig ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
               </button>

               {showConfig && (
                  <div className="p-4 grid grid-cols-1 gap-4 bg-slate-900 border-b border-slate-800 animate-in slide-in-from-bottom-5 duration-300 max-h-[300px] overflow-y-auto">

                     {/* Setup: Client & Org */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-slate-800/50">
                        <div className="col-span-1 md:col-span-2">
                           <InputGroup label="Select Client ID">
                              <SelectInput value={values.clientId} onChange={handleClientSelect} className="font-bold text-slate-200">
                                 <option value="">-- Select Client --</option>
                                 {clients.map(c => <option key={c.id} value={c.id}>{c.id} - {c.name}</option>)}
                              </SelectInput>
                           </InputGroup>
                        </div>
                        <InputGroup label="Product Type">
                           <SelectInput value={values.productType} onChange={(e) => handleChange(e, 'productType')}>
                              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.category})</option>)}
                           </SelectInput>
                        </InputGroup>
                        <InputGroup label="Currency">
                           <SelectInput value={values.currency} onChange={(e) => handleChange(e, 'currency')}>
                              <option>USD</option><option>EUR</option><option>GBP</option><option>JPY</option>
                           </SelectInput>
                        </InputGroup>
                        <InputGroup label="Business Unit">
                           <SelectInput value={values.businessUnit} onChange={(e) => handleChange(e, 'businessUnit')}>
                              {businessUnits.map(bu => <option key={bu.id} value={bu.id}>{bu.name}</option>)}
                           </SelectInput>
                        </InputGroup>
                        <InputGroup label="Funding Center">
                           <SelectInput value={values.fundingBusinessUnit} onChange={(e) => handleChange(e, 'fundingBusinessUnit')}>
                              {businessUnits.map(bu => <option key={bu.id} value={bu.id}>{bu.name}</option>)}
                           </SelectInput>
                        </InputGroup>
                     </div>

                     {/* Advanced: Capital & Risk */}
                     <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-800/50">
                        <InputGroup label="Risk Weight (%)">
                           <TextInput type="number" value={values.riskWeight} onChange={(e) => handleChange(e, 'riskWeight')} />
                        </InputGroup>
                        <InputGroup label="Target ROE (%)">
                           <TextInput type="number" value={values.targetROE} onChange={(e) => handleChange(e, 'targetROE')} />
                        </InputGroup>
                        <InputGroup label="Capital Ratio (%)">
                           <TextInput type="number" step="0.1" value={values.capitalRatio} onChange={(e) => handleChange(e, 'capitalRatio')} />
                        </InputGroup>
                        <InputGroup label="Op Cost (bps)">
                           <TextInput type="number" value={values.operationalCostBps} onChange={(e) => handleChange(e, 'operationalCostBps')} />
                        </InputGroup>
                     </div>

                     {/* ESG & Behavioural */}
                     <div className="grid grid-cols-2 gap-4">
                        <InputGroup label="Transition Risk">
                           <SelectInput value={values.transitionRisk} onChange={(e) => handleChange(e, 'transitionRisk')}>
                              <option value="Green">Green</option><option value="Neutral">Neutral</option><option value="Amber">Amber</option><option value="Brown">Brown</option>
                           </SelectInput>
                        </InputGroup>
                        <InputGroup label="Physical Risk">
                           <SelectInput value={values.physicalRisk} onChange={(e) => handleChange(e, 'physicalRisk')}>
                              <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
                           </SelectInput>
                        </InputGroup>
                        <div className="col-span-2">
                           <InputGroup label="Behavioural Model">
                              <SelectInput value={values.behaviouralModelId || ''} onChange={(e) => handleChange(e, 'behaviouralModelId')}>
                                 <option value="">-- None --</option>
                                 {availableModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                              </SelectInput>
                           </InputGroup>
                        </div>
                     </div>

                  </div>
               )}
            </div>

         </div>
      </Panel>
   );
};

export default DealInputPanel;
