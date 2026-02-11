
import React from 'react';
import { Panel } from '../ui/LayoutComponents';
import { BookOpen, Calculator, FileText, LineChart, Activity, Settings, LayoutDashboard, ShieldCheck, Users } from 'lucide-react';

const UserManual: React.FC = () => {
  return (
    <Panel title="Nexus FTP Engine - User Manual" className="h-full">
      <div className="flex h-full">
        {/* Table of Contents - Hidden on mobile, visible on desktop */}
        <div className="hidden lg:block w-64 border-r border-slate-800 bg-slate-900/50 p-4 space-y-4 overflow-y-auto">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Contents</h4>
            <nav className="space-y-1">
                <TocItem targetId="intro" label="Introduction" />
                <TocItem targetId="calculator" label="Pricing Engine" />
                <TocItem targetId="blotter" label="Deal Blotter" />
                <TocItem targetId="curves" label="Yield Curves" />
                <TocItem targetId="behavioural" label="Behavioural Models" />
                <TocItem targetId="config" label="System Configuration" />
                <TocItem targetId="accounting" label="Accounting Ledger" />
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
                     <h2 className="text-2xl font-bold text-slate-100">Welcome to Nexus FTP</h2>
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                     The Nexus Funds Transfer Pricing (FTP) Engine is a high-performance calculation platform designed for modern commercial banking. 
                     It enables Treasury and Commercial desks to accurately price liquidity, credit risk, and option costs in real-time, bridging the gap between 
                     centralized ALM strategy and front-office execution.
                  </p>
               </section>

               <hr className="border-slate-800" />

               {/* Pricing Engine */}
               <section id="calculator" className="space-y-4 pt-4">
                  <SectionHeader icon={Calculator} title="Pricing Engine & Calculation" color="text-emerald-400" />
                  <p className="text-slate-400">
                     The core of the application. This module allows users to structure new deals or calculate pricing for existing products.
                  </p>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                     <FeatureCard title="Inputs" desc="Configure Amount, Tenor, Product Type, and Spread Targets via industrial sliders." />
                     <FeatureCard title="Methodology Logic" desc="Visual decision tree showing how the system selects Matched Maturity vs Moving Averages." />
                     <FeatureCard title="Waterfall" desc="Granular breakdown of Base Rate, Liquidity Premium, Strategic Spreads, and Capital Costs." />
                     <FeatureCard title="RAROC" desc="Real-time Risk Adjusted Return on Capital calculation compared against hurdle rates." />
                  </ul>
               </section>

               {/* Blotter */}
               <section id="blotter" className="space-y-4 pt-4">
                  <SectionHeader icon={FileText} title="Deal Blotter" color="text-blue-400" />
                  <p className="text-slate-400">
                     A centralized registry of all booked, pending, and rejected transactions. Used for auditing and portfolio management.
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-slate-400 text-sm">
                     <li><strong className="text-slate-200">Search & Filter:</strong> Locate deals by Client Name, ID, or Status.</li>
                     <li><strong className="text-slate-200">CRUD Actions:</strong> Create new deals manually, edit existing terms, or delete records.</li>
                     <li><strong className="text-slate-200">Import/Export:</strong> Bulk upload via CSV/XML and export data for external reporting.</li>
                  </ul>
               </section>

               {/* Yield Curves */}
               <section id="curves" className="space-y-4 pt-4">
                  <SectionHeader icon={LineChart} title="Market Data & Curves" color="text-amber-400" />
                  <p className="text-slate-400">
                     Visualization of the underlying Government and Swap curves used for transfer pricing.
                  </p>
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
                      <h5 className="text-sm font-bold text-slate-200 mb-2">Key Features</h5>
                      <ul className="space-y-2 text-sm text-slate-400">
                          <li>• Multi-currency support (USD, EUR, GBP, JPY).</li>
                          <li>• <strong>Shock Analysis:</strong> Apply parallel shifts (bps) to analyze pricing impact.</li>
                          <li>• Historical audit trail of curve snapshots.</li>
                      </ul>
                  </div>
               </section>

               {/* Behavioural */}
               <section id="behavioural" className="space-y-4 pt-4">
                  <SectionHeader icon={Activity} title="Behavioural Models" color="text-purple-400" />
                  <p className="text-slate-400">
                     Configuration for non-maturing deposits (NMDs) and loan prepayments.
                  </p>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                     <FeatureCard title="NMD Caterpillar" desc="Define replicating portfolios (tranches) for sticky deposits." />
                     <FeatureCard title="Prepayment (CPR)" desc="Set Constant Prepayment Rates and penalty-free allowances for mortgages." />
                  </ul>
               </section>

               {/* Config */}
               <section id="config" className="space-y-4 pt-4">
                  <SectionHeader icon={Settings} title="System Configuration" color="text-slate-400" />
                  <p className="text-slate-400">
                     Admin panel for setting global rules and master data.
                  </p>
                  <ul className="space-y-2 text-sm text-slate-400 list-disc pl-5">
                     <li><strong>General Rules:</strong> Priority-based logic assignment pivoted by **Business Unit**. Supports distinct **Base Methods** (Risk Free Rate) and **Liquidity/Spread Methods**.</li>
                     <li><strong>Curve References:</strong> Map specific Base Curves (e.g., SOFR, ESTR) and Liquidity Curves (from defined Rate Cards) to each rule.</li>
                     <li><strong>Strategic Spreads:</strong> Apply commercial incentives (negative spread) or risk penalties (positive spread) per rule.</li>
                     <li><strong>FTP Curves:</strong> Manage Liquidity Premia and Credit Spreads.</li>
                     <li><strong>Master Data:</strong> Manage Client Registry, Business Units, and Product Definitions.</li>
                     <li><strong>ESG:</strong> Configure carbon penalties (Transition Risk) and climate risk add-ons (Physical Risk).</li>
                     <li><strong>Governance:</strong> Set RAROC thresholds for auto-approval vs. committee review.</li>
                  </ul>
               </section>

               {/* Accounting */}
               <section id="accounting" className="space-y-4 pt-4">
                  <SectionHeader icon={LayoutDashboard} title="Accounting Ledger" color="text-cyan-400" />
                  <p className="text-slate-400">
                     Double-entry bookkeeping view of FTP flows between Business Units and Central Treasury.
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

export default UserManual;
