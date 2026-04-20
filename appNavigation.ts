import {
  Activity,
  BarChart4,
  BookOpen,
  BookOpenCheck,
  FileSignature,
  BrainCircuit,
  Calculator,
  FileText,
  GitBranch,
  Grid3X3,
  HeartPulse,
  History,
  LayoutDashboard,
  Plug,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Target,
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
  // Pricing workspace — 4 tabs, still addressable individually for deep links
  CALCULATOR: '/pricing',
  RAROC: '/raroc',
  SHOCKS: '/stress-testing',
  WHAT_IF: '/what-if',
  // Commercial
  CUSTOMER_360: '/customers',
  CAMPAIGNS: '/campaigns',
  TARGET_GRID: '/target-grid',
  // Post-trade
  BLOTTER: '/blotter',
  ACCOUNTING: '/accounting',
  // Insights
  REPORTING: '/analytics',
  DISCIPLINE: '/discipline',
  MARKET_DATA: '/market-data',
  BEHAVIOURAL: '/behavioural',
  // Governance
  METHODOLOGY: '/methodology',
  CONFIG: '/methodology',
  MODEL_INVENTORY: '/models',
  DOSSIERS: '/dossiers',
  ESCALATIONS: '/escalations',
  AUDIT_LOG: '/audit',
  // Assistant
  AI_LAB: '/ai',
  // System (bottom)
  HEALTH: '/health',
  MANUAL: '/manual',
  NOTIFICATIONS: '/notifications',
  USER_MGMT: '/users',
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

/**
 * Main sidebar navigation — 4 buckets aligned with the pricing lifecycle.
 *
 * 1. COMMERCIAL  → pre-deal: who we offer to and how
 * 2. PRICING     → calculate + execute (workspace with Deal/RAROC/Stress/What-If tabs + post-trade)
 * 3. INSIGHTS    → understand portfolio + market + models
 * 4. GOVERNANCE  → control + audit + reproducibility
 *
 * The 4 pricing tabs (Calculator/RAROC/Shocks/What-If) share a single entry
 * "Pricing Engine" — tabs live inside PricingWorkspace, not in the sidebar.
 */
export function buildMainNavItems(t: NavigationLabels): NavItem[] {
  return [
    // ─────────────── COMMERCIAL ───────────────
    { id: 'CUSTOMER_360', label: 'Customers', icon: Users, section: 'Commercial', path: '/customers' },
    { id: 'CAMPAIGNS', label: 'Campaigns', icon: Target, section: 'Commercial', path: '/campaigns' },
    { id: 'TARGET_GRID', label: t.targetGrid, icon: Grid3X3, section: 'Commercial', path: '/target-grid' },

    // ─────────────── PRICING ───────────────
    // Single entry — tabs live inside PricingWorkspace
    { id: 'CALCULATOR', label: t.pricingEngine, icon: Calculator, section: 'Pricing', path: '/pricing' },
    { id: 'BLOTTER', label: t.dealBlotter, icon: FileText, section: 'Pricing', path: '/blotter' },
    { id: 'ACCOUNTING', label: t.accountingLedger, icon: LayoutDashboard, section: 'Pricing', path: '/accounting' },

    // ─────────────── INSIGHTS ───────────────
    { id: 'REPORTING', label: 'Analytics', icon: BarChart4, section: 'Insights', path: '/analytics' },
    { id: 'MARKET_DATA', label: t.yieldCurves, icon: TrendingUp, section: 'Insights', path: '/market-data' },
    { id: 'BEHAVIOURAL', label: t.behaviouralModels, icon: Activity, section: 'Insights', path: '/behavioural' },

    // ─────────────── GOVERNANCE ───────────────
    { id: 'METHODOLOGY', label: 'Methodology', icon: GitBranch, section: 'Governance', path: '/methodology' },
    { id: 'MODEL_INVENTORY', label: 'Model Inventory', icon: BookOpenCheck, section: 'Governance', path: '/models' },
    { id: 'DOSSIERS', label: 'Dossiers', icon: FileSignature, section: 'Governance', path: '/dossiers' },
    { id: 'ESCALATIONS', label: 'Escalations', icon: ShieldAlert, section: 'Governance', path: '/escalations' },

    // ─────────────── ASSISTANT ───────────────
    { id: 'AI_LAB', label: 'AI Assistant', icon: BrainCircuit, section: 'Assistant', path: '/ai' },
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

/**
 * Additional destinations that are NOT in the main sidebar but are reachable
 * via Command Palette (⌘K). Keeps the sidebar at ~11 items while still
 * exposing niche destinations for power users.
 *
 * SLO, Adapter Health and Snapshot Replay are operational views for
 * governance/MRM roles — too specialized for the main nav but essential to
 * have discoverable.
 */
export interface AuxDestination {
  id: string;
  label: string;
  sublabel: string;
  icon: typeof Calculator;
  path: string;
  section: 'Pricing' | 'Governance' | 'Insights';
}

export const AUX_DESTINATIONS: AuxDestination[] = [
  { id: 'PRICING_RAROC',     label: 'RAROC Terminal',    sublabel: 'Pricing \u2192 tab RAROC',    icon: Calculator,    path: '/raroc',          section: 'Pricing' },
  { id: 'PRICING_STRESS',    label: 'Stress Testing',    sublabel: 'Pricing \u2192 tab Stress',   icon: Zap,           path: '/stress-testing', section: 'Pricing' },
  { id: 'PRICING_WHAT_IF',   label: 'What-If',           sublabel: 'Pricing \u2192 tab What-If',  icon: Calculator,    path: '/what-if',        section: 'Pricing' },
  { id: 'INSIGHTS_DISCIPLINE', label: 'Pricing Discipline', sublabel: 'Analytics \u2192 tab Discipline', icon: Target,  path: '/discipline',     section: 'Insights' },
  { id: 'GOV_SNAPSHOTS',     label: 'Snapshot Replay',   sublabel: 'Replay grabaciones del motor',  icon: History,   path: '/snapshots',      section: 'Governance' },
  { id: 'GOV_SLO',           label: 'SLO Dashboard',     sublabel: 'p50/p95/p99 del motor',         icon: HeartPulse,path: '/slo',            section: 'Governance' },
  { id: 'GOV_ADAPTERS',      label: 'Adapter Health',    sublabel: 'CoreBanking \u00b7 CRM \u00b7 MarketData \u00b7 SSO', icon: Plug, path: '/adapters', section: 'Governance' },
];
