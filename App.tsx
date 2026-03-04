import React, { useState, useCallback, useEffect } from 'react';
import { Transaction, ViewState } from './types';
import { INITIAL_DEAL, MOCK_YIELD_CURVE } from './constants';
import { useAuth } from './contexts/AuthContext';
import { useData } from './contexts/DataContext';
import { useUI } from './contexts/UIContext';
import { useSupabaseSync } from './hooks/useSupabaseSync';
import { useUniversalImport } from './hooks/useUniversalImport';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

// Component imports
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
import LiquidityDashboard from './components/Liquidity/LiquidityDashboard';
import ReportingDashboard from './components/Reporting/ReportingDashboard';
import RAROCCalculator from './components/RAROC/RAROCCalculator';
import ShocksDashboard from './components/Risk/ShocksDashboard';
import { Sidebar } from './components/ui/Sidebar';
import { Header } from './components/ui/Header';
import { Login } from './components/ui/Login';
import { UserConfigModal } from './components/ui/UserConfigModal';
import { UniversalImportModal } from './components/ui/UniversalImportModal';

import { supabaseService } from './utils/supabaseService';
import { Calculator, LineChart, FileText, Settings, Activity, BookOpen, Users, Sparkles, GitBranch, LayoutDashboard, Zap, BarChart4, Percent, ShieldCheck, BrainCircuit, TrendingUp } from 'lucide-react';

const AppContent: React.FC = () => {
  const { currentUser, isAuthenticated, handleLogin, handleLogout } = useAuth();
  const data = useData();
  const ui = useUI();
  const handleUniversalImport = useUniversalImport();

  // Initialize Supabase sync
  useSupabaseSync();

  // Theme sync
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Local calculator state
  const [dealParams, setDealParams] = useState<Transaction>(INITIAL_DEAL);
  const [matchedMethod, setMatchedMethod] = useState<string>('Matched Maturity');

  const handleParamChange = useCallback((key: keyof Transaction, value: any) => {
    setDealParams(prev => ({ ...prev, [key]: value }));
  }, []);

  // Login gate
  if (!isAuthenticated) {
    return (
      <Login
        onLogin={(email: string) => handleLogin(email, data.users)}
        language={ui.language}
      />
    );
  }

  const mainNavItems = [
    // ── PRICING ──
    { id: 'CALCULATOR', label: ui.t.pricingEngine, icon: Calculator, section: 'Pricing' },
    { id: 'RAROC', label: 'RAROC Terminal', icon: Percent, section: 'Pricing' },
    { id: 'SHOCKS', label: ui.t.shocks, icon: Zap, section: 'Pricing' },
    // ── PORTFOLIO ──
    { id: 'BLOTTER', label: ui.t.dealBlotter, icon: FileText, section: 'Portfolio' },
    { id: 'ACCOUNTING', label: ui.t.accountingLedger, icon: LayoutDashboard, section: 'Portfolio' },
    // ── ALM & RISK ──
    { id: 'REPORTING', label: 'ALM Reporting', icon: BarChart4, section: 'ALM & Risk' },
    { id: 'MARKET_DATA', label: ui.t.yieldCurves, icon: TrendingUp, section: 'ALM & Risk' },
    // ── CONFIGURATION ──
    { id: 'METHODOLOGY', label: 'Rules & Config', icon: GitBranch, section: 'Configuration' },
    { id: 'BEHAVIOURAL', label: ui.t.behaviouralModels, icon: Activity, section: 'Configuration' },
    { id: 'AI_LAB', label: 'AI Assistant', icon: BrainCircuit, section: 'Configuration' },
  ];

  const bottomNavItems = [
    { id: 'USER_CONFIG', label: ui.t.userConfig, icon: Settings },
    { id: 'USER_MGMT', label: ui.t.userMgmt, icon: Users },
    { id: 'AUDIT_LOG', label: ui.t.auditLog, icon: ShieldCheck },
    { id: 'MANUAL', label: ui.t.manual, icon: BookOpen },
  ];

  const setTheme = () => {};

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 dark:bg-black dark:text-slate-200 font-sans selection:bg-cyan-900 selection:text-white overflow-hidden transition-colors duration-300">
      <Sidebar
        isSidebarOpen={ui.isSidebarOpen}
        currentView={ui.currentView}
        setCurrentView={ui.setCurrentView}
        mainNavItems={mainNavItems}
        bottomNavItems={bottomNavItems}
        onOpenConfig={() => ui.setIsConfigModalOpen(true)}
        language={ui.language}
        onClose={() => ui.setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        <Header
          isSidebarOpen={ui.isSidebarOpen}
          setSidebarOpen={ui.setSidebarOpen}
          currentView={ui.currentView}
          mainNavItems={mainNavItems}
          bottomNavItems={bottomNavItems}
          theme={ui.theme}
          setTheme={setTheme}
          language={ui.language}
          setLanguage={ui.setLanguage}
          user={currentUser}
          onLogout={handleLogout}
          onOpenImport={() => ui.setIsImportModalOpen(true)}
        />

        <main className="flex-1 p-3 md:p-6 overflow-auto relative custom-scrollbar bg-slate-50 dark:bg-black">
          <div
            className="absolute inset-x-0 top-0 bottom-0 pointer-events-none opacity-[0.02]"
            style={{ backgroundImage: 'linear-gradient(to right, #334155 1px, transparent 1px), linear-gradient(to bottom, #334155 1px, transparent 1px)', backgroundSize: '40px 40px' }}
          />

          <ErrorBoundary>
            {ui.currentView === 'CALCULATOR' && (
              <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 md:gap-6 relative z-0 h-full">
                <div className="lg:col-span-4 w-full h-full flex flex-col">
                  <DealInputPanel
                    values={dealParams} onChange={handleParamChange} setDealParams={setDealParams}
                    deals={data.deals} clients={data.clients} setClients={data.setClients}
                    products={data.products} businessUnits={data.businessUnits}
                    language={ui.language} behaviouralModels={data.behaviouralModels}
                  />
                </div>
                <div className="lg:col-span-4 w-full h-full flex flex-col">
                  <MethodologyVisualizer deal={dealParams} matchedMethod={matchedMethod} />
                </div>
                <div className="lg:col-span-4 w-full h-full flex flex-col">
                  <PricingReceipt
                    deal={dealParams} setMatchedMethod={setMatchedMethod}
                    approvalMatrix={data.approvalMatrix} language={ui.language}
                    shocks={data.shocks} user={currentUser}
                  />
                </div>
              </div>
            )}

            {ui.currentView === 'BLOTTER' && (
              <div className="h-full relative z-0">
                <DealBlotter
                  deals={data.deals} setDeals={data.setDeals}
                  products={data.products} clients={data.clients}
                  businessUnits={data.businessUnits} language={ui.language} user={currentUser}
                />
              </div>
            )}

            {ui.currentView === 'REPORTING' && (
              <div className="h-full relative z-0 flex flex-col">
                <ReportingDashboard
                  deals={data.deals} products={data.products}
                  businessUnits={data.businessUnits} shocks={data.shocks} clients={data.clients}
                />
              </div>
            )}

            {ui.currentView === 'RAROC' && (
              <div className="h-full relative z-0">
                <RAROCCalculator
                  externalInputs={data.rarocInputs}
                  onUpdateExternal={(inputs) => {
                    data.setRarocInputs(inputs);
                    supabaseService.saveRarocInputs(inputs);
                  }}
                />
              </div>
            )}

            {ui.currentView === 'MARKET_DATA' && (
              <div className="h-full relative z-0">
                <YieldCurvePanel language={ui.language} user={currentUser} />
              </div>
            )}

            {ui.currentView === 'BEHAVIOURAL' && (
              <div className="h-full relative z-0">
                <BehaviouralModels models={data.behaviouralModels} setModels={data.setBehaviouralModels} user={currentUser} />
              </div>
            )}

            {(ui.currentView === 'METHODOLOGY' || ui.currentView === 'CONFIG') && (
              <div className="h-full relative z-0">
                <MethodologyConfig
                  mode="ALL" rules={data.rules} setRules={data.setRules}
                  approvalMatrix={data.approvalMatrix} setApprovalMatrix={data.setApprovalMatrix}
                  products={data.products} setProducts={data.setProducts}
                  businessUnits={data.businessUnits} setBusinessUnits={data.setBusinessUnits}
                  clients={data.clients} setClients={data.setClients}
                  ftpRateCards={data.ftpRateCards} setFtpRateCards={data.setFtpRateCards}
                  transitionGrid={data.transitionGrid} setTransitionGrid={data.setTransitionGrid}
                  physicalGrid={data.physicalGrid} setPhysicalGrid={data.setPhysicalGrid}
                  user={currentUser}
                />
              </div>
            )}

            {ui.currentView === 'ACCOUNTING' && (
              <div className="h-full relative z-0"><AccountingLedger /></div>
            )}

            {ui.currentView === 'USER_MGMT' && (
              <div className="h-full relative z-0 flex flex-col">
                <UserManagement users={data.users} setUsers={data.setUsers} />
              </div>
            )}

            {ui.currentView === 'AUDIT_LOG' && (
              <div className="h-full relative z-0"><AuditLog /></div>
            )}

            {ui.currentView === 'MANUAL' && (
              <div className="h-full relative z-0"><UserManual language={ui.language} /></div>
            )}

            {ui.currentView === 'AI_LAB' && (
              <div className="h-full relative z-0 flex flex-col">
                <GenAIChat deals={data.deals} marketSummary={`USD Overnight: ${MOCK_YIELD_CURVE[0].rate}%`} />
              </div>
            )}

            {ui.currentView === 'SHOCKS' && (
              <div className="h-full relative z-0 flex flex-col">
                <ShocksDashboard
                  deal={dealParams} approvalMatrix={data.approvalMatrix}
                  language={ui.language} shocks={data.shocks} setShocks={data.setShocks}
                  user={currentUser}
                />
              </div>
            )}
          </ErrorBoundary>
        </main>

        <button
          onClick={() => ui.setIsAiOpen(true)}
          className={`fixed bottom-6 right-6 w-12 h-12 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full shadow-[0_0_20px_rgba(8,145,178,0.5)] flex items-center justify-center transition-transform hover:scale-110 z-40 ${ui.isAiOpen ? 'scale-0' : 'scale-100'}`}
        >
          <Sparkles size={24} className="animate-pulse" />
        </button>

        <GeminiAssistant
          isOpen={ui.isAiOpen}
          onClose={() => ui.setIsAiOpen(false)}
          onOpenFullChat={() => { ui.setIsAiOpen(false); ui.setCurrentView('AI_LAB'); }}
          contextData={{
            activeDeal: dealParams,
            marketContext: `Current Base USD Yield Curve: ${JSON.stringify(MOCK_YIELD_CURVE.slice(0, 5))}...`,
          }}
        />

        <UserConfigModal
          isOpen={ui.isConfigModalOpen}
          onClose={() => ui.setIsConfigModalOpen(false)}
          language={ui.language} setLanguage={ui.setLanguage}
          theme={ui.theme} setTheme={setTheme}
        />

        <UniversalImportModal
          isOpen={ui.isImportModalOpen}
          onClose={() => ui.setIsImportModalOpen(false)}
          onImport={handleUniversalImport}
        />
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return <AppContent />;
};

export default App;
