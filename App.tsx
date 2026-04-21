import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { useEntity } from './contexts/EntityContext';
import { Sparkles } from 'lucide-react';
import { INITIAL_DEAL } from './utils/seedData';
import type { Transaction } from './types';
import { buildBottomNavItems, buildMainNavItems } from './appNavigation';
import { Login } from './components/ui/Login';
import { Header } from './components/ui/Header';
import { Sidebar } from './components/ui/Sidebar';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { CommandPalette } from './components/ui/CommandPalette';
import { SkipNav } from './components/ui/SkipNav';
import AppLayout from './components/ui/AppLayout';
import { PricingStateProvider } from './contexts/PricingStateContext';
import { useAuth } from './contexts/AuthContext';
import { useWalkthrough } from './contexts/WalkthroughContext';
import { FIRST_LOGIN_TOUR_ID } from './constants/walkthroughTours';
import { useData } from './contexts/DataContext';
import { useUI } from './contexts/UIContext';
import { useSupabaseSync } from './hooks/useSupabaseSync';
import { useUniversalImport } from './hooks/useUniversalImport';
import { useOfflineStatus } from './hooks/useOfflineStatus';
import { useOfflineSync } from './hooks/useOfflineSync';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { usePresenceAwareness } from './hooks/usePresenceAwareness';

const PricingWorkspace = React.lazy(() => import('./components/Pricing/PricingWorkspace'));
const PricingLayoutShell = React.lazy(() => import('./components/Pricing/PricingLayoutShell'));
const CalculatorWorkspaceLazy = React.lazy(() =>
  import('./components/Calculator/CalculatorWorkspace').then((m) => ({ default: m.CalculatorWorkspace })),
);
const RAROCCalculatorLazy = React.lazy(() => import('./components/RAROC/RAROCCalculator'));
const ShocksDashboardLazy = React.lazy(() => import('./components/Risk/ShocksDashboard'));
const WhatIfWorkspaceLazy = React.lazy(() => import('./components/WhatIf/WhatIfWorkspace'));
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
const NotificationCenter = React.lazy(() => import('./components/Notifications/NotificationCenter'));
const HealthDashboard = React.lazy(() => import('./components/Admin/HealthDashboard'));
const SLOPanel = React.lazy(() => import('./components/Admin/SLOPanel'));
const AdapterHealthPanel = React.lazy(() => import('./components/Admin/AdapterHealthPanel'));
const TargetGridView = React.lazy(() => import('./components/TargetGrid/TargetGridView'));
const CustomerPricingView = React.lazy(() => import('./components/Customer360/CustomerPricingView'));
const CampaignsView = React.lazy(() => import('./components/Campaigns/CampaignsView'));
const EscalationsView = React.lazy(() => import('./components/Governance/EscalationsView'));
const ModelInventoryView = React.lazy(() => import('./components/Governance/ModelInventoryView'));
const DossiersView = React.lazy(() => import('./components/Governance/DossiersView'));
const SnapshotReplayView = React.lazy(() => import('./components/Governance/SnapshotReplayView'));
const CustomerDrawer = React.lazy(() => import('./components/Customer360/CustomerDrawer'));
const UserConfigModal = React.lazy(() =>
  import('./components/ui/UserConfigModal').then((module) => ({
    default: module.UserConfigModal,
  }))
);
const UniversalImportModal = React.lazy(() =>
  import('./components/ui/UniversalImportModal').then((module) => ({
    default: module.UniversalImportModal,
  }))
);
const WalkthroughOverlay = React.lazy(() =>
  import('./components/ui/WalkthroughOverlay').then((module) => ({
    default: module.WalkthroughOverlay,
  }))
);

import { CalculatorSkeleton, TableSkeleton, DashboardSkeleton, ConfigSkeleton } from './components/ui/ViewSkeleton';

const ViewSkeleton: React.FC = () => {
  const path = window.location.pathname;
  if (path === '/pricing') return <CalculatorSkeleton />;
  if (path === '/blotter' || path === '/users' || path === '/audit') return <TableSkeleton />;
  if (path === '/analytics' || path === '/raroc' || path === '/stress-testing' || path === '/health' || path === '/discipline' || path === '/what-if') return <DashboardSkeleton />;
  if (path === '/target-grid') return <TableSkeleton />;
  if (path === '/methodology' || path === '/behavioural') return <ConfigSkeleton />;
  return <DashboardSkeleton />;
};

const AppContent: React.FC = () => {
  const { currentUser, isAuthenticated, handleLogin, handleLogout } = useAuth();
  const data = useData();
  const ui = useUI();
  const walkthrough = useWalkthrough();
  const handleUniversalImport = useUniversalImport();

  // Auto-start the business-flow tour on the very first authenticated render
  // for users who have never completed (nor explicitly skipped) it. Storage is
  // persisted by WalkthroughContext, so subsequent logins do not re-trigger.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (walkthrough.isActive) return;
    if (walkthrough.hasCompletedTour(FIRST_LOGIN_TOUR_ID)) return;
    const timer = setTimeout(() => walkthrough.startTour(FIRST_LOGIN_TOUR_ID), 600);
    return () => clearTimeout(timer);
  }, [isAuthenticated, walkthrough]);

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useSupabaseSync();
  useOfflineStatus();
  useKeyboardShortcuts({
    onToggleSearch: () => setIsCommandPaletteOpen((prev) => !prev),
    onCloseModal: () => {
      if (isCommandPaletteOpen) { setIsCommandPaletteOpen(false); return; }
      ui.setIsConfigModalOpen(false);
      ui.setIsImportModalOpen(false);
      ui.setIsAiOpen(false);
    },
  });
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

  useEffect(() => {
    setDealParams(INITIAL_DEAL);
  }, [data.dataMode]);

  const mainNavItems = useMemo(() => buildMainNavItems(ui.t), [ui.t]);
  const bottomNavItems = useMemo(() => buildBottomNavItems(ui.t), [ui.t]);

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
          themeMode={ui.themeMode}
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
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          dataMode={data.dataMode}
          syncStatus={data.syncStatus}
          onDataModeChange={data.setDataMode}
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
                    <div className="mt-1 text-xs text-[color:var(--nfq-text-muted)]">{data.dataMode === 'demo' ? 'Demo book' : 'Live book'}</div>
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
                {/* Pricing state provider — controlled by App.tsx's existing
                    useState so prop-drilled components keep working. New
                    components can read via usePricingState() without props. */}
                <PricingStateProvider controlled={{ value: dealParams, setValue: setDealParams }}>
                <Suspense fallback={<ViewSkeleton />}>
                  <Routes>
                    {/* Pricing workspaces — 4 tabs share PricingLayoutShell
                        (tab bar). Each child route reads dealParams from
                        PricingStateContext. The PricingWorkspace wrapper
                        (legacy shell) is preserved for rollback but no
                        longer the default path target. */}
                    <Route element={<PricingLayoutShell />}>
                      <Route path="/pricing"        element={<CalculatorWorkspaceLazy />} />
                      <Route path="/raroc"          element={<RAROCCalculatorLazy />} />
                      <Route path="/stress-testing" element={<ShocksDashboardLazy />} />
                      <Route path="/what-if"        element={<WhatIfWorkspaceLazy />} />
                    </Route>
                    {/* Legacy route — kept for emergency rollback. Remove
                        once the nested layout above is stable in prod. */}
                    <Route path="/pricing-legacy" element={<PricingWorkspace dealParams={dealParams} setDealParams={setDealParams} />} />

                    {/* Bare layout — routes that want h-full without flex-col */}
                    <Route element={<AppLayout variant="bare" />}>
                      <Route path="/blotter"      element={<DealBlotter />} />
                      <Route path="/market-data"  element={<YieldCurvePanel />} />
                      <Route path="/behavioural"  element={<BehaviouralModels />} />
                      <Route path="/methodology"  element={<MethodologyConfig mode="ALL" />} />
                      <Route path="/accounting"   element={<AccountingLedger />} />
                      <Route path="/manual"       element={<UserManual />} />
                    </Route>

                    {/* flex-col layout — routes that vertically stack toolbar + content */}
                    <Route element={<AppLayout variant="flex-col" />}>
                      <Route path="/analytics"     element={<ReportingDashboard />} />
                      <Route path="/discipline"    element={<ReportingDashboard initialTab="discipline" />} />
                      <Route path="/users"         element={<UserManagement />} />
                      <Route path="/audit"         element={<AuditLog />} />
                      <Route path="/health"        element={<HealthDashboard />} />
                      <Route path="/slo"           element={<SLOPanel />} />
                      <Route path="/adapters"      element={<AdapterHealthPanel />} />
                      <Route path="/notifications" element={<NotificationCenter />} />
                      <Route path="/ai"            element={<GenAIChat />} />
                      <Route path="/target-grid"   element={<TargetGridView />} />
                      <Route path="/customers"     element={<CustomerPricingView />} />
                      <Route path="/campaigns"     element={<CampaignsView />} />
                      <Route path="/escalations"   element={<EscalationsView />} />
                      <Route path="/models"        element={<ModelInventoryView />} />
                      <Route path="/dossiers"      element={<DossiersView />} />
                      <Route path="/snapshots"     element={<SnapshotReplayView />} />
                    </Route>

                    <Route path="/" element={<Navigate to="/pricing" replace />} />
                    <Route path="*" element={<Navigate to="/pricing" replace />} />
                  </Routes>
                </Suspense>
                </PricingStateProvider>
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
            activeDeal={dealParams}
          />
        </Suspense>

        <Suspense fallback={null}>
          <UserConfigModal
            isOpen={ui.isConfigModalOpen}
            onClose={() => ui.setIsConfigModalOpen(false)}
            language={ui.language}
            setLanguage={ui.setLanguage}
            theme={ui.theme}
            setTheme={ui.setTheme}
            userEmail={currentUser?.email ?? ''}
          />
        </Suspense>

        <Suspense fallback={null}>
          <UniversalImportModal
            isOpen={ui.isImportModalOpen}
            onClose={() => ui.setIsImportModalOpen(false)}
            onImport={handleUniversalImport}
          />
        </Suspense>

        <Suspense fallback={null}>
          <WalkthroughOverlay language={ui.language} />
        </Suspense>

        <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} />

        <Suspense fallback={null}>
          <CustomerDrawer />
        </Suspense>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return <AppContent />;
};

export default App;
