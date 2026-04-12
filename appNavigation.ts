import {
  Activity,
  BarChart4,
  BookOpen,
  BrainCircuit,
  Calculator,
  FileText,
  GitBranch,
  HeartPulse,
  LayoutDashboard,
  Percent,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import type { NavItem } from './components/ui/Sidebar';
import type { ViewState } from './types';
import { translations } from './translations';

type NavigationLabels = typeof translations.en;

// ---------------------------------------------------------------------------
// View ↔ Path mapping — single source of truth for routing
// ---------------------------------------------------------------------------

const VIEW_PATHS: Record<ViewState, string> = {
  CALCULATOR: '/pricing',
  RAROC: '/raroc',
  SHOCKS: '/stress-testing',
  BLOTTER: '/blotter',
  ACCOUNTING: '/accounting',
  REPORTING: '/analytics',
  MARKET_DATA: '/market-data',
  METHODOLOGY: '/methodology',
  CONFIG: '/methodology',
  BEHAVIOURAL: '/behavioural',
  AI_LAB: '/ai',
  USER_MGMT: '/users',
  AUDIT_LOG: '/audit',
  HEALTH: '/health',
  MANUAL: '/manual',
  NOTIFICATIONS: '/notifications',
};

const PATH_TO_VIEW: Record<string, ViewState> = {};
for (const [view, path] of Object.entries(VIEW_PATHS)) {
  if (!PATH_TO_VIEW[path]) {
    PATH_TO_VIEW[path] = view as ViewState;
  }
}

export function viewToPath(view: ViewState): string {
  return VIEW_PATHS[view] || '/pricing';
}

export function pathToView(pathname: string): ViewState {
  return PATH_TO_VIEW[pathname] || 'CALCULATOR';
}

/** All unique route paths for building <Route> elements */
export function getAllRoutePaths(): { path: string; view: ViewState }[] {
  const seen = new Set<string>();
  const routes: { path: string; view: ViewState }[] = [];
  for (const [view, path] of Object.entries(VIEW_PATHS)) {
    if (!seen.has(path)) {
      seen.add(path);
      routes.push({ path, view: view as ViewState });
    }
  }
  return routes;
}

// ---------------------------------------------------------------------------
// Navigation item builders
// ---------------------------------------------------------------------------

export function buildMainNavItems(t: NavigationLabels): NavItem[] {
  return [
    { id: 'CALCULATOR', label: t.pricingEngine, icon: Calculator, section: 'Pricing', path: '/pricing' },
    { id: 'RAROC', label: 'RAROC Terminal', icon: Percent, section: 'Pricing', path: '/raroc' },
    { id: 'SHOCKS', label: t.shocks, icon: Zap, section: 'Pricing', path: '/stress-testing' },
    { id: 'BLOTTER', label: t.dealBlotter, icon: FileText, section: 'Portfolio', path: '/blotter' },
    { id: 'ACCOUNTING', label: t.accountingLedger, icon: LayoutDashboard, section: 'Portfolio', path: '/accounting' },
    { id: 'REPORTING', label: 'FTP Analytics', icon: BarChart4, section: 'Analytics', path: '/analytics' },
    { id: 'MARKET_DATA', label: t.yieldCurves, icon: TrendingUp, section: 'Market Data', path: '/market-data' },
    { id: 'METHODOLOGY', label: 'Rules & Config', icon: GitBranch, section: 'Configuration', path: '/methodology' },
    { id: 'BEHAVIOURAL', label: t.behaviouralModels, icon: Activity, section: 'Configuration', path: '/behavioural' },
    { id: 'AI_LAB', label: 'AI Assistant', icon: BrainCircuit, section: 'Configuration', path: '/ai' },
  ];
}

export function buildBottomNavItems(t: NavigationLabels): NavItem[] {
  return [
    { id: 'USER_CONFIG', label: t.userConfig, icon: Settings },
    { id: 'USER_MGMT', label: t.userMgmt, icon: Users, path: '/users' },
    { id: 'AUDIT_LOG', label: t.auditLog, icon: ShieldCheck, path: '/audit' },
    { id: 'HEALTH', label: t.systemHealth, icon: HeartPulse, section: 'System', path: '/health' },
    { id: 'MANUAL', label: t.manual, icon: BookOpen, path: '/manual' },
  ];
}
