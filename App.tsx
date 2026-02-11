
import React, { useState } from 'react';
import { Transaction, ViewState, ApprovalMatrixConfig, ClientEntity, ProductDefinition, BusinessUnit, GeneralRule, UserProfile } from './types';
import { INITIAL_DEAL, MOCK_CLIENTS, MOCK_PRODUCT_DEFS, MOCK_BUSINESS_UNITS, MOCK_DEALS, MOCK_USERS, MOCK_YIELD_CURVE } from './constants';
import DealInputPanel from './components/Calculator/DealInputPanel';
import MethodologyVisualizer from './components/Calculator/MethodologyVisualizer';
import PricingReceipt from './components/Calculator/PricingReceipt';
import MethodologyConfig from './components/Config/MethodologyConfig';
import DealBlotter from './components/Blotter/DealBlotter';
import YieldCurvePanel from './components/MarketData/YieldCurvePanel';
import AccountingLedger from './components/Accounting/AccountingLedger';
import BehaviouralModels from './components/Behavioural/BehaviouralModels';
import UserManual from './components/Docs/UserManual';
import UserManagement from './components/Admin/UserManagement';
import GeminiAssistant from './components/Intelligence/GeminiAssistant';
import GenAIChat from './components/Intelligence/GenAIChat';
import { Logo } from './components/ui/Logo';
import { LayoutDashboard, Calculator, LineChart, FileText, Settings, Bell, Menu, Activity, BookOpen, Users, Sparkles, BrainCircuit, GitBranch } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('CALCULATOR');
  
  // Active Deal in Calculator (Can be a new deal or one selected from Blotter)
  const [dealParams, setDealParams] = useState<Transaction>(INITIAL_DEAL);
  
  const [matchedMethod, setMatchedMethod] = useState<string>('Matched Maturity');
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  // --- Master Data State ---
  const [clients, setClients] = useState<ClientEntity[]>(MOCK_CLIENTS);
  const [products, setProducts] = useState<ProductDefinition[]>(MOCK_PRODUCT_DEFS);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>(MOCK_BUSINESS_UNITS);
  
  // --- Transaction State ---
  const [deals, setDeals] = useState<Transaction[]>(MOCK_DEALS);

  // --- Rules State ---
  const [rules, setRules] = useState<GeneralRule[]>([
    { id: 1, businessUnit: 'Commercial Banking', product: 'Commercial Loan', segment: 'Corporate', tenor: '< 1Y', baseMethod: 'Matched Maturity', baseReference: 'USD-SOFR', spreadMethod: 'Curve Lookup', liquidityReference: 'RC-LIQ-USD-STD', strategicSpread: 10 },
    { id: 2, businessUnit: 'SME / Business', product: 'Commercial Loan', segment: 'SME', tenor: 'Any', baseMethod: 'Rate Card', baseReference: 'USD-SOFR', spreadMethod: 'Grid Pricing', liquidityReference: 'RC-COM-SME-A', strategicSpread: 25 },
    { id: 3, businessUnit: 'Retail Banking', product: 'Term Deposit', segment: 'Retail', tenor: '> 2Y', baseMethod: 'Moving Average', baseReference: 'EUR-ESTR', spreadMethod: 'Fixed Spread', liquidityReference: 'RC-LIQ-EUR-HY', strategicSpread: 0 },
    { id: 4, businessUnit: 'Retail Banking', product: 'Mortgage', segment: 'All', tenor: 'Fixed', baseMethod: 'Matched Maturity', baseReference: 'USD-SOFR', spreadMethod: 'Curve Lookup', liquidityReference: 'RC-LIQ-USD-STD', strategicSpread: 5 },
  ]);

  // --- Users State ---
  const [users, setUsers] = useState<UserProfile[]>(MOCK_USERS);

  // Global Configuration State
  const [approvalMatrix, setApprovalMatrix] = useState<ApprovalMatrixConfig>({
    autoApprovalThreshold: 15.0, // Target ROE
    l1Threshold: 10.0,
    l2Threshold: 5.0
  });

  // --- AI Assistant State ---
  const [isAiOpen, setIsAiOpen] = useState(false);

  const handleParamChange = (key: keyof Transaction, value: any) => {
    setDealParams(prev => ({ ...prev, [key]: value }));
  };

  // Main Navigation Group
  const mainNavItems = [
    { id: 'CALCULATOR', label: 'Pricing Engine', icon: Calculator },
    { id: 'BLOTTER', label: 'Deal Blotter', icon: FileText },
    { id: 'MARKET_DATA', label: 'Yield Curves', icon: LineChart },
    { id: 'BEHAVIOURAL', label: 'Behavioural Models', icon: Activity },
    { id: 'METHODOLOGY', label: 'Methodology', icon: GitBranch },
    { id: 'ACCOUNTING', label: 'Accounting Ledger', icon: LayoutDashboard },
    { id: 'CONFIG', label: 'System Config', icon: Settings },
  ];

  // Bottom Navigation Group
  const bottomNavItems = [
    { id: 'USER_MGMT', label: 'User Management', icon: Users },
    { id: 'MANUAL', label: 'User Manual', icon: BookOpen },
  ];

  const NavButton = ({ item }: { item: typeof mainNavItems[0] }) => (
    <button
      onClick={() => setCurrentView(item.id as ViewState)}
      className={`w-full flex items-center px-3 py-3 rounded-md text-sm transition-all ${
        currentView === item.id 
          ? 'bg-slate-900 text-white border-l-2 border-cyan-500' 
          : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'
      }`}
    >
      <item.icon size={20} className={currentView === item.id ? 'text-cyan-500' : 'text-slate-600'} />
      {isSidebarOpen && <span className="ml-3 font-medium">{item.label}</span>}
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans selection:bg-cyan-900 selection:text-white overflow-hidden">
      
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-16'} bg-black border-r border-slate-800 transition-all duration-300 flex flex-col z-20 shadow-2xl`}>
        <div className="h-16 flex items-center px-4 border-b border-slate-900">
          <Logo className="w-8 h-8 mr-3 shrink-0" />
          {isSidebarOpen && <span className="font-bold text-xl tracking-tight text-white">N <span className="text-slate-500 font-light">FTPs</span></span>}
        </div>
        
        {/* Main Menu */}
        <nav className="flex-1 p-2 space-y-1 mt-4 overflow-y-auto scrollbar-thin">
          {mainNavItems.map((item) => <NavButton key={item.id} item={item} />)}
        </nav>

        {/* Bottom Menu (User & Manual) */}
        <div className="p-2 border-t border-slate-900 space-y-1">
           {bottomNavItems.map((item) => <NavButton key={item.id} item={item} />)}
        </div>

        {/* System Status Footer */}
        <div className="p-4 border-t border-slate-900">
           {isSidebarOpen ? (
             <div className="bg-slate-900/50 p-3 rounded border border-slate-800/50">
               <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">System Status</div>
               <div className="flex items-center gap-2 text-xs text-emerald-500 font-mono">
                 <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                 CORE: ONLINE
               </div>
               <div className="text-[10px] text-slate-600 mt-1 font-mono">14ms latency</div>
             </div>
           ) : (
             <div className="flex justify-center">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
             </div>
           )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        
        {/* Top Header */}
        <header className="h-14 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="text-slate-400 hover:text-white">
              <Menu size={20} />
            </button>
            <h1 className="text-sm font-semibold text-slate-200 uppercase tracking-widest border-l border-slate-700 pl-4">
              {mainNavItems.find(n => n.id === currentView)?.label || bottomNavItems.find(n => n.id === currentView)?.label || (currentView === 'AI_LAB' ? 'Nexus Prime AI Lab' : 'Pricing Engine')}
            </h1>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1 rounded-full">
              <span className="text-[10px] text-slate-500 font-bold uppercase">Curve Date</span>
              <span className="text-xs font-mono text-cyan-400">LIVE (T+0)</span>
            </div>
            
            <button className="relative text-slate-400 hover:text-white">
              <Bell size={18} />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-slate-900" />
            </button>
            
            <div className="flex items-center gap-3 pl-6 border-l border-slate-700">
               <div className="text-right hidden md:block">
                 <div className="text-xs font-bold text-white">Alex Chen</div>
                 <div className="text-[10px] text-slate-500">Snr. Treasury Mgr</div>
               </div>
               <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center border border-slate-600 text-xs font-bold text-cyan-500">
                 AC
               </div>
            </div>
          </div>
        </header>

        {/* Viewport */}
        <main className="flex-1 p-4 md:p-6 overflow-hidden relative">
          
          {/* Background Grid Pattern */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.02]" 
               style={{ backgroundImage: 'linear-gradient(to right, #334155 1px, transparent 1px), linear-gradient(to bottom, #334155 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
          </div>

          {currentView === 'CALCULATOR' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full relative z-0">
              <div className="lg:col-span-4 h-full min-h-[500px]">
                <DealInputPanel 
                  values={dealParams} 
                  onChange={handleParamChange}
                  setDealParams={setDealParams}
                  deals={deals} // Pass deals for the selection dropdown
                  clients={clients}
                  setClients={setClients}
                  products={products}
                  businessUnits={businessUnits}
                />
              </div>
              <div className="lg:col-span-4 h-full min-h-[300px]">
                <MethodologyVisualizer deal={dealParams} matchedMethod={matchedMethod} />
              </div>
              <div className="lg:col-span-4 h-full min-h-[500px]">
                <PricingReceipt 
                  deal={dealParams} 
                  setMatchedMethod={setMatchedMethod} 
                  approvalMatrix={approvalMatrix}
                />
              </div>
            </div>
          )}

          {currentView === 'BLOTTER' && (
            <div className="h-full relative z-0">
               <DealBlotter 
                  deals={deals} 
                  setDeals={setDeals}
                  products={products}
                  clients={clients}
                  businessUnits={businessUnits}
               />
            </div>
          )}

          {currentView === 'MARKET_DATA' && (
            <div className="h-full relative z-0">
               <YieldCurvePanel />
            </div>
          )}

          {currentView === 'BEHAVIOURAL' && (
            <div className="h-full relative z-0">
               <BehaviouralModels />
            </div>
          )}

          {/* New Methodology View (General Rules Only) */}
          {currentView === 'METHODOLOGY' && (
             <div className="h-full relative z-0">
               <MethodologyConfig 
                  mode="METHODOLOGY"
                  rules={rules}
                  setRules={setRules}
                  // config props passed but ignored by component in METHODOLOGY mode
                  approvalMatrix={approvalMatrix}
                  setApprovalMatrix={setApprovalMatrix}
                  products={products}
                  setProducts={setProducts}
                  businessUnits={businessUnits}
                  setBusinessUnits={setBusinessUnits}
                  clients={clients}
                  setClients={setClients}
               />
             </div>
          )}

          {currentView === 'ACCOUNTING' && (
            <div className="h-full relative z-0">
               <AccountingLedger />
            </div>
          )}

          {/* Config View (Rate Cards, ESG, Master Data) */}
          {currentView === 'CONFIG' && (
             <div className="h-full relative z-0">
               <MethodologyConfig 
                  mode="SYS_CONFIG"
                  rules={rules}
                  setRules={setRules}
                  approvalMatrix={approvalMatrix}
                  setApprovalMatrix={setApprovalMatrix}
                  products={products}
                  setProducts={setProducts}
                  businessUnits={businessUnits}
                  setBusinessUnits={setBusinessUnits}
                  clients={clients}
                  setClients={setClients}
               />
             </div>
          )}

          {currentView === 'USER_MGMT' && (
            <div className="h-full relative z-0">
               <UserManagement users={users} setUsers={setUsers} />
            </div>
          )}

          {currentView === 'MANUAL' && (
            <div className="h-full relative z-0">
               <UserManual />
            </div>
          )}
          
          {currentView === 'AI_LAB' && (
            <div className="h-full relative z-0">
              <GenAIChat 
                deals={deals} 
                marketSummary={`USD Overnight: ${MOCK_YIELD_CURVE[0].rate}%`} 
              />
            </div>
          )}

        </main>
        
        {/* Gemini Intelligence FAB */}
        <button 
           onClick={() => setIsAiOpen(true)}
           className={`fixed bottom-6 right-6 w-12 h-12 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full shadow-[0_0_20px_rgba(8,145,178,0.5)] flex items-center justify-center transition-transform hover:scale-110 z-40 ${isAiOpen ? 'scale-0' : 'scale-100'}`}
        >
           <Sparkles size={24} className="animate-pulse" />
        </button>

        {/* Gemini Panel */}
        <GeminiAssistant 
          isOpen={isAiOpen} 
          onClose={() => setIsAiOpen(false)}
          onOpenFullChat={() => {
              setIsAiOpen(false);
              setCurrentView('AI_LAB');
          }}
          contextData={{
             activeDeal: dealParams,
             marketContext: `Current Base USD Yield Curve: ${JSON.stringify(MOCK_YIELD_CURVE.slice(0,5))}...` 
          }}
        />

      </div>
    </div>
  );
};

export default App;
