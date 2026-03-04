import React, { useState, useEffect } from 'react';
import { Panel } from '../ui/LayoutComponents';
import { ApprovalMatrixConfig, ProductDefinition, BusinessUnit, ClientEntity, GeneralRule, FtpRateCard } from '../../types';
import { GitBranch, FileSpreadsheet, Leaf, ShieldCheck, Database } from 'lucide-react';
import { supabaseService } from '../../utils/supabaseService';

import GeneralRulesTab from './tabs/GeneralRulesTab';
import RateCardsTab from './tabs/RateCardsTab';
import ESGGridTab from './tabs/ESGGridTab';
import GovernanceTab from './tabs/GovernanceTab';
import MasterDataTab from './tabs/MasterDataTab';

interface Props {
   mode: 'METHODOLOGY' | 'SYS_CONFIG' | 'ALL';
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
   ftpRateCards?: FtpRateCard[];
   setFtpRateCards?: React.Dispatch<React.SetStateAction<FtpRateCard[]>>;
   transitionGrid?: any[];
   setTransitionGrid?: React.Dispatch<React.SetStateAction<any[]>>;
   physicalGrid?: any[];
   setPhysicalGrid?: React.Dispatch<React.SetStateAction<any[]>>;
   user: any;
}

const MethodologyConfig: React.FC<Props> = ({
   mode,
   rules, setRules,
   approvalMatrix, setApprovalMatrix,
   products = [], setProducts,
   businessUnits = [], setBusinessUnits,
   clients = [], setClients,
   ftpRateCards = [], setFtpRateCards,
   transitionGrid = [], setTransitionGrid,
   physicalGrid = [], setPhysicalGrid,
   user
}) => {
   const [activeTab, setActiveTab] = useState<'GENERAL' | 'ESG' | 'GOVERNANCE' | 'MASTER' | 'RATE_CARDS'>(
      mode === 'SYS_CONFIG' ? 'RATE_CARDS' : 'GENERAL'
   );
   const [isSeedingDb, setIsSeedingDb] = useState(false);

   useEffect(() => {
      if (mode === 'METHODOLOGY') setActiveTab('GENERAL');
      else if (mode === 'SYS_CONFIG' && activeTab === 'GENERAL') setActiveTab('RATE_CARDS');
   }, [mode]);

   const handleSeedDatabase = async () => {
      if (!window.confirm('¿Restaurar todos los datos de fábrica? Esto sobrescribirá los datos existentes en la base de datos.')) return;
      setIsSeedingDb(true);
      try {
         const result = await supabaseService.seedDatabase();
         if (result.success) {
            alert('✅ Datos restaurados correctamente. La página se recargará.');
            window.location.reload();
         } else {
            alert(`⚠️ Seed completado con errores:\n${result.errors.join('\n')}`);
         }
      } catch (e: any) {
         alert(`❌ Error inesperado: ${e.message}`);
      } finally {
         setIsSeedingDb(false);
      }
   };

   const tabButton = (
      tab: typeof activeTab,
      label: string,
      Icon: React.FC<any>,
      color: string
   ) => (
      <button
         onClick={() => setActiveTab(tab)}
         className={`px-6 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${
            activeTab === tab
               ? `border-${color}-500 text-white bg-slate-800/50`
               : 'border-transparent text-slate-500 hover:text-slate-300'
         }`}
      >
         <div className="flex items-center gap-2">
            <Icon size={14} className={`text-${color}-500`} /> {label}
         </div>
      </button>
   );

   return (
      <Panel title={mode === 'METHODOLOGY' ? "Methodology & Rules Engine" : "System Configuration & Master Data"} className="h-full">
         <div className="flex flex-col h-full">

            {/* Main Tab Navigation */}
            <div className="flex border-b border-slate-700 bg-slate-900 overflow-x-auto">
               {(mode === 'METHODOLOGY' || mode === 'ALL') && (
                  <button
                     onClick={() => setActiveTab('GENERAL')}
                     className={`px-6 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === 'GENERAL' ? 'border-cyan-500 text-white bg-slate-800/50' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                  >
                     <div className="flex items-center gap-2">
                        <GitBranch size={14} className="text-cyan-500" /> General Rules
                     </div>
                  </button>
               )}
               {(mode === 'SYS_CONFIG' || mode === 'ALL') && (
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
               <GeneralRulesTab
                  rules={rules}
                  setRules={setRules}
                  businessUnits={businessUnits}
                  ftpRateCards={ftpRateCards}
                  user={user}
               />
            ) : activeTab === 'RATE_CARDS' ? (
               <RateCardsTab
                  ftpRateCards={ftpRateCards}
                  setFtpRateCards={setFtpRateCards!}
                  user={user}
               />
            ) : activeTab === 'ESG' ? (
               <ESGGridTab
                  transitionGrid={transitionGrid}
                  setTransitionGrid={setTransitionGrid!}
                  physicalGrid={physicalGrid}
                  setPhysicalGrid={setPhysicalGrid!}
                  user={user}
               />
            ) : activeTab === 'GOVERNANCE' ? (
               <GovernanceTab
                  approvalMatrix={approvalMatrix}
                  setApprovalMatrix={setApprovalMatrix}
                  user={user}
               />
            ) : (
               <MasterDataTab
                  clients={clients}
                  setClients={setClients}
                  products={products}
                  setProducts={setProducts}
                  businessUnits={businessUnits}
                  setBusinessUnits={setBusinessUnits}
                  user={user}
               />
            )}

         </div>
      </Panel>
   );
};

export default MethodologyConfig;
