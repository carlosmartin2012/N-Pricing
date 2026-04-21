import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { Calculator as CalculatorIcon, Percent, Zap, FlaskConical } from 'lucide-react';

/**
 * PricingLayoutShell — persistent shell for the 4 pricing workspaces.
 *
 * Replaces the old <PricingWorkspace> wrapper which conditionally rendered
 * one of 4 tabs based on pathname. With nested routing + Outlet:
 *   - The tab bar is part of the layout (no re-render on tab switch)
 *   - Each workspace is its own route-level component and reads shared
 *     state via `usePricingState()` from PricingStateContext
 *   - Deep linking + browser back/forward works identically to before
 *
 * Route shape:
 *   <Route element={<PricingLayoutShell/>}>
 *     <Route path="/pricing"         element={<CalculatorWorkspace/>} />
 *     <Route path="/raroc"           element={<RAROCCalculator/>} />
 *     <Route path="/stress-testing"  element={<ShocksDashboard/>} />
 *     <Route path="/what-if"         element={<WhatIfWorkspace/>} />
 *   </Route>
 */

type TabId = 'deal' | 'raroc' | 'stress' | 'what-if';

const TABS: { id: TabId; path: string; label: string; sublabel: string; icon: typeof CalculatorIcon }[] = [
  { id: 'deal',    path: '/pricing',        label: 'Deal',    sublabel: 'Motor + recomendación',    icon: CalculatorIcon },
  { id: 'raroc',   path: '/raroc',          label: 'RAROC',   sublabel: 'Economic profit + hurdle', icon: Percent },
  { id: 'stress',  path: '/stress-testing', label: 'Stress',  sublabel: 'EBA 6 escenarios',         icon: Zap },
  { id: 'what-if', path: '/what-if',        label: 'What-If', sublabel: 'Simulación + backtest',    icon: FlaskConical },
];

function pathToTab(pathname: string): TabId {
  return TABS.find((t) => t.path === pathname)?.id ?? 'deal';
}

const PricingLayoutShell: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = pathToTab(location.pathname);

  return (
    <div className="flex h-full flex-col">
      <div
        data-tour="pricing-workspace-tabs"
        className="sticky top-0 z-10 -mx-6 mb-4 flex items-center gap-1 border-b border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-root)]/90 px-6 pb-2 pt-1 backdrop-blur"
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              aria-current={isActive ? 'page' : undefined}
              className={`group flex items-center gap-2 rounded-[14px] px-4 py-2 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[var(--nfq-bg-surface)] text-[color:var(--nfq-text-primary)] shadow-[inset_0_0_0_1px_rgba(var(--nfq-accent-rgb),0.22)]'
                  : 'text-[color:var(--nfq-text-muted)] hover:bg-[var(--nfq-bg-elevated)] hover:text-[color:var(--nfq-text-primary)]'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-[color:var(--nfq-accent)]' : ''} />
              <span className="flex flex-col items-start leading-tight">
                <span>{tab.label}</span>
                <span className="nfq-label text-[9px]">{tab.sublabel}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
};

export default PricingLayoutShell;
