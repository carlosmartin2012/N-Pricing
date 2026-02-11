
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
import { Sidebar } from './components/ui/Sidebar';
import { Header } from './components/ui/Header';
import { Calculator, LineChart, FileText, Settings, Activity, BookOpen, Users, Sparkles, GitBranch, LayoutDashboard } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('CALCULATOR');
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

  const mainNavItems = [
    { id: 'CALCULATOR', label: 'Pricing Engine', icon: Calculator },
    { id: 'BLOTTER', label: 'Deal Blotter', icon: FileText },
    { id: 'MARKET_DATA', label: 'Yield Curves', icon: LineChart },
    { id: 'BEHAVIOURAL', label: 'Behavioural Models', icon: Activity },
    { id: 'METHODOLOGY', label: 'Methodology', icon: GitBranch },
    { id: 'ACCOUNTING', label: 'Accounting Ledger', icon: LayoutDashboard },
    { id: 'CONFIG', label: 'System Config', icon: Settings },
  ];

  const bottomNavItems = [
    { id: 'USER_MGMT', label: 'User Management', icon: Users },
    { id: 'MANUAL', label: 'User Manual', icon: BookOpen },
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans selection:bg-cyan-900 selection:text-white overflow-hidden">

      <Sidebar
        isSidebarOpen={isSidebarOpen}
        currentView={currentView}
        setCurrentView={setCurrentView}
        mainNavItems={mainNavItems}
        bottomNavItems={bottomNavItems}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 relative">

        <Header
          isSidebarOpen={isSidebarOpen}
          setSidebarOpen={setSidebarOpen}
          currentView={currentView}
          mainNavItems={mainNavItems}
          bottomNavItems={bottomNavItems}
        />

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
                  deals={deals}
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

          {currentView === 'METHODOLOGY' && (
            <div className="h-full relative z-0">
              <MethodologyConfig
                mode="METHODOLOGY"
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

          {currentView === 'ACCOUNTING' && (
            <div className="h-full relative z-0">
              <AccountingLedger />
            </div>
          )}

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
            marketContext: `Current Base USD Yield Curve: ${JSON.stringify(MOCK_YIELD_CURVE.slice(0, 5))}...`
          }}
        />

      </div>
    </div>
  );
};

export default App;
