import {
  Activity,
  BarChart4,
  BookOpen,
  BookOpenCheck,
  FileSignature,
  GitPullRequestArrow,
  BrainCircuit,
  Calculator,
  FileText,
  FlaskConical,
  GitBranch,
  Grid3X3,
  HeartPulse,
  History,
  LayoutDashboard,
  LineChart,
  Percent,
  Plug,
  Scale,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
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
  // Pricing workspace — 4 tabs, now surfaced as individual sidebar entries
  CALCULATOR: '/pricing',
  RAROC: '/raroc',
  SHOCKS: '/stress-testing',
  STRESS_PRICING: '/stress-pricing',
  WHAT_IF: '/what-if',
  // Relationships (was "Commercial")
  CUSTOMER_360: '/customers',
  PIPELINE: '/pipeline',
  CAMPAIGNS: '/campaigns',
  TARGET_GRID: '/target-grid',
  // Post-trade (kept inside Pricing bucket)
  BLOTTER: '/blotter',
  ACCOUNTING: '/accounting',
  // Controller-grade FTP reconciliation (Phase 6.9)
  RECONCILIATION: '/reconciliation',
  // Insights (pure outputs)
  REPORTING: '/analytics',
  DISCIPLINE: '/discipline',
  // Market Data (inputs)
  MARKET_DATA: '/market-data',
  BEHAVIOURAL: '/behavioural',
  // Governance
  METHODOLOGY: '/methodology',
  CONFIG: '/methodology',
  MODEL_INVENTORY: '/models',
  DOSSIERS: '/dossiers',
  ESCALATIONS: '/escalations',
  APPROVALS: '/approvals',
  ATTRIBUTION_MATRIX: '/attributions/matrix',
  ATTRIBUTION_REPORTING: '/attributions/reporting',
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
 * Main sidebar navigation — customer-centric taxonomy (Option B, 2026-04).
 *
 * Five buckets aligned with the *relationship* lifecycle rather than the
 * per-deal lifecycle that governed the previous 4-bucket layout:
 *
 *   1. RELATIONSHIPS → who the bank prices to (Clients, Campaigns, Targets)
 *   2. PRICING       → deal execution surface (Calculator + RAROC + Stress
 *                      + What-If as first-class entries, plus post-trade
 *                      Blotter + Accounting)
 *   3. MARKET DATA   → inputs feeding the motor (Yield Curves, Behavioural
 *                      Models, Methodology)
 *   4. INSIGHTS      → pure outputs (Analytics, Discipline)
 *   5. GOVERNANCE    → control + audit + reproducibility
 *   + ASSISTANT      → standalone AI entry
 *
 * Rationale: Phase 6 introduced CLV + 360º temporal → the product story
 * moved from "price every deal well" to "price every relationship well".
 * The sidebar has to reflect that model; calling it COMMERCIAL + burying
 * the 4 pricing tabs inside one entry made the model invisible.
 *
 * Granular Pricing entries (Calculator / RAROC / Stress / What-If) match
 * the `<PricingLayoutShell>` nested routes introduced in Phase 6.1 — each
 * workspace is a top-level route, so sidebar-level entries are coherent.
 */
export function buildMainNavItems(t: NavigationLabels): NavItem[] {
  return [
    // ─────────────── RELATIONSHIPS ───────────────
    { id: 'CUSTOMER_360', label: 'Clients',     icon: Users,                 section: 'Relationships', path: '/customers' },
    { id: 'PIPELINE',     label: 'Pipeline',    icon: GitPullRequestArrow,   section: 'Relationships', path: '/pipeline' },
    { id: 'CAMPAIGNS',    label: 'Campaigns',   icon: Target,                section: 'Relationships', path: '/campaigns' },
    { id: 'TARGET_GRID',  label: 'Targets',     icon: Grid3X3,               section: 'Relationships', path: '/target-grid' },

    // ─────────────── PRICING ───────────────
    // The 4 workspaces are now first-class entries (nested routes under
    // <PricingLayoutShell>). Post-trade stays in this bucket because its
    // gravity is pricing-adjacent, not an insight or governance artefact.
    { id: 'CALCULATOR',  label: 'Calculator',        icon: Calculator,    section: 'Pricing', path: '/pricing' },
    { id: 'RAROC',       label: 'RAROC',             icon: Percent,       section: 'Pricing', path: '/raroc' },
    { id: 'SHOCKS',         label: 'Stress Test',       icon: Zap,           section: 'Pricing', path: '/stress-testing' },
    { id: 'STRESS_PRICING', label: 'Stress Pricing',    icon: LineChart,     section: 'Pricing', path: '/stress-pricing' },
    { id: 'WHAT_IF',        label: 'What-If',           icon: FlaskConical,  section: 'Pricing', path: '/what-if' },
    { id: 'BLOTTER',     label: t.dealBlotter,       icon: FileText,      section: 'Pricing', path: '/blotter' },
    // Accounting Ledger demoted to AUX (reachable via ⌘K) on 2026-04-22.
    // Reason: today the view mixes a FTP-summary + T-accounts + journal
    // ledger for no specific daily user. The valuable use case —
    // reconciliation of BU vs Treasury entries — is a follow-up rewrite.
    // Keep the route alive so deep links + E2E still work.

    // ─────────────── MARKET DATA ───────────────
    // Inputs to the motor. Methodology belongs here because it is engine
    // *configuration*, not a control artefact — and it sits upstream of
    // every pricing call.
    { id: 'MARKET_DATA', label: t.yieldCurves,       icon: TrendingUp, section: 'Market Data', path: '/market-data' },
    { id: 'BEHAVIOURAL', label: t.behaviouralModels, icon: Activity,   section: 'Market Data', path: '/behavioural' },
    { id: 'METHODOLOGY', label: 'Methodology',       icon: GitBranch,  section: 'Market Data', path: '/methodology' },

    // ─────────────── INSIGHTS ───────────────
    // Outputs only: portfolio analytics + pricing discipline variance.
    // Discipline used to live in AUX — it's analytics, belongs here.
    { id: 'REPORTING',  label: 'Analytics',          icon: BarChart4, section: 'Insights', path: '/analytics' },
    { id: 'DISCIPLINE', label: 'Pricing Discipline', icon: Sparkles,  section: 'Insights', path: '/discipline' },

    // ─────────────── GOVERNANCE ───────────────
    { id: 'MODEL_INVENTORY',     label: 'Model Inventory',     icon: BookOpenCheck, section: 'Governance', path: '/models' },
    { id: 'DOSSIERS',            label: 'Dossiers',            icon: FileSignature, section: 'Governance', path: '/dossiers' },
    { id: 'ESCALATIONS',         label: 'Escalations',         icon: ShieldAlert,   section: 'Governance', path: '/escalations' },
    { id: 'APPROVALS',             label: 'Approvals',           icon: ShieldCheck, section: 'Governance', path: '/approvals' },
    { id: 'ATTRIBUTION_MATRIX',    label: 'Attribution matrix',  icon: Plug,        section: 'Governance', path: '/attributions/matrix' },
    { id: 'ATTRIBUTION_REPORTING', label: 'Attribution reporting', icon: BarChart4, section: 'Governance', path: '/attributions/reporting' },
    { id: 'RECONCILIATION',      label: 'FTP Reconciliation',  icon: Scale,         section: 'Governance', path: '/reconciliation' },

    // ─────────────── ASSISTANT ───────────────
    { id: 'AI_LAB', label: 'AI Assistant', icon: BrainCircuit, section: 'Assistant', path: '/ai' },
  ];
}

export function buildBottomNavItems(t: NavigationLabels): NavItem[] {
  return [
    { id: 'USER_CONFIG', label: t.userConfig, icon: Settings },
    { id: 'USER_MGMT',   label: t.userMgmt,   icon: Users,       path: '/users' },
    { id: 'AUDIT_LOG',   label: t.auditLog,   icon: ShieldCheck, path: '/audit' },
    { id: 'HEALTH',      label: t.systemHealth, icon: HeartPulse, section: 'System', path: '/health' },
    { id: 'MANUAL',      label: t.manual,     icon: BookOpen,    path: '/manual' },
  ];
}

/**
 * Additional destinations reachable via Command Palette (⌘K) only.
 *
 * After the Option B evolution: RAROC / Stress / What-If / Discipline are
 * no longer aux — they are first-class sidebar entries. AUX is reduced to
 * operational / MRM-only destinations too specialised for daily use.
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
  { id: 'ACCOUNTING',    label: 'Accounting Ledger', sublabel: 'FTP journal + BU vs Treasury T-accounts (legacy)',    icon: LayoutDashboard, path: '/accounting', section: 'Pricing' },
  { id: 'GOV_SNAPSHOTS', label: 'Snapshot Replay',   sublabel: 'Replay grabaciones del motor',                        icon: History,         path: '/snapshots',  section: 'Governance' },
  { id: 'GOV_SLO',       label: 'SLO Dashboard',     sublabel: 'p50/p95/p99 del motor',                               icon: HeartPulse,      path: '/slo',        section: 'Governance' },
  { id: 'GOV_ADAPTERS',  label: 'Adapter Health',    sublabel: 'CoreBanking \u00b7 CRM \u00b7 MarketData \u00b7 SSO', icon: Plug,            path: '/adapters',   section: 'Governance' },
];
