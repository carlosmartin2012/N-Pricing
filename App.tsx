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
import { useAuth } from './contexts/AuthContext';
import { useData } from './contexts/DataContext';
import { useUI } from './contexts/UIContext';
import { useSupabaseSync } from './hooks/useSupabaseSync';
import { useUniversalImport } from './hooks/useUniversalImport';
import { useOfflineStatus } from './hooks/useOfflineStatus';
import { useOfflineSync } from './hooks/useOfflineSync';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { usePresenceAwareness } from './hooks/usePresenceAwareness';

const CalculatorWorkspace = React.lazy(() =>
  import('./components/Calculator/CalculatorWorkspace').then((module) => ({
    default: module.CalculatorWorkspace,
  }))
);
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
const NotificationCenter = React.lazy(() => import('./components/Notifications/NotificationCenter'));
const HealthDashboard = React.lazy(() => import('./components/Admin/HealthDashboard'));
const TargetGridView = React.lazy(() => import('./components/TargetGrid/TargetGridView'));
const DisciplineDashboard = React.lazy(() => import('./components/Discipline/DisciplineDashboard'));
const WhatIfWorkspace = React.lazy(() => import('./components/WhatIf/WhatIfWorkspace'));
const CustomerPricingView = React.lazy(() => import('./components/Customer360/CustomerPricingView'));
const CampaignsView = React.lazy(() => import('./components/Campaigns/CampaignsView'));
const EscalationsView = React.lazy(() => import('./components/Governance/EscalationsView'));
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
  const handleUniversalImport = useUniversalImport();

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
                <Suspense fallback={<ViewSkeleton />}>
                  <Routes>
                    <Route path="/pricing" element={<CalculatorWorkspace dealParams={dealParams} setDealParams={setDealParams} />} />
                    <Route path="/blotter" element={<div className="relative z-0 h-full"><DealBlotter /></div>} />
                    <Route path="/analytics" element={<div className="relative z-0 flex h-full flex-col"><ReportingDashboard /></div>} />
                    <Route path="/raroc" element={<div className="relative z-0 h-full"><RAROCCalculator /></div>} />
                    <Route path="/market-data" element={<div className="relative z-0 h-full"><YieldCurvePanel /></div>} />
                    <Route path="/behavioural" element={<div className="relative z-0 h-full"><BehaviouralModels /></div>} />
                    <Route path="/methodology" element={<div className="relative z-0 h-full"><MethodologyConfig mode="ALL" /></div>} />
                    <Route path="/accounting" element={<div className="relative z-0 h-full"><AccountingLedger /></div>} />
                    <Route path="/users" element={<div className="relative z-0 flex h-full flex-col"><UserManagement /></div>} />
                    <Route path="/audit" element={<div className="relative z-0 flex h-full flex-col"><AuditLog /></div>} />
                    <Route path="/health" element={<div className="relative z-0 flex h-full flex-col"><HealthDashboard /></div>} />
                    <Route path="/manual" element={<div className="relative z-0 h-full"><UserManual /></div>} />
                    <Route path="/notifications" element={<div className="relative z-0 flex h-full flex-col"><NotificationCenter /></div>} />
                    <Route path="/ai" element={<div className="relative z-0 flex h-full flex-col"><GenAIChat /></div>} />
                    <Route path="/stress-testing" element={<div className="relative z-0 flex h-full flex-col"><ShocksDashboard deal={dealParams} /></div>} />
                    <Route path="/target-grid" element={<div className="relative z-0 flex h-full flex-col"><TargetGridView /></div>} />
                    <Route path="/discipline" element={<div className="relative z-0 flex h-full flex-col"><DisciplineDashboard /></div>} />
                    <Route path="/what-if" element={<div className="relative z-0 flex h-full flex-col"><WhatIfWorkspace /></div>} />
                    <Route path="/customers" element={<div className="relative z-0 flex h-full flex-col"><CustomerPricingView /></div>} />
                    <Route path="/campaigns" element={<div className="relative z-0 flex h-full flex-col"><CampaignsView /></div>} />
                    <Route path="/escalations" element={<div className="relative z-0 flex h-full flex-col"><EscalationsView /></div>} />
                    <Route path="/" element={<Navigate to="/pricing" replace />} />
                    <Route path="*" element={<Navigate to="/pricing" replace />} />
                  </Routes>
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
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return <AppContent />;
};

export default App;
