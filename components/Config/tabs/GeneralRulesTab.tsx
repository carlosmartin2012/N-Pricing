import React, { useState } from 'react';
import { Panel, Badge, TextInput, InputGroup, SelectInput } from '../../ui/LayoutComponents';
import { Drawer } from '../../ui/Drawer';
import { GeneralRule, FtpRateCard, BusinessUnit, FormulaBaseRateKey, FormulaLPType } from '../../../types';
import { Search, Plus, Edit, FileSpreadsheet, Trash2, Upload } from 'lucide-react';
import { useAudit } from '../../../hooks/useAudit';
import { supabaseService } from '../../../utils/supabaseService';
import { downloadTemplate, parseExcel } from '../../../utils/excelUtils';

interface Props {
   rules: GeneralRule[];
   setRules: React.Dispatch<React.SetStateAction<GeneralRule[]>>;
   businessUnits: BusinessUnit[];
   ftpRateCards: FtpRateCard[];
   user: any;
}

const AVAILABLE_BASE_CURVES = ['USD-SOFR', 'USD-GOVT', 'EUR-ESTR', 'EUR-IBOR', 'GBP-SONIA', 'JPY-TONA'];

const GeneralRulesTab: React.FC<Props> = ({ rules, setRules, businessUnits, ftpRateCards, user }) => {
   const logAudit = useAudit(user);
   const [isDrawerOpen, setDrawerOpen] = useState(false);
   const [editingRule, setEditingRule] = useState<Partial<GeneralRule>>({});

   const closeDrawer = () => {
      setDrawerOpen(false);
      setEditingRule({});
   };

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

         await supabaseService.saveRule({ ...editingRule, id: editingRule.id || Math.floor(Math.random() * 10000) } as GeneralRule);

         logAudit({
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
      logAudit({
         action: 'DELETE_RULE',
         module: 'METHODOLOGY',
         description: `Deleted methodology rule ${id} (${rule?.product})`
      });
      await supabaseService.deleteRule(id);
   };

   const handleDownloadRulesTemplate = () => {
      const liveData = rules.map(r => ({
         BusinessUnit: r.businessUnit,
         Product: r.product,
         Segment: r.segment,
         Tenor: r.tenor,
         BaseMethod: r.baseMethod,
         BaseReference: r.baseReference,
         SpreadMethod: r.spreadMethod,
         LiquidityReference: r.liquidityReference,
         StrategicSpread: r.strategicSpread
      }));
      downloadTemplate('METHODOLOGY', 'Methodology_Rules_Export', liveData);
   };

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
         logAudit({
            action: 'IMPORT_RULES',
            module: 'METHODOLOGY',
            description: `Imported ${newRules.length} methodology rules from Excel`
         });
      }
   };

   return (
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
                     <th className="p-3 text-[10px] uppercase font-bold text-slate-500 border-b border-r border-slate-800">Formula</th>
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
                        <td className="p-3 border-r border-slate-800/50">
                           {rule.formulaSpec ? (
                              <span className="text-[10px] text-indigo-400 bg-indigo-950/30 px-1.5 py-0.5 rounded font-mono">
                                 {rule.formulaSpec.baseRateKey}|{rule.formulaSpec.lpFormula}
                              </span>
                           ) : (
                              <span className="text-slate-600 text-[10px]">auto</span>
                           )}
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

         {/* Edit Drawer */}
         <Drawer
            isOpen={isDrawerOpen}
            onClose={closeDrawer}
            title={editingRule.id ? "Edit Rule" : "New Rule"}
            footer={
               <div className="flex justify-end gap-2">
                  <button onClick={closeDrawer} className="px-4 py-2 text-xs text-slate-400 hover:text-white">Cancel</button>
                  <button
                     onClick={handleSaveRule}
                     className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded"
                  >
                     Save Changes
                  </button>
               </div>
            }
         >
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

               {/* V5.0: Formula Specification */}
               <div className="p-3 bg-indigo-950/30 rounded border border-indigo-800/50 my-4">
                  <h5 className="text-[10px] font-bold text-indigo-400 mb-2 uppercase tracking-wider">Product Formula (V5.0)</h5>
                  <div className="space-y-3">
                     <InputGroup label="Base Rate Key">
                        <SelectInput
                           value={editingRule.formulaSpec?.baseRateKey || 'DTM'}
                           onChange={(e) => setEditingRule({
                              ...editingRule,
                              formulaSpec: { ...editingRule.formulaSpec || { baseRateKey: 'DTM', lpFormula: 'LP_DTM' }, baseRateKey: e.target.value as FormulaBaseRateKey }
                           })}
                        >
                           <option value="DTM">DTM (Contractual Maturity)</option>
                           <option value="BM">BM (Behavioral Maturity)</option>
                           <option value="RM">RM (Repricing Maturity)</option>
                           <option value="MIN_BM_RM">min(BM, RM)</option>
                        </SelectInput>
                     </InputGroup>
                     <InputGroup label="LP Formula">
                        <SelectInput
                           value={editingRule.formulaSpec?.lpFormula || 'LP_DTM'}
                           onChange={(e) => setEditingRule({
                              ...editingRule,
                              formulaSpec: { ...editingRule.formulaSpec || { baseRateKey: 'DTM', lpFormula: 'LP_DTM' }, lpFormula: e.target.value as FormulaLPType }
                           })}
                        >
                           <option value="LP_DTM">LP(DTM) — Standard</option>
                           <option value="LP_BM">LP(BM) — Behavioral</option>
                           <option value="50_50_DTM_1Y">50% LP(DTM) + 50% LP(1Y) — NSFR Floor</option>
                           <option value="SECURED_LP">Secured LP — Collateral Adjusted</option>
                           <option value="BLENDED">Blended LP — SDR Modulated</option>
                        </SelectInput>
                     </InputGroup>
                     <InputGroup label="LP Curve Type">
                        <SelectInput
                           value={editingRule.formulaSpec?.lpCurveType || 'unsecured'}
                           onChange={(e) => setEditingRule({
                              ...editingRule,
                              formulaSpec: { ...editingRule.formulaSpec || { baseRateKey: 'DTM', lpFormula: 'LP_DTM' }, lpCurveType: e.target.value as 'unsecured' | 'secured' }
                           })}
                        >
                           <option value="unsecured">Unsecured</option>
                           <option value="secured">Secured</option>
                        </SelectInput>
                     </InputGroup>
                     <InputGroup label="Sign (Asset/Liability)">
                        <SelectInput
                           value={String(editingRule.formulaSpec?.sign ?? 1)}
                           onChange={(e) => setEditingRule({
                              ...editingRule,
                              formulaSpec: { ...editingRule.formulaSpec || { baseRateKey: 'DTM', lpFormula: 'LP_DTM' }, sign: parseInt(e.target.value) as 1 | -1 }
                           })}
                        >
                           <option value="1">+1 (Asset — LP charged)</option>
                           <option value="-1">-1 (Liability — LP benefit)</option>
                        </SelectInput>
                     </InputGroup>
                  </div>
               </div>

               <InputGroup label="Strategic Spread (bps)">
                  <TextInput type="number" value={editingRule.strategicSpread} onChange={(e) => setEditingRule({ ...editingRule, strategicSpread: parseFloat(e.target.value) })} />
               </InputGroup>
            </div>
         </Drawer>
      </>
   );
};

export default GeneralRulesTab;
