import React, { Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Calculator as CalculatorIcon, Percent, Zap, FlaskConical } from 'lucide-react';
import type { Transaction } from '../../types';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { DashboardSkeleton } from '../ui/ViewSkeleton';

const CalculatorWorkspace = React.lazy(() =>
  import('../Calculator/CalculatorWorkspace').then((m) => ({ default: m.CalculatorWorkspace })),
);
const RAROCCalculator = React.lazy(() => import('../RAROC/RAROCCalculator'));
const ShocksDashboard = React.lazy(() => import('../Risk/ShocksDashboard'));
const WhatIfWorkspace = React.lazy(() => import('../WhatIf/WhatIfWorkspace'));

type TabId = 'deal' | 'raroc' | 'stress' | 'what-if';

const TABS: { id: TabId; path: string; label: string; sublabel: string; icon: typeof CalculatorIcon }[] = [
  { id: 'deal',    path: '/pricing',         label: 'Deal',      sublabel: 'Motor + recomendaci\u00f3n',          icon: CalculatorIcon },
  { id: 'raroc',   path: '/raroc',           label: 'RAROC',     sublabel: 'Economic profit + hurdle',        icon: Percent },
  { id: 'stress',  path: '/stress-testing',  label: 'Stress',    sublabel: 'EBA 6 escenarios',                icon: Zap },
  { id: 'what-if', path: '/what-if',         label: 'What-If',   sublabel: 'Simulaci\u00f3n + backtest',          icon: FlaskConical },
];

interface Props {
  dealParams: Transaction;
  setDealParams: React.Dispatch<React.SetStateAction<Transaction>>;
}

function pathToTab(pathname: string): TabId {
  const match = TABS.find((t) => t.path === pathname);
  return match?.id ?? 'deal';
}

export const PricingWorkspace: React.FC<Props> = ({ dealParams, setDealParams }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = pathToTab(location.pathname);

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar — persistent across /pricing, /raroc, /stress-testing, /what-if */}
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

      {/* Active tab content */}
      <div className="min-h-0 flex-1">
        <ErrorBoundary fallbackMessage="Pricing workspace encountered an error">
          <Suspense fallback={<DashboardSkeleton />}>
            {activeTab === 'deal' && (
              <CalculatorWorkspace dealParams={dealParams} setDealParams={setDealParams} />
            )}
            {activeTab === 'raroc' && <RAROCCalculator />}
            {activeTab === 'stress' && <ShocksDashboard deal={dealParams} />}
            {activeTab === 'what-if' && <WhatIfWorkspace />}
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
};

export default PricingWorkspace;
