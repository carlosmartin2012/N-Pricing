import React, { useState } from 'react';
import { Transaction, ViewState, ApprovalMatrixConfig, ClientEntity, ProductDefinition, BusinessUnit, GeneralRule, UserProfile, BehaviouralModel } from './types';
import { INITIAL_DEAL, MOCK_CLIENTS, MOCK_PRODUCT_DEFS, MOCK_BUSINESS_UNITS, MOCK_DEALS, MOCK_USERS, MOCK_YIELD_CURVE, MOCK_BEHAVIOURAL_MODELS } from './constants';
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
import AuditLog from './components/Admin/AuditLog';
import GeminiAssistant from './components/Intelligence/GeminiAssistant';
import GenAIChat from './components/Intelligence/GenAIChat';
import { Sidebar } from './components/ui/Sidebar';
import { Header } from './components/ui/Header';
import { Calculator, LineChart, FileText, Settings, Activity, BookOpen, Users, Sparkles, GitBranch, LayoutDashboard, ShieldCheck, Zap } from 'lucide-react';
import { Login } from './components/ui/Login';
import { UserConfigModal } from './components/ui/UserConfigModal';
import { translations, Language } from './translations';

import { storage } from './utils/storage';
import { supabaseService } from './utils/supabaseService';
import ShocksDashboard from './components/Risk/ShocksDashboard';
import { PricingShocks } from './utils/pricingEngine';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => storage.loadCurrentUser());
  const [isAuthenticated, setIsAuthenticated] = useState(!!storage.loadCurrentUser());
  const [theme] = useState<'dark'>('dark');
  const setTheme = () => { }; // Fixed: No-op for enforced dark mode
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [currentView, setCurrentView] = useState<ViewState>('CALCULATOR');

  const [dealParams, setDealParams] = useState<Transaction>(INITIAL_DEAL);
  const [matchedMethod, setMatchedMethod] = useState<string>('Matched Maturity');
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  // Persistent States
  const [clients, setClients] = useState<ClientEntity[]>(() => storage.loadLocal('n_pricing_clients', MOCK_CLIENTS));
  const [products, setProducts] = useState<ProductDefinition[]>(() => storage.loadLocal('n_pricing_products', MOCK_PRODUCT_DEFS));
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>(() => storage.loadLocal('n_pricing_business_units', MOCK_BUSINESS_UNITS));
  const [deals, setDeals] = useState<Transaction[]>(() => storage.getDealsLocal().length > 0 ? storage.getDealsLocal() : MOCK_DEALS);
  const [rules, setRules] = useState<GeneralRule[]>(() => storage.loadLocal('n_pricing_rules', [
    { id: 1, businessUnit: 'Commercial Banking', product: 'Commercial Loan', segment: 'Corporate', tenor: '< 1Y', baseMethod: 'Matched Maturity', baseReference: 'USD-SOFR', spreadMethod: 'Curve Lookup', liquidityReference: 'RC-LIQ-USD-STD', strategicSpread: 10 },
    { id: 2, businessUnit: 'SME / Business', product: 'Commercial Loan', segment: 'SME', tenor: 'Any', baseMethod: 'Rate Card', baseReference: 'USD-SOFR', spreadMethod: 'Grid Pricing', liquidityReference: 'RC-COM-SME-A', strategicSpread: 25 },
    { id: 3, businessUnit: 'Retail Banking', product: 'Term Deposit', segment: 'Retail', tenor: '> 2Y', baseMethod: 'Moving Average', baseReference: 'EUR-ESTR', spreadMethod: 'Fixed Spread', liquidityReference: 'RC-LIQ-EUR-HY', strategicSpread: 0 },
    { id: 4, businessUnit: 'Retail Banking', product: 'Mortgage', segment: 'All', tenor: 'Fixed', baseMethod: 'Matched Maturity', baseReference: 'USD-SOFR', spreadMethod: 'Curve Lookup', liquidityReference: 'RC-LIQ-USD-STD', strategicSpread: 5 },
  ]));
  const [behaviouralModels, setBehaviouralModels] = useState<BehaviouralModel[]>(() => storage.loadLocal('n_pricing_behavioural', MOCK_BEHAVIOURAL_MODELS));
  const [users, setUsers] = useState<UserProfile[]>(() => {
    const localUsers = storage.getUsersLocal();
    // Merge logic: Add MOCK_USERS that are not in local storage
    const merged = [...localUsers];
    MOCK_USERS.forEach(mockUser => {
      if (!merged.some(u => u.email.toLowerCase() === mockUser.email.toLowerCase())) {
        merged.push(mockUser);
      }
    });
    return merged;
  });

  const [approvalMatrix, setApprovalMatrix] = useState<ApprovalMatrixConfig>(() => storage.loadLocal('n_pricing_approval_matrix', {
    autoApprovalThreshold: 15.0,
    l1Threshold: 10.0,
    l2Threshold: 5.0
  }));

  const [shocks, setShocks] = useState<PricingShocks>({ interestRate: 0, liquiditySpread: 0 });

  // --- SUPABASE REAL-TIME LIFECYCLE ---

  // 1. Initial Hydration from Supabase
  React.useEffect(() => {
    const hydrate = async () => {
      const dbDeals = await storage.getDeals();
      if (dbDeals.length > 0) setDeals(dbDeals);

      const dbModels = await storage.getBehaviouralModels();
      if (dbModels.length > 0) setBehaviouralModels(dbModels);
    };
    hydrate();
  }, []);

  // 2. Real-time Subscription
  React.useEffect(() => {
    const channel = supabaseService.subscribeToAll((payload) => {
      const { table, eventType, new: newRecord, old: oldRecord } = payload;

      if (table === 'deals') {
        if (eventType === 'INSERT') setDeals(prev => [newRecord as Transaction, ...prev]);
        if (eventType === 'UPDATE') setDeals(prev => prev.map(d => d.id === newRecord.id ? (newRecord as Transaction) : d));
        if (eventType === 'DELETE') setDeals(prev => prev.filter(d => d.id !== oldRecord.id));
      }

      if (table === 'behavioural_models') {
        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          setBehaviouralModels(prev => {
            const exists = prev.find(m => m.id === newRecord.id);
            return exists ? prev.map(m => m.id === newRecord.id ? (newRecord as BehaviouralModel) : m) : [newRecord as BehaviouralModel, ...prev];
          });
        }
      }
    });

    return () => { channel.unsubscribe(); };
  }, []);

  // 3. Local Auto-Save (Backup Only - Removed global Deal Sync to avoid loops)
  React.useEffect(() => { storage.saveLocal('n_pricing_rules', rules); }, [rules]);
  React.useEffect(() => { storage.saveLocal('n_pricing_clients', clients); }, [clients]);
  React.useEffect(() => { storage.saveLocal('n_pricing_approval_matrix', approvalMatrix); }, [approvalMatrix]);

  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const t = translations[language];

  const handleParamChange = (key: keyof Transaction, value: any) => {
    setDealParams(prev => ({ ...prev, [key]: value }));
  };

  const handleLogin = (email: string) => {
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    let loggedUser: UserProfile;
    if (user) {
      loggedUser = user;
    } else {
      loggedUser = {
        id: 'USR-TEMP',
        name: email.split('@')[0].replace('.', ' '),
        email: email,
        role: 'Trader',
        status: 'Active',
        lastLogin: new Date().toISOString(),
        department: 'General'
      };
    }
    setCurrentUser(loggedUser);
    setIsAuthenticated(true);
    storage.saveCurrentUser(loggedUser);

    storage.addAuditEntry({
      userEmail: email,
      userName: loggedUser.name,
      action: 'LOGIN',
      module: 'CALCULATOR',
      description: `User ${loggedUser.name} logged into the system.`
    });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    storage.saveCurrentUser(null);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} whitelistedEmails={users.map(u => u.email)} language={language} />;
  }

  const mainNavItems = [
    { id: 'CALCULATOR', label: t.pricingEngine, icon: Calculator },
    { id: 'BLOTTER', label: t.dealBlotter, icon: FileText },
    { id: 'MARKET_DATA', label: t.yieldCurves, icon: LineChart },
    { id: 'BEHAVIOURAL', label: t.behaviouralModels, icon: Activity },
    { id: 'METHODOLOGY', label: t.methodology, icon: GitBranch },
    { id: 'ACCOUNTING', label: t.accountingLedger, icon: LayoutDashboard },
    { id: 'SHOCKS', label: t.shocks, icon: Zap },
    { id: 'CONFIG', label: t.systemConfig, icon: Settings },
  ];

  const bottomNavItems = [
    { id: 'USER_CONFIG', label: t.userConfig, icon: Settings },
    { id: 'USER_MGMT', label: t.userMgmt, icon: Users },
    { id: 'AUDIT_LOG', label: t.auditLog, icon: ShieldCheck },
    { id: 'MANUAL', label: t.manual, icon: BookOpen },
  ];

  return (
    <div className={`${theme === 'dark' ? 'dark' : ''}`}>
      <div className="flex h-screen bg-slate-50 text-slate-900 dark:bg-black dark:text-slate-200 font-sans selection:bg-cyan-900 selection:text-white overflow-hidden transition-colors duration-300">

        <Sidebar
          isSidebarOpen={isSidebarOpen}
          currentView={currentView}
          setCurrentView={setCurrentView}
          mainNavItems={mainNavItems}
          bottomNavItems={bottomNavItems}
          onOpenConfig={() => setIsConfigModalOpen(true)}
          language={language}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex-1 flex flex-col min-w-0 relative h-full">

          <Header
            isSidebarOpen={isSidebarOpen}
            setSidebarOpen={setSidebarOpen}
            currentView={currentView}
            mainNavItems={mainNavItems}
            bottomNavItems={bottomNavItems}
            theme={theme}
            setTheme={setTheme}
            language={language}
            setLanguage={setLanguage}
            user={currentUser}
            onLogout={handleLogout}
          />

          <main className="flex-1 p-3 md:p-6 overflow-auto relative h-full custom-scrollbar">
            <div className="absolute inset-0 pointer-events-none opacity-[0.02]"
              style={{ backgroundImage: 'linear-gradient(to right, #334155 1px, transparent 1px), linear-gradient(to bottom, #334155 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
            </div>

            {currentView === 'CALCULATOR' && (
              <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 md:gap-8 relative z-0 min-h-full pb-10">
                <div className="lg:col-span-12 xl:col-span-4 w-full h-full">
                  <DealInputPanel
                    values={dealParams}
                    onChange={handleParamChange}
                    setDealParams={setDealParams}
                    deals={deals}
                    clients={clients}
                    setClients={setClients}
                    products={products}
                    businessUnits={businessUnits}
                    language={language}
                    behaviouralModels={behaviouralModels}
                  />
                </div>
                <div className="lg:col-span-12 xl:col-span-4 w-full h-full">
                  <MethodologyVisualizer deal={dealParams} matchedMethod={matchedMethod} />
                </div>
                <div className="lg:col-span-12 xl:col-span-4 w-full h-full">
                  <PricingReceipt
                    deal={dealParams}
                    setMatchedMethod={setMatchedMethod}
                    approvalMatrix={approvalMatrix}
                    language={language}
                    shocks={shocks}
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
                  language={language}
                />
              </div>
            )}

            {currentView === 'MARKET_DATA' && (
              <div className="h-full relative z-0">
                <YieldCurvePanel language={language} />
              </div>
            )}

            {currentView === 'BEHAVIOURAL' && (
              <div className="h-full relative z-0">
                <BehaviouralModels models={behaviouralModels} setModels={setBehaviouralModels} />
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

            {currentView === 'AUDIT_LOG' && (
              <div className="h-full relative z-0">
                <AuditLog />
              </div>
            )}

            {currentView === 'MANUAL' && (
              <div className="h-full relative z-0">
                <UserManual language={language} />
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

            {currentView === 'SHOCKS' && (
              <div className="h-full relative z-0">
                <ShocksDashboard
                  deal={dealParams}
                  approvalMatrix={approvalMatrix}
                  language={language}
                  shocks={shocks}
                  setShocks={setShocks}
                />
              </div>
            )}

          </main>

          <button
            onClick={() => setIsAiOpen(true)}
            className={`fixed bottom-6 right-6 w-12 h-12 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full shadow-[0_0_20px_rgba(8,145,178,0.5)] flex items-center justify-center transition-transform hover:scale-110 z-40 ${isAiOpen ? 'scale-0' : 'scale-100'}`}
          >
            <Sparkles size={24} className="animate-pulse" />
          </button>

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

          <UserConfigModal
            isOpen={isConfigModalOpen}
            onClose={() => setIsConfigModalOpen(false)}
            language={language}
            setLanguage={setLanguage}
            theme={theme}
            setTheme={setTheme}
          />

        </div>
      </div>
    </div>
  );
};

export default App;
