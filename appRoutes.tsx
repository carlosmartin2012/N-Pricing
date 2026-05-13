import React, { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import AppLayout from './components/ui/AppLayout';
import { CalculatorSkeleton, ConfigSkeleton, DashboardSkeleton, TableSkeleton } from './components/ui/ViewSkeleton';

const PricingLayoutShell = React.lazy(() => import('./components/Pricing/PricingLayoutShell'));
const CalculatorWorkspaceLazy = React.lazy(() =>
  import('./components/Calculator/CalculatorWorkspace').then((m) => ({ default: m.CalculatorWorkspace }))
);
const RAROCCalculatorLazy = React.lazy(() => import('./components/RAROC/RAROCCalculator'));
const ShocksDashboardLazy = React.lazy(() => import('./components/Risk/ShocksDashboard'));
const WhatIfWorkspaceLazy = React.lazy(() => import('./components/WhatIf/WhatIfWorkspace'));
const MethodologyConfig = React.lazy(() => import('./components/Config/MethodologyConfig'));
const DealBlotter = React.lazy(() => import('./components/Blotter/DealBlotter'));
const YieldCurvePanel = React.lazy(() => import('./components/MarketData/YieldCurvePanel'));
const MarketBenchmarksView = React.lazy(() => import('./components/MarketData/MarketBenchmarksView'));
const AccountingLedger = React.lazy(() => import('./components/Accounting/AccountingLedger'));
const BehaviouralModels = React.lazy(() => import('./components/Behavioural/BehaviouralModels'));
const UserManual = React.lazy(() => import('./components/Docs/UserManual'));
const UserManagement = React.lazy(() => import('./components/Admin/UserManagement'));
const AuditLog = React.lazy(() => import('./components/Admin/AuditLog'));
const GenAIChat = React.lazy(() => import('./components/Intelligence/GenAIChat'));
const ReportingDashboard = React.lazy(() => import('./components/Reporting/ReportingDashboard'));
const NotificationCenter = React.lazy(() => import('./components/Notifications/NotificationCenter'));
const HealthDashboard = React.lazy(() => import('./components/Admin/HealthDashboard'));
const SLOPanel = React.lazy(() => import('./components/Admin/SLOPanel'));
const AdapterHealthPanel = React.lazy(() => import('./components/Admin/AdapterHealthPanel'));
const TargetGridView = React.lazy(() => import('./components/TargetGrid/TargetGridView'));
const CustomerPricingView = React.lazy(() => import('./components/Customer360/CustomerPricingView'));
const PipelineView = React.lazy(() => import('./components/Pipeline/PipelineView'));
const ReconciliationView = React.lazy(() => import('./components/Reconciliation/ReconciliationView'));
const CampaignsView = React.lazy(() => import('./components/Campaigns/CampaignsView'));
const EscalationsView = React.lazy(() => import('./components/Governance/EscalationsView'));
const ModelInventoryView = React.lazy(() => import('./components/Governance/ModelInventoryView'));
const DossiersView = React.lazy(() => import('./components/Governance/DossiersView'));
const SnapshotReplayView = React.lazy(() => import('./components/Governance/SnapshotReplayView'));
const StressPricingView = React.lazy(() => import('./components/StressPricing/StressPricingView'));
const DealTimelineRoute = React.lazy(() => import('./components/Deals/DealTimelineRoute'));
const ApprovalCockpit = React.lazy(() => import('./components/Attributions/ApprovalCockpit'));
const AttributionMatrixView = React.lazy(() => import('./components/Attributions/AttributionMatrixView'));
const AttributionReportingView = React.lazy(() => import('./components/Attributions/AttributionReportingView'));
const BudgetReconciliationView = React.lazy(() => import('./components/Budget/BudgetReconciliationView'));

const ViewSkeleton: React.FC = () => {
  const path = window.location.pathname;
  if (path === '/pricing') return <CalculatorSkeleton />;
  if (path === '/blotter' || path === '/users' || path === '/audit') return <TableSkeleton />;
  if (
    path === '/analytics' ||
    path === '/raroc' ||
    path === '/stress-testing' ||
    path === '/stress-pricing' ||
    path === '/health' ||
    path === '/discipline' ||
    path === '/what-if'
  ) {
    return <DashboardSkeleton />;
  }
  if (path === '/target-grid') return <TableSkeleton />;
  if (path === '/methodology' || path === '/behavioural') return <ConfigSkeleton />;
  return <DashboardSkeleton />;
};

export const AppRoutes: React.FC = () => (
  <Suspense fallback={<ViewSkeleton />}>
    <Routes>
      <Route element={<PricingLayoutShell />}>
        <Route path="/pricing" element={<CalculatorWorkspaceLazy />} />
        <Route path="/raroc" element={<RAROCCalculatorLazy />} />
        <Route path="/stress-testing" element={<ShocksDashboardLazy />} />
        <Route path="/what-if" element={<WhatIfWorkspaceLazy />} />
      </Route>

      <Route element={<AppLayout variant="bare" />}>
        <Route path="/blotter" element={<DealBlotter />} />
        <Route path="/market-data" element={<YieldCurvePanel />} />
        <Route path="/market-benchmarks" element={<MarketBenchmarksView />} />
        <Route path="/behavioural" element={<BehaviouralModels />} />
        <Route path="/methodology" element={<MethodologyConfig mode="ALL" />} />
        <Route path="/accounting" element={<AccountingLedger />} />
        <Route path="/manual" element={<UserManual />} />
      </Route>

      <Route element={<AppLayout variant="flex-col" />}>
        <Route path="/analytics" element={<ReportingDashboard />} />
        <Route path="/discipline" element={<ReportingDashboard initialTab="discipline" />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/audit" element={<AuditLog />} />
        <Route path="/health" element={<HealthDashboard />} />
        <Route path="/slo" element={<SLOPanel />} />
        <Route path="/adapters" element={<AdapterHealthPanel />} />
        <Route path="/notifications" element={<NotificationCenter />} />
        <Route path="/ai" element={<GenAIChat />} />
        <Route path="/target-grid" element={<TargetGridView />} />
        <Route path="/customers" element={<CustomerPricingView />} />
        <Route path="/pipeline" element={<PipelineView />} />
        <Route path="/campaigns" element={<CampaignsView />} />
        <Route path="/escalations" element={<EscalationsView />} />
        <Route path="/approvals" element={<ApprovalCockpit />} />
        <Route path="/attributions/matrix" element={<AttributionMatrixView />} />
        <Route path="/attributions/reporting" element={<AttributionReportingView />} />
        <Route path="/budget/reconciliation" element={<BudgetReconciliationView />} />
        <Route path="/reconciliation" element={<ReconciliationView />} />
        <Route path="/models" element={<ModelInventoryView />} />
        <Route path="/dossiers" element={<DossiersView />} />
        <Route path="/snapshots" element={<SnapshotReplayView />} />
        <Route path="/stress-pricing" element={<StressPricingView />} />
        <Route path="/deals/:id/timeline" element={<DealTimelineRoute />} />
      </Route>

      <Route path="/" element={<Navigate to="/pricing" replace />} />
      <Route path="*" element={<Navigate to="/pricing" replace />} />
    </Routes>
  </Suspense>
);
