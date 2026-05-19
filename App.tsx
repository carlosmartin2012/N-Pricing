import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useEntity } from './contexts/EntityContext';
import { Sparkles } from 'lucide-react';
import { INITIAL_DEAL } from './utils/seedData';
import type { Transaction } from './types';
import { AppRoutes } from './appRoutes';
import { buildAuxDestinations, buildBottomNavItems, buildMainNavItems, getViewNavigationMeta } from './appNavigation';
import { useLocation } from 'react-router';
import { Sidebar } from './components/ui/Sidebar';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { SkipNav } from './components/ui/SkipNav';
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
import { PresenceValueProvider } from './contexts/PresenceContext';
import { useLiveCursors } from './hooks/useLiveCursors';
import LiveCursorOverlay from './components/ui/LiveCursorOverlay';

const GeminiAssistant = React.lazy(() => import('./components/Intelligence/GeminiAssistant'));
const Header = React.lazy(() => import('./components/ui/Header').then((module) => ({ default: module.Header })));
const DataFreshnessStrip = React.lazy(() =>
  import('./components/ui/DataFreshnessStrip').then((module) => ({ default: module.DataFreshnessStrip }))
);
// CommandPalette is only rendered on demand (⌘K). Lazy-loading it pulls
// ~12 KB of source + lucide-react icon barrel out of the initial `index`
// chunk — cheap win toward the 520 KB budget. The button that opens it
// only triggers the import when the user first presses ⌘K.
const CommandPalette = React.lazy(() =>
  import('./components/ui/CommandPalette').then((m) => ({ default: m.CommandPalette }))
);
// Login is only rendered on the unauthenticated path. Repeat users with a
// valid JWT in localStorage never mount this tree, so there is no reason
// to ship its 400-line source + Google SSO helpers + lucide icons in the
// initial `index` chunk. The Suspense fallback below holds the NFQ dark
// canvas for the sub-100ms chunk fetch so the first paint does not flash.
const Login = React.lazy(() => import('./components/ui/Login').then((m) => ({ default: m.Login })));
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

const AppContent: React.FC = () => {
  const { currentUser, isAuthenticated, handleLogin, handleLogout } = useAuth();
  const data = useData();
  const ui = useUI();
  const walkthrough = useWalkthrough();
  const handleUniversalImport = useUniversalImport();

  // Auto-start only the centered business-flow tour on first login. The
  // role-specific tours remain available from the manual docs/replay entry,
  // but they are no longer forced immediately after auth because they navigate
  // away from the Control Room before the user can orient themselves.
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
      if (isCommandPaletteOpen) {
        setIsCommandPaletteOpen(false);
        return;
      }
      ui.setIsConfigModalOpen(false);
      ui.setIsImportModalOpen(false);
      ui.setIsAiOpen(false);
    },
  });
  const { pendingCount, isSyncing, syncAll } = useOfflineSync();

  const { loadUserEntities, activeEntity } = useEntity();

  const presence = usePresenceAwareness({
    userId: currentUser?.id ?? '',
    name: currentUser?.name ?? '',
    email: currentUser?.email ?? '',
    role: currentUser?.role ?? '',
    activeView: ui.currentView,
    activeDealId: undefined,
    entityId: activeEntity?.id,
    enabled: isAuthenticated,
  });
  const { onlineUsers } = presence;
  // Memoised value the descendants read via usePresence(). Built from
  // the same hook instance App already runs, so we don't open a second
  // Supabase Realtime channel for soft-locks (Ola 7 Bloque B.1).
  const presenceValue = useMemo(
    () => ({
      onlineUsers: presence.onlineUsers,
      getUsersOnView: presence.getUsersOnView,
      getUsersOnDeal: presence.getUsersOnDeal,
      selfUserId: currentUser?.id ?? '',
    }),
    [presence.onlineUsers, presence.getUsersOnView, presence.getUsersOnDeal, currentUser?.id]
  );

  // Live cursors (Ola 7 Bloque B.4c). Default ON, can be killed via
  // VITE_LIVE_CURSORS_KILL=true (global) or — once tenant flags ship —
  // disabled per tenant. Fails closed if presence is off (no userId)
  // or if Supabase is not configured (transport returns null).
  const liveCursorsKilled = String(import.meta.env?.VITE_LIVE_CURSORS_KILL ?? '').toLowerCase() === 'true';
  const liveCursors = useLiveCursors({
    enabled: isAuthenticated && !liveCursorsKilled && Boolean(currentUser?.id),
    userId: currentUser?.id ?? '',
    name: currentUser?.name ?? null,
    viewport: ui.currentView,
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

  // Reset main scroll to top on view change. Without this, navigating to
  // a tall view (Calculator, 5k+ px) and then to a shorter one leaves the
  // shorter view scrolled past its content.
  useEffect(() => {
    document.getElementById('main-content')?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [ui.currentView]);

  const mainNavItems = useMemo(() => buildMainNavItems(ui.t), [ui.t]);
  const bottomNavItems = useMemo(() => buildBottomNavItems(ui.t), [ui.t]);
  const auxDestinations = useMemo(() => buildAuxDestinations(ui.t), [ui.t]);
  const currentViewMeta = useMemo(() => getViewNavigationMeta(ui.t, ui.currentView), [ui.currentView, ui.t]);
  // The cockpit-hero title resolves against the actual pathname first
  // because some AUX-only routes (/snapshots, /slo, /adapters) have ids
  // (GOV_SNAPSHOTS, GOV_SLO, GOV_ADAPTERS) that live outside the ViewState
  // union — pathToView() falls back to CALCULATOR for those, so a
  // currentView-based lookup would show "Calculator" everywhere. Looking
  // by path covers main, bottom and aux destinations in one pass.
  const location = useLocation();
  const currentDestinationLabel = useMemo(() => {
    const all = [...mainNavItems, ...bottomNavItems, ...auxDestinations];
    return all.find((d) => d.path === location.pathname)?.label;
  }, [auxDestinations, bottomNavItems, location.pathname, mainNavItems]);

  // Hero compaction: COMPACT is the default for every view so work surfaces
  // start at ~140px instead of ~600px. Only the Control Room dashboard keeps
  // the spacious big hero because its primary content IS the system-wide KPIs
  // displayed up there — anywhere else, the universal "Governed pricing,
  // methodology control..." subtitle and the 4 universal KPI tiles compete
  // with the actual view content for no informational value.
  //
  // The KPI strip is rendered inline next to the title in compact mode so
  // the operating-shell metrics stay accessible at a glance without consuming
  // a quarter of the viewport.
  const BIG_HERO_VIEWS: ReadonlySet<string> = new Set([
    'CONTROL_ROOM',
  ]);
  const compactHero = !BIG_HERO_VIEWS.has(ui.currentView);

  // Per-view contextual KPIs for the compact hero. Each view declares
  // its own 0-4 KPIs based on the data it operates on. Views without
  // an entry get a title-only hero — much cleaner than the old behaviour
  // of forcing universal Deals/Pending/Snapshots/AI-traces on every
  // surface even when they made no sense (Yield Curves, Dossiers,
  // Stress Test...). Control Room still uses the spacious hero where
  // the system-wide KPIs are the primary content.
  interface CompactKpi {
    label: string;
    value: React.ReactNode;
    toneClass?: string;
  }
  const compactKpis = useMemo<CompactKpi[]>(() => {
    switch (ui.currentView) {
      case 'BLOTTER':
        return [
          { label: ui.t.workspaceDeals, value: data.deals.length },
          {
            label: ui.t.workspacePending,
            value: data.deals.filter((d) => d.status === 'Pending_Approval').length,
            toneClass: 'text-[color:var(--nfq-warning)]',
          },
          {
            label: 'Booked',
            value: data.deals.filter((d) => d.status === 'Booked' || d.status === 'Approved').length,
            toneClass: 'text-[color:var(--nfq-success)]',
          },
        ];
      case 'MARKET_DATA': {
        const activeSources = data.marketDataSources.filter((s) => s.status === 'Active').length;
        return [
          { label: 'Curves', value: data.yieldCurves.length, toneClass: 'text-[color:var(--nfq-accent)]' },
          {
            label: 'Sources',
            value: activeSources,
            toneClass: activeSources > 0 ? 'text-[color:var(--nfq-success)]' : 'text-[color:var(--nfq-warning)]',
          },
        ];
      }
      case 'CUSTOMER_360':
        return [
          { label: 'Clients', value: data.clients.length, toneClass: 'text-[color:var(--nfq-success)]' },
        ];
      case 'REPORTING': {
        const booked = data.deals.filter((d) => d.status === 'Booked' || d.status === 'Approved');
        return [
          { label: ui.t.workspaceDeals, value: booked.length },
          { label: 'Snapshots', value: data.portfolioSnapshots.length, toneClass: 'text-[color:var(--nfq-accent)]' },
        ];
      }
      case 'APPROVALS':
      case 'ESCALATIONS': {
        const pending = data.deals.filter((d) => d.status === 'Pending_Approval').length;
        return [
          {
            label: ui.t.workspacePending,
            value: pending,
            toneClass: pending > 0 ? 'text-[color:var(--nfq-warning)]' : 'text-[color:var(--nfq-success)]',
          },
        ];
      }
      case 'DOSSIERS':
        return [
          { label: 'Dossiers', value: data.pricingDossiers.length, toneClass: 'text-[color:var(--nfq-cat-d)]' },
        ];
      case 'SHOCKS':
      case 'STRESS_PRICING':
      case 'RAROC':
      case 'WHAT_IF':
      case 'CALCULATOR':
        // Per-deal workflow views: keep title-only, the in-view receipt
        // panels carry the relevant deal numbers (FTP, RAROC, etc.).
        return [];
      default:
        // Title-only hero for all other views. Less is more.
        return [];
    }
  }, [
    ui.currentView,
    ui.t,
    data.deals,
    data.marketDataSources,
    data.yieldCurves,
    data.clients,
    data.portfolioSnapshots,
    data.pricingDossiers,
  ]);

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<div aria-hidden="true" className="min-h-screen bg-[color:var(--nfq-bg-base,#0e0e0e)]" />}>
        <Login onLogin={(email: string) => handleLogin(email, data.users)} language={ui.language} />
      </Suspense>
    );
  }

  return (
    <PresenceValueProvider value={presenceValue}>
      <LiveCursorOverlay cursors={liveCursors.cursors} />
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
          <Suspense fallback={<div className="border-b border-[color:var(--nfq-border-ghost)]" style={{ height: 'var(--nfq-topbar-height)' }} />}>
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
              workspaceMode={ui.workspaceMode}
              onWorkspaceModeChange={ui.setWorkspaceMode}
            />
          </Suspense>
          <Suspense fallback={null}>
            <DataFreshnessStrip />
          </Suspense>

          <main
            id="main-content"
            className="relative flex-1 overflow-auto px-3 pb-3 pt-3 md:px-5 md:pb-5 md:pt-4 xl:px-6"
          >
            <div className="nfq-grid-overlay pointer-events-none absolute inset-0 opacity-40" />
            <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent)]" />

            <div className="relative z-10 flex h-full min-h-0 flex-col gap-4">
              {compactHero ? (
                <section className="rounded-[var(--nfq-radius-card)] bg-[var(--nfq-bg-surface)] px-4 py-3 shadow-[var(--nfq-shadow-platform)] md:px-5 md:py-3">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <div className="flex min-w-0 items-baseline gap-3">
                      <h1 className="text-xl font-semibold tracking-[var(--nfq-tracking-tight)] text-[color:var(--nfq-text-primary)] md:text-2xl">
                        {currentDestinationLabel ||
                          currentViewMeta?.label ||
                          ui.t.workspaceFallback}
                      </h1>
                      <span className="nfq-label hidden md:inline">{ui.t.workspaceEyebrow}</span>
                    </div>
                    {compactKpis.length > 0 && (
                      <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-1 font-mono-nums text-xs">
                        {compactKpis.map((kpi) => (
                          <span key={kpi.label} className="flex items-baseline gap-1.5">
                            <span className="nfq-label text-[10px]">{kpi.label}</span>
                            <span className={`font-semibold ${kpi.toneClass ?? 'text-[color:var(--nfq-text-primary)]'}`}>
                              {kpi.value}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              ) : (
                <section className="rounded-[var(--nfq-radius-xl)] bg-[var(--nfq-bg-surface)] px-5 py-5 shadow-[var(--nfq-shadow-platform)] md:px-7 md:py-6">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                    <div className="max-w-3xl">
                      <div className="nfq-eyebrow">{ui.t.workspaceEyebrow}</div>
                      <h1 className="mt-4 text-[clamp(2rem,3.5vw,56px)] font-semibold tracking-[var(--nfq-tracking-tight)] leading-[1.1] text-[color:var(--nfq-text-primary)]">
                        {currentDestinationLabel ||
                          currentViewMeta?.label ||
                          ui.t.workspaceFallback}
                      </h1>
                      <p className="mt-3 max-w-2xl text-[14px] leading-6 text-[color:var(--nfq-text-secondary)]">
                        {ui.t.workspaceDescription}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div className="rounded-[var(--nfq-radius-card)] bg-[var(--nfq-bg-elevated)] px-4 py-4">
                        <div className="nfq-label">{ui.t.workspaceDeals}</div>
                        <div className="font-mono-nums mt-3 text-[28px] font-bold tracking-[var(--nfq-tracking-tight)] text-[color:var(--nfq-text-primary)]">
                          {data.deals.length}
                        </div>
                        <div className="mt-1 text-xs text-[color:var(--nfq-text-muted)]">
                          {data.dataMode === 'demo' ? ui.t.workspaceDemoBook : ui.t.workspaceLiveBook}
                        </div>
                      </div>
                      <div className="rounded-[var(--nfq-radius-card)] bg-[var(--nfq-bg-elevated)] px-4 py-4">
                        <div className="nfq-label">{ui.t.workspacePending}</div>
                        <div className="font-mono-nums mt-3 text-[28px] font-bold tracking-[var(--nfq-tracking-tight)] text-[color:var(--nfq-warning)]">
                          {data.deals.filter((deal) => deal.status === 'Pending_Approval').length}
                        </div>
                        <div className="mt-1 text-xs text-[color:var(--nfq-text-muted)]">
                          {ui.t.workspaceApprovalQueue}
                        </div>
                      </div>
                      <div className="rounded-[var(--nfq-radius-card)] bg-[var(--nfq-bg-elevated)] px-4 py-4">
                        <div className="nfq-label">{ui.t.workspaceSnapshots}</div>
                        <div className="font-mono-nums mt-3 text-[28px] font-bold tracking-[var(--nfq-tracking-tight)] text-[color:var(--nfq-accent)]">
                          {data.portfolioSnapshots.length}
                        </div>
                        <div className="mt-1 text-xs text-[color:var(--nfq-text-muted)]">
                          {ui.t.workspacePortfolioFrames}
                        </div>
                      </div>
                      <div className="rounded-[var(--nfq-radius-card)] bg-[var(--nfq-bg-elevated)] px-4 py-4">
                        <div className="nfq-label">{ui.t.workspaceAiTraces}</div>
                        <div className="font-mono-nums mt-3 text-[28px] font-bold tracking-[var(--nfq-tracking-tight)] text-[color:var(--nfq-cat-d)]">
                          {data.pricingDossiers.reduce(
                            (count, dossier) => count + (dossier.aiResponseTraces?.length || 0),
                            0
                          )}
                        </div>
                        <div className="mt-1 text-xs text-[color:var(--nfq-text-muted)]">
                          {ui.t.workspaceGroundedEvidence}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              <div className="relative min-h-0 flex-1">
                <ErrorBoundary key={ui.currentView}>
                  {/* Pricing state provider — controlled by App.tsx's existing
                    useState so prop-drilled components keep working. New
                    components can read via usePricingState() without props. */}
                  <PricingStateProvider controlled={{ value: dealParams, setValue: setDealParams }}>
                    <AppRoutes />
                  </PricingStateProvider>
                </ErrorBoundary>
              </div>
            </div>
          </main>

          <button
            onClick={() => ui.setIsAiOpen(true)}
            aria-label="Open AI assistant"
            className={`fixed bottom-6 right-6 z-40 flex h-10 w-12 items-center justify-center rounded-full text-white transition-transform duration-200 hover:scale-105 ${ui.isAiOpen ? 'scale-0' : 'scale-100'}`}
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

          <Suspense fallback={null}>
            <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} />
          </Suspense>

          <Suspense fallback={null}>
            <CustomerDrawer />
          </Suspense>
        </div>
      </div>
    </PresenceValueProvider>
  );
};

const App: React.FC = () => {
  return <AppContent />;
};

export default App;
