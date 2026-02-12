import React from 'react';
import { Panel } from '../ui/LayoutComponents';
import { BookOpen, Calculator, FileText, LineChart, Activity, Settings, LayoutDashboard, Sparkles } from 'lucide-react';
import { translations, Language } from '../../translations';

// --- Helper Components ---

const TocItem: React.FC<{ targetId: string; label: string }> = ({ targetId, label }) => {
   const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      const element = document.getElementById(targetId);
      if (element) {
         element.scrollIntoView({ behavior: 'smooth' });
      }
   };

   return (
      <button
         onClick={handleClick}
         className="block w-full text-left px-3 py-2 text-sm text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded transition-colors"
      >
         {label}
      </button>
   );
};

const SectionHeader: React.FC<{ icon: any; title: string; color: string }> = ({ icon: Icon, title, color }) => (
   <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
      <Icon size={20} className={color} />
      <h3 className={`text-lg font-bold ${color}`}>{title}</h3>
   </div>
);

const FeatureCard: React.FC<{ title: string; desc: string }> = ({ title, desc }) => (
   <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
      <h4 className="text-sm font-bold text-slate-200 mb-1">{title}</h4>
      <p className="text-xs text-slate-500 leading-snug">{desc}</p>
   </div>
);

// --- Main Component ---

interface UserManualProps {
   language: Language;
}

const UserManual: React.FC<UserManualProps> = ({ language }) => {
   // Fallback configuration if translations are missing or partial
   const t = translations[language] || translations['en'];

   const manualContent = {
      en: {
         introTitle: "Welcome to N Pricing",
         introDesc: "The N Pricing Engine is a high-performance calculation platform designed for modern commercial banking. It enables Treasury and Commercial desks to accurately price liquidity, credit risk, and option costs in real-time, bridging the gap between centralized ALM strategy and front-office execution.",
         pricingTitle: "Pricing Engine & Calculation",
         pricingDesc: "The core of the application. This module allows users to structure new deals or calculate pricing for existing products.",
         inputs: "Configure Amount, Tenor, Product Type, and Spread Targets via industrial sliders.",
         methodology: "Visual decision tree showing how the system selects Matched Maturity vs Moving Averages.",
         waterfall: "Granular breakdown of Base Rate, Liquidity Premium, Strategic Spreads, and Capital Costs.",
         raroc: "Real-time Risk Adjusted Return on Capital calculation compared against hurdle rates.",
         blotterTitle: "Deal Blotter",
         blotterDesc: "A centralized registry of all booked, pending, and rejected transactions. Used for auditing and portfolio management.",
         curvesTitle: "Market Data & Curves",
         curvesDesc: "Visualization of the underlying Government and Swap curves used for transfer pricing.",
         behaviouralTitle: "Behavioural Models",
         behaviouralDesc: "Configuration for non-maturing deposits (NMDs) and loan prepayments.",
         configTitle: "System Configuration",
         configDesc: "Admin panel for setting global rules and master data.",
         accountingTitle: "Accounting Ledger",
         accountingDesc: "Double-entry bookkeeping view of FTP flows between Business Units and Central Treasury.",
         collabTitle: "Real-Time Collaboration",
         collabDesc: "N Pricing is a collaborative multi-user platform. All changes are synchronized instantly across all connected users.",
         realtime: "Broadcast changes in deals, models, and curves to the entire organization as they happen.",
         centralized: "Single source of truth powered by Supabase, replacing local storage for enterprise-grade reliability."
      },
      es: {
         introTitle: "Bienvenido a N Pricing",
         introDesc: "El Motor N Pricing es una plataforma de cálculo de alto rendimiento diseñada para la banca comercial moderna. Permite a las mesas de Tesorería y Comercial estimar con precisión la liquidez, el riesgo de crédito y los costes de opción en tiempo real, cerrando la brecha entre la estrategia ALM centralizada y la ejecución del front-office.",
         pricingTitle: "Motor de Pricing y Cálculo",
         pricingDesc: "El núcleo de la aplicación. Este módulo permite estructurar nuevas operaciones o calcular precios para productos existentes.",
         inputs: "Configure Importe, Plazo, Tipo de Producto y Objetivos de Spread mediante deslizadores industriales.",
         methodology: "Árbol de decisión visual que muestra cómo el sistema selecciona Vencimiento Igualado vs Medias Móviles.",
         waterfall: "Desglose granular de Tasa Base, Prima de Liquidez, Spreads Estratégicos y Costes de Capital.",
         raroc: "Cálculo en tiempo real del Retorno sobre Capital Ajustado al Riesgo (RAROC) comparado con tasas de corte.",
         blotterTitle: "Blotter de Operaciones",
         blotterDesc: "Un registro centralizado de todas las transacciones reservadas, pendientes y rechazadas. Utilizado para auditoría y gestión de cartera.",
         curvesTitle: "Datos de Mercado y Curvas",
         curvesDesc: "Visualización de las curvas de Gobierno y Swap subyacentes utilizadas para los precios de transferencia.",
         behaviouralTitle: "Modelos de Comportamiento",
         behaviouralDesc: "Configuración para depósitos sin vencimiento (NMDs) y prepagos de préstamos.",
         configTitle: "Configuración del Sistema",
         configDesc: "Panel de administración para establecer reglas globales y datos maestros.",
         accountingTitle: "Libro Contable",
         accountingDesc: "Vista de contabilidad de doble entrada de los flujos FTP entre Unidades de Negocio y Tesorería Central.",
         collabTitle: "Colaboración en Tiempo Real",
         collabDesc: "N Pricing es una plataforma colaborativa multiusuario. Todos los cambios se sincronizan instantáneamente entre todos los usuarios conectados.",
         realtime: "Difusión de cambios en operaciones, modelos y curvas a toda la organización según ocurren.",
         centralized: "Fuente única de verdad impulsada por Supabase, reemplazando el almacenamiento local para una fiabilidad empresarial."
      }
   }[language];

   return (
      <Panel title={`N Pricing - ${t.manual}`} className="h-full">
         <div className="flex h-full">
            {/* Table of Contents - Hidden on mobile, visible on desktop */}
            <div className="hidden lg:block w-64 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-4 overflow-y-auto">
               <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Contents</h4>
               <nav className="space-y-1">
                  <TocItem targetId="intro" label={t.intro} />
                  <TocItem targetId="collab" label={manualContent.collabTitle} />
                  <TocItem targetId="calculator" label={t.pricingEngine} />
                  <TocItem targetId="blotter" label={t.dealBlotter} />
                  <TocItem targetId="curves" label={t.yieldCurves} />
                  <TocItem targetId="behavioural" label={t.behaviouralModels} />
                  <TocItem targetId="config" label={t.systemConfig} />
                  <TocItem targetId="accounting" label={t.accountingLedger} />
               </nav>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 scroll-smooth" id="manual-content">
               <div className="max-w-4xl mx-auto space-y-12">

                  {/* Introduction */}
                  <section id="intro" className="space-y-4 pt-4">
                     <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-cyan-950 rounded-lg border border-cyan-900 text-cyan-400">
                           <BookOpen size={24} />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-100">{manualContent.introTitle}</h2>
                     </div>
                     <p className="text-slate-400 leading-relaxed">
                        {manualContent.introDesc}
                     </p>
                  </section>

                  <hr className="border-slate-800" />

                  {/* Collaboration Section */}
                  <section id="collab" className="space-y-4 pt-4">
                     <SectionHeader icon={Sparkles} title={manualContent.collabTitle} color="text-cyan-400" />
                     <p className="text-slate-400">
                        {manualContent.collabDesc}
                     </p>
                     <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <FeatureCard title="Real-Time Sync" desc={manualContent.realtime} />
                        <FeatureCard title="Cloud Persistence" desc={manualContent.centralized} />
                     </ul>
                  </section>

                  {/* Pricing Engine */}
                  <section id="calculator" className="space-y-4 pt-4">
                     <SectionHeader icon={Calculator} title={manualContent.pricingTitle} color="text-emerald-400" />
                     <p className="text-slate-400">
                        {manualContent.pricingDesc}
                     </p>
                     <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <FeatureCard title="Inputs" desc={manualContent.inputs} />
                        <FeatureCard title="Methodology Logic" desc={manualContent.methodology} />
                        <FeatureCard title="Waterfall" desc={manualContent.waterfall} />
                        <FeatureCard title="RAROC" desc={manualContent.raroc} />
                     </ul>
                  </section>

                  {/* Blotter */}
                  <section id="blotter" className="space-y-4 pt-4">
                     <SectionHeader icon={FileText} title={manualContent.blotterTitle} color="text-blue-400" />
                     <p className="text-slate-400">
                        {manualContent.blotterDesc}
                     </p>
                     <ul className="list-disc pl-5 space-y-2 text-slate-400 text-sm">
                        <li><strong className="text-slate-200">Search & Filter:</strong> Locate deals by Client Name, ID, or Status.</li>
                        <li><strong className="text-slate-200">CRUD Actions:</strong> Create new deals manually, edit existing terms, or delete records.</li>
                        <li><strong className="text-slate-200">Shared View:</strong> Changes made by any member of the team appear instantly in your blotter.</li>
                        <li><strong className="text-slate-200">Import/Export:</strong> Bulk upload via CSV/XML and export data for external reporting.</li>
                     </ul>
                  </section>

                  {/* Yield Curves */}
                  <section id="curves" className="space-y-4 pt-4">
                     <SectionHeader icon={LineChart} title={manualContent.curvesTitle} color="text-amber-400" />
                     <p className="text-slate-400">
                        {manualContent.curvesDesc}
                     </p>
                     <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
                        <h5 className="text-sm font-bold text-slate-200 mb-2">Key Features</h5>
                        <ul className="space-y-2 text-sm text-slate-400">
                           <li>• Multi-currency support (USD, EUR, GBP, JPY).</li>
                           <li>• <strong>Shock Analysis:</strong> Apply parallel shifts (bps) to analyze pricing impact.</li>
                           <li>• <strong>Centralized History:</strong> Shared audit trail of curve snapshots across the organization.</li>
                        </ul>
                     </div>
                  </section>

                  {/* Behavioural */}
                  <section id="behavioural" className="space-y-4 pt-4">
                     <SectionHeader icon={Activity} title={manualContent.behaviouralTitle} color="text-purple-400" />
                     <p className="text-slate-400">
                        {manualContent.behaviouralDesc}
                     </p>
                     <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <FeatureCard title="NMD Caterpillar" desc="Define replicating portfolios (tranches) for sticky deposits." />
                        <FeatureCard title="Prepayment (CPR)" desc="Set Constant Prepayment Rates and penalty-free allowances for mortgages." />
                     </ul>
                  </section>

                  {/* Config */}
                  <section id="config" className="space-y-4 pt-4">
                     <SectionHeader icon={Settings} title={manualContent.configTitle} color="text-slate-400" />
                     <p className="text-slate-400">
                        {manualContent.configDesc}
                     </p>
                     <ul className="space-y-2 text-sm text-slate-400 list-disc pl-5">
                        <li><strong>General Rules:</strong> Priority-based logic assignment pivoted by **Business Unit**. Supports distinct **Base Methods** (Risk Free Rate) and **Liquidity/Spread Methods**.</li>
                        <li><strong>Curve References:</strong> Map specific Base Curves (e.g., SOFR, ESTR) and Liquidity Curves (from defined Rate Cards) to each rule.</li>
                        <li><strong>Strategic Spreads:</strong> Apply commercial incentives (negative spread) or risk penalties (positive spread) per rule.</li>
                        <li><strong>FTP Curves:</strong> Manage Liquidity Premia and Credit Spreads.</li>
                        <li><strong>Master Data:</strong> Manage Client Registry, Business Units, and Product Definitions.</li>
                        <li><strong>ESG:</strong> Configure carbon penalties (Transition Risk) and climate risk add-ons (Physical Risk).</li>
                        <li><strong>Governance:</strong> Set RAROC thresholds for auto-approval vs. committee review.</li>
                        <li><strong>System Audit:</strong> Full real-time traceability of all user actions in the administrative log.</li>
                     </ul>
                  </section>

                  {/* Accounting */}
                  <section id="accounting" className="space-y-4 pt-4">
                     <SectionHeader icon={LayoutDashboard} title={manualContent.accountingTitle} color="text-cyan-400" />
                     <p className="text-slate-400">
                        {manualContent.accountingDesc}
                     </p>
                     <div className="p-4 bg-slate-900/50 border-l-4 border-cyan-500">
                        <p className="text-xs font-mono text-slate-300">
                           <strong>T-Account Visualizer:</strong> Click any transaction row to see the breakdown of Debits and Credits across the Commercial Unit and the ALM Desk.
                        </p>
                     </div>
                  </section>

                  <div className="h-24"></div> {/* Bottom Spacer */}
               </div>
            </div>
         </div>
      </Panel>
   );
};

export default UserManual;


