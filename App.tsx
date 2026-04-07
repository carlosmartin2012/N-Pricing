import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useEntity } from './contexts/EntityContext';
import { Sparkles } from 'lucide-react';
import { INITIAL_DEAL } from './constants';
import type { Transaction } from './types';
import { buildBottomNavItems, buildMainNavItems } from './appNavigation';
import { buildAssistantMarketContext, buildMarketSummary } from './appSummaries';
import { CalculatorWorkspace } from './components/Calculator/CalculatorWorkspace';
import { Login } from './components/ui/Login';
import { Header } from './components/ui/Header';
import { OfflineBadge } from './components/ui/OfflineBadge';
import { Sidebar } from './components/ui/Sidebar';
import { UniversalImportModal } from './components/ui/UniversalImportModal';
import { UserConfigModal } from './components/ui/UserConfigModal';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { SkipNav } from './components/ui/SkipNav';
import { WalkthroughOverlay } from './components/ui/WalkthroughOverlay';
import { useAuth } from './contexts/AuthContext';
import { useData } from './contexts/DataContext';
import { useUI } from './contexts/UIContext';
import { useSupabaseSync } from './hooks/useSupabaseSync';
import { useUniversalImport } from './hooks/useUniversalImport';
import { useOfflineStatus } from './hooks/useOfflineStatus';
import { useOfflineSync } from './hooks/useOfflineSync';
import { usePresenceAwareness } from './hooks/usePresenceAwareness';
import { supabaseService } from './utils/supabaseService';

const MethodologyConfig = React.lazy(() => import('./components/Config/MethodologyConfig'));
const DealBlotter = React.lazy(() => import('./components/Blotter/DealBlotter'));
const YieldCurvePanel = React.lazy(() => import('./components/MarketData/YieldCurvePanel'));
const AccountingLedger = React.lazy(() => import('./components/Accounting/AccountingLedger'));
const BehaviouralModels = React.lazy(() => import('./components/Behavioural/BehaviouralModels'));
const UserManual = React.lazy(() => import('./components/Docs/UserManual'));
const UserManagement = React.lazy(() => import('./components/Admin/UserManagement'));
const AuditLog = React.lazy(() => import('./components/Admin/AuditLog'));
const GeminiAssistant = React.lazy(() => import('./components/Intelligence/GeminiAssistant'));
const GenAIChat = React.lazy(() => import('./components/Intelligence/GenAIChat'));
const ReportingDashboard = React.lazy(() => import('./components/Reporting/ReportingDashboard'));
const RAROCCalculator = React.lazy(() => import('./components/RAROC/RAROCCalculator'));
const ShocksDashboard = React.lazy(() => import('./components/Risk/ShocksDashboard'));
const HealthDashboard = React.lazy(() => import('./components/Admin/HealthDashboard'));

const ViewLoader: React.FC = () => (
  <div className="flex h-full items-center justify-center rounded-[28px] bg-[var(--nfq-bg-surface)]">
    <div className="flex flex-col items-center gap-3">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/20 border-t-cyan-500"
        style={{ boxShadow: '0 0 24px rgba(6, 182, 212, 0.16)' }}
      />
      <span className="nfq-label text-[10px]">Loading module</span>
    </div>
  </div>
);

const AppContent: React.FC = () => {
  const { currentUser, isAuthenticated, handleLogin, handleLogout } = useAuth();
  const data = useData();
  const ui = useUI();
  const handleUniversalImport = useUniversalImport();

  useSupabaseSync();
  useOfflineStatus();
  const { pendingCount, isSyncing, syncAll } = useOfflineSync();

  const { loadUserEntities, activeEntity } = useEntity();

  const { onlineUsers } = usePresenceAwareness({
    userId: currentUser?.id ?? '',
    name: currentUser?.name ?? '',
    email: currentUser?.email ?? '',
    role: currentUser?.role ?? '',
    activeView: ui.currentView,
    activeDealId: undefined,
    entityId: activeEntity?.id,
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (currentUser?.email) {
      void loadUserEntities(currentUser.email);
    }
  }, [currentUser?.email, loadUserEntities]);


  useEffect(() => {
    document.documentElement.dataset.accent = 'cyan';
    if (ui.theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      return;
    }

    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  }, [ui.theme]);

  const [dealParams, setDealParams] = useState<Transaction>(INITIAL_DEAL);
  const [matchedMethod, setMatchedMethod] = useState('Matched Maturity');

  const mainNavItems = useMemo(() => buildMainNavItems(ui.t), [ui.t]);
  const bottomNavItems = useMemo(() => buildBottomNavItems(ui.t), [ui.t]);
  const marketSummary = useMemo(() => buildMarketSummary(data.deals, data.yieldCurves), [data.deals, data.yieldCurves]);
  const assistantMarketContext = useMemo(
    () => buildAssistantMarketContext(data.deals, data.yieldCurves),
    [data.deals, data.yieldCurves]
  );

  if (!isAuthenticated) {
    return <Login onLogin={(email: string) => handleLogin(email, data.users)} language={ui.language} />;
  }

  return (
    <div className="nfq-shell flex h-screen overflow-hidden font-sans text-[color:var(--nfq-text-primary)] transition-colors duration-300">
      <SkipNav />
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

      <div className="relative z-10 flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          isSidebarOpen={ui.isSidebarOpen}
          setSidebarOpen={ui.setSidebarOpen}
          currentView={ui.currentView}
          mainNavItems={mainNavItems}
          bottomNavItems={bottomNavItems}
          theme={ui.theme}
          setTheme={ui.setTheme}
          language={ui.language}
          setLanguage={ui.setLanguage}
          user={currentUser}
          onLogout={handleLogout}
          onOpenImport={() => ui.setIsImportModalOpen(true)}
          entityLabels={{
            entitySwitcher: ui.t.entitySwitcher,
            groupScope: ui.t.groupScope,
            activeEntity: ui.t.activeEntity,
            allEntities: ui.t.allEntities,
          }}
          onlineUsers={onlineUsers}
          offlinePendingCount={pendingCount}
          offlineIsSyncing={isSyncing}
          onOfflineSync={syncAll}
        />

        <main id="main-content" className="relative flex-1 overflow-auto px-3 pb-3 pt-3 md:px-5 md:pb-5 md:pt-4 xl:px-6">
          <div className="nfq-grid-overlay pointer-events-none absolute inset-0 opacity-40" />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent)]" />

          <div className="relative z-10 flex h-full min-h-0 flex-col gap-4">
            <section className="rounded-[28px] bg-[var(--nfq-bg-surface)] px-5 py-5 shadow-[var(--nfq-shadow-platform)] md:px-7 md:py-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-3xl">
                  <div className="nfq-eyebrow">Meridian Obsidian Workspace</div>
                  <h1 className="mt-4 text-[clamp(2rem,3.5vw,56px)] font-semibold tracking-[var(--nfq-tracking-tight)] leading-[1.1] text-[color:var(--nfq-text-primary)]">
                    {mainNavItems.find((item) => item.id === ui.currentView)?.label ||
                      bottomNavItems.find((item) => item.id === ui.currentView)?.label ||
                      'Pricing workspace'}
                  </h1>
                  <p className="mt-3 max-w-2xl text-[14px] leading-6 text-[color:var(--nfq-text-secondary)]">
                    Governed pricing, methodology control, portfolio reporting and committee evidence in one aligned NFQ
                    operating shell.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-[22px] bg-[var(--nfq-bg-elevated)] px-4 py-4">
                    <div className="nfq-label">Deals</div>
                    <div className="font-mono-nums mt-3 text-[28px] font-bold tracking-[var(--nfq-tracking-tight)] text-[color:var(--nfq-text-primary)]">
                      {data.deals.length}
                    </div>
                    <div className="mt-1 text-xs text-[color:var(--nfq-text-muted)]">Live book</div>
                  </div>
                  <div className="rounded-[22px] bg-[var(--nfq-bg-elevated)] px-4 py-4">
                    <div className="nfq-label">Pending</div>
                    <div className="font-mono-nums mt-3 text-[28px] font-bold tracking-[var(--nfq-tracking-tight)] text-[color:var(--nfq-warning)]">
                      {data.deals.filter((deal) => deal.status === 'Pending_Approval').length}
                    </div>
                    <div className="mt-1 text-xs text-[color:var(--nfq-text-muted)]">Approval queue</div>
                  </div>
                  <div className="rounded-[22px] bg-[var(--nfq-bg-elevated)] px-4 py-4">
                    <div className="nfq-label">Snapshots</div>
                    <div className="font-mono-nums mt-3 text-[28px] font-bold tracking-[var(--nfq-tracking-tight)] text-[color:var(--nfq-accent)]">
                      {data.portfolioSnapshots.length}
                    </div>
                    <div className="mt-1 text-xs text-[color:var(--nfq-text-muted)]">Portfolio frames</div>
                  </div>
                  <div className="rounded-[22px] bg-[var(--nfq-bg-elevated)] px-4 py-4">
                    <div className="nfq-label">AI traces</div>
                    <div className="font-mono-nums mt-3 text-[28px] font-bold tracking-[var(--nfq-tracking-tight)] text-violet-300">
                      {data.pricingDossiers.reduce(
                        (count, dossier) => count + (dossier.aiResponseTraces?.length || 0),
                        0
                      )}
                    </div>
                    <div className="mt-1 text-xs text-[color:var(--nfq-text-muted)]">Grounded evidence</div>
                  </div>
                </div>
              </div>
            </section>

            <div className="relative min-h-0 flex-1">
              <ErrorBoundary>
                <Suspense fallback={<ViewLoader />}>
                  {ui.currentView === 'CALCULATOR' && (
                    <CalculatorWorkspace
                      dealParams={dealParams}
                      setDealParams={setDealParams}
                      matchedMethod={matchedMethod}
                      setMatchedMethod={setMatchedMethod}
                      deals={data.deals}
                      clients={data.clients}
                      products={data.products}
                      businessUnits={data.businessUnits}
                      behaviouralModels={data.behaviouralModels}
                      approvalMatrix={data.approvalMatrix}
                      language={ui.language}
                    />
                  )}

                  {ui.currentView === 'BLOTTER' && (
                    <div className="relative z-0 h-full">
                      <DealBlotter
                        deals={data.deals}
                        setDeals={data.setDeals}
                        products={data.products}
                        clients={data.clients}
                        businessUnits={data.businessUnits}
                        language={ui.language}
                        user={currentUser}
                      />
                    </div>
                  )}

                  {ui.currentView === 'REPORTING' && (
                    <div className="relative z-0 flex h-full flex-col">
                      <ReportingDashboard
                        deals={data.deals}
                        products={data.products}
                        businessUnits={data.businessUnits}
                        clients={data.clients}
                      />
                    </div>
                  )}

                  {ui.currentView === 'RAROC' && (
                    <div className="relative z-0 h-full">
                      <RAROCCalculator
                        externalInputs={data.rarocInputs}
                        onUpdateExternal={(inputs) => {
                          data.setRarocInputs(inputs);
                          supabaseService.saveRarocInputs(inputs).catch(console.error);
                        }}
                      />
                    </div>
                  )}

                  {ui.currentView === 'MARKET_DATA' && (
                    <div className="relative z-0 h-full">
                      <YieldCurvePanel language={ui.language} user={currentUser} />
                    </div>
                  )}

                  {ui.currentView === 'BEHAVIOURAL' && (
                    <div className="relative z-0 h-full">
                      <BehaviouralModels
                        models={data.behaviouralModels}
                        setModels={data.setBehaviouralModels}
                        user={currentUser}
                      />
                    </div>
                  )}

                  {(ui.currentView === 'METHODOLOGY' || ui.currentView === 'CONFIG') && (
                    <div className="relative z-0 h-full">
                      <MethodologyConfig
                        mode="ALL"
                        rules={data.rules}
                        setRules={data.setRules}
                        approvalMatrix={data.approvalMatrix}
                        setApprovalMatrix={data.setApprovalMatrix}
                        products={data.products}
                        setProducts={data.setProducts}
                        businessUnits={data.businessUnits}
                        setBusinessUnits={data.setBusinessUnits}
                        clients={data.clients}
                        setClients={data.setClients}
                        ftpRateCards={data.ftpRateCards}
                        setFtpRateCards={data.setFtpRateCards}
                        transitionGrid={data.transitionGrid}
                        setTransitionGrid={data.setTransitionGrid}
                        physicalGrid={data.physicalGrid}
                        setPhysicalGrid={data.setPhysicalGrid}
                        greeniumGrid={data.greeniumGrid}
                        setGreeniumGrid={data.setGreeniumGrid}
                        user={currentUser}
                      />
                    </div>
                  )}

                  {ui.currentView === 'ACCOUNTING' && (
                    <div className="relative z-0 h-full">
                      <AccountingLedger />
                    </div>
                  )}

                  {ui.currentView === 'USER_MGMT' && (
                    <div className="relative z-0 flex h-full flex-col">
                      <UserManagement users={data.users} setUsers={data.setUsers} />
                    </div>
                  )}

                  {ui.currentView === 'AUDIT_LOG' && (
                    <div className="relative z-0 flex h-full flex-col">
                      <AuditLog />
                    </div>
                  )}

                  {ui.currentView === 'HEALTH' && (
                    <div className="relative z-0 flex h-full flex-col">
                      <HealthDashboard />
                    </div>
                  )}

                  {ui.currentView === 'MANUAL' && (
                    <div className="relative z-0 h-full">
                      <UserManual language={ui.language} />
                    </div>
                  )}

                  {ui.currentView === 'AI_LAB' && (
                    <div className="relative z-0 flex h-full flex-col">
                      <GenAIChat deals={data.deals} marketSummary={marketSummary} />
                    </div>
                  )}

                  {ui.currentView === 'SHOCKS' && (
                    <div className="relative z-0 flex h-full flex-col">
                      <ShocksDashboard
                        deal={dealParams}
                        approvalMatrix={data.approvalMatrix}
                        language={ui.language}
                        shocks={data.shocks}
                        setShocks={data.setShocks}
                        user={currentUser}
                      />
                    </div>
                  )}
                </Suspense>
              </ErrorBoundary>
            </div>
          </div>
        </main>

        <button
          onClick={() => ui.setIsAiOpen(true)}
          aria-label="Open AI assistant"
          className={`fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full text-white transition-transform duration-200 hover:scale-105 ${ui.isAiOpen ? 'scale-0' : 'scale-100'}`}
          style={{
            background: 'var(--nfq-accent-gradient)',
            boxShadow: '0 20px 40px rgba(6, 182, 212, 0.22)',
          }}
        >
          <Sparkles size={24} className="animate-pulse" />
        </button>

        <Suspense fallback={null}>
          <GeminiAssistant
            isOpen={ui.isAiOpen}
            onClose={() => ui.setIsAiOpen(false)}
            onOpenFullChat={() => {
              ui.setIsAiOpen(false);
              ui.setCurrentView('AI_LAB');
            }}
            contextData={{
              activeDeal: dealParams,
              marketContext: assistantMarketContext,
            }}
          />
        </Suspense>

        <UserConfigModal
          isOpen={ui.isConfigModalOpen}
          onClose={() => ui.setIsConfigModalOpen(false)}
          language={ui.language}
          setLanguage={ui.setLanguage}
          theme={ui.theme}
          setTheme={ui.setTheme}
          userEmail={currentUser?.email ?? ''}
        />

        <UniversalImportModal
          isOpen={ui.isImportModalOpen}
          onClose={() => ui.setIsImportModalOpen(false)}
          onImport={handleUniversalImport}
        />

        <WalkthroughOverlay language={ui.language} />
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return <AppContent />;
};

export default App;
