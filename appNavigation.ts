import {
  Activity,
  BarChart4,
  BookOpen,
  BookOpenCheck,
  FileSignature,
  GitPullRequestArrow,
  BrainCircuit,
  Calculator,
  DatabaseZap,
  FileText,
  FlaskConical,
  GitBranch,
  Grid3X3,
  Gauge,
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
import type { TranslationKeys } from './translations';

type NavigationLabels = TranslationKeys;

// ---------------------------------------------------------------------------
// View ↔ Path mapping — single source of truth for routing
// ---------------------------------------------------------------------------

const VIEW_PATHS: Record<ViewState, string> = {
  CONTROL_ROOM: '/control-room',
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
  MARKET_BENCHMARKS: '/market-benchmarks',
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
  BUDGET_RECONCILIATION: '/budget/reconciliation',
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
 * Main sidebar navigation — cockpit taxonomy (2026-05).
 *
 * The product outgrew the old 22-entry sidebar. The visible rail now exposes
 * the daily operating hubs, while specialist destinations stay addressable via
 * deep links and Command Palette/AUX:
 *
 *   1. RELATIONSHIP COCKPIT → clients, pipeline and target-grid steering.
 *   2. PRICING COCKPIT      → quote, execute and stress pricing.
 *   3. DATA & OPS HUB       → inputs, methodology and FTP reconciliation.
 *   4. GOVERNANCE HUB       → analytics, discipline and approvals.
 *   + ASSISTANT             → standalone AI entry.
 *
 * This keeps the critical demo/pilot flows one click away and moves
 * lower-frequency work (RAROC detail, What-If lab, model inventory, dossiers,
 * attribution reports, campaigns, behavioural models) to searchable AUX.
 */
export function buildMainNavItems(t: NavigationLabels): NavItem[] {
  const sectionLabels = {
    today: t.navSectionToday,
    relationships: t.navSectionRelationships,
    pricing: t.navSectionPricing,
    dataOps: t.navSectionMarketData,
    governance: t.navSectionGovernance,
    assistant: t.navSectionAssistant,
  };

  return [
    { id: 'CONTROL_ROOM', label: t.navControlRoom, icon: Gauge, section: 'Today', sectionLabel: sectionLabels.today, path: '/control-room' },

    // ─────────────── RELATIONSHIP COCKPIT ───────────────
    { id: 'CUSTOMER_360', label: t.navClients,  icon: Users,               section: 'Relationship Cockpit', sectionLabel: sectionLabels.relationships, path: '/customers' },
    { id: 'PIPELINE',     label: t.navPipeline, icon: GitPullRequestArrow, section: 'Relationship Cockpit', sectionLabel: sectionLabels.relationships, path: '/pipeline' },
    { id: 'TARGET_GRID',  label: t.navTargets,  icon: Grid3X3,             section: 'Relationship Cockpit', sectionLabel: sectionLabels.relationships, path: '/target-grid' },

    // ─────────────── PRICING COCKPIT ───────────────
    // Calculator is the single entry point for the per-deal pricing workflow.
    // The Deal/RAROC/Stress/What-If tabs live INSIDE the workflow so the user
    // navigates between them without leaving the deal context. SHOCKS, RAROC,
    // and WHAT_IF are reachable via Cmd+K (aux destinations) for power-user
    // deep-links and demo navigation.
    // STRESS_PRICING stays in the sidebar because it operates at portfolio
    // level (EBA scenarios across all priceable deals), not per-deal.
    { id: 'CALCULATOR',     label: t.navCalculator,    icon: Calculator, section: 'Pricing Cockpit', sectionLabel: sectionLabels.pricing, path: '/pricing' },
    { id: 'BLOTTER',        label: t.dealBlotter,      icon: FileText,   section: 'Pricing Cockpit', sectionLabel: sectionLabels.pricing, path: '/blotter' },
    { id: 'STRESS_PRICING', label: t.navStressPricing, icon: LineChart,  section: 'Pricing Cockpit', sectionLabel: sectionLabels.pricing, path: '/stress-pricing' },

    // ─────────────── DATA & OPS HUB ───────────────
    // Reserved for INPUTS to the pricing engine (market data + behavioural
    // models + methodology configuration). FTP Reconciliation moved to
    // Governance Hub because it's a controller workflow over recorded
    // pricing outputs — not an input to the engine.
    { id: 'MARKET_DATA',    label: t.yieldCurves,          icon: TrendingUp, section: 'Data & Ops Hub', sectionLabel: sectionLabels.dataOps, path: '/market-data' },
    { id: 'METHODOLOGY',    label: t.navMethodology,       icon: GitBranch,  section: 'Data & Ops Hub', sectionLabel: sectionLabels.dataOps, path: '/methodology' },

    // ─────────────── GOVERNANCE HUB ───────────────
    { id: 'REPORTING',      label: t.navAnalytics,         icon: BarChart4,   section: 'Governance Hub', sectionLabel: sectionLabels.governance, path: '/analytics' },
    { id: 'DISCIPLINE',     label: t.pricingDiscipline,    icon: Sparkles,    section: 'Governance Hub', sectionLabel: sectionLabels.governance, path: '/discipline' },
    { id: 'APPROVALS',      label: t.navApprovals,         icon: ShieldCheck, section: 'Governance Hub', sectionLabel: sectionLabels.governance, path: '/approvals' },
    { id: 'RECONCILIATION', label: t.navFtpReconciliation, icon: Scale,       section: 'Governance Hub', sectionLabel: sectionLabels.governance, path: '/reconciliation' },

    // ─────────────── ASSISTANT ───────────────
    { id: 'AI_LAB', label: t.navAiAssistant, icon: BrainCircuit, section: 'Assistant', sectionLabel: sectionLabels.assistant, path: '/ai' },
  ];
}

export function buildBottomNavItems(t: NavigationLabels): NavItem[] {
  return [
    { id: 'USER_CONFIG', label: t.userConfig, icon: Settings },
    { id: 'USER_MGMT',   label: t.userMgmt,   icon: Users,       path: '/users' },
    { id: 'AUDIT_LOG',   label: t.auditLog,   icon: ShieldCheck, path: '/audit' },
    { id: 'HEALTH',      label: t.systemHealth, icon: HeartPulse, section: 'System', sectionLabel: t.navSectionSystem, path: '/health' },
    { id: 'MANUAL',      label: t.manual,     icon: BookOpen,    path: '/manual' },
  ];
}

export function getViewNavigationMeta(
  t: NavigationLabels,
  view: ViewState,
): { label: string; section?: string } | undefined {
  const auxMeta: Partial<Record<ViewState, { label: string; section?: string }>> = {
    RAROC: { label: t.navRaroc, section: 'Pricing Cockpit' },
    SHOCKS: { label: t.navStressTest, section: 'Pricing Cockpit' },
    WHAT_IF: { label: t.navWhatIf, section: 'Pricing Cockpit' },
    ACCOUNTING: { label: t.auxAccountingLedger, section: 'Pricing Cockpit' },
    BEHAVIOURAL: { label: t.behaviouralModels, section: 'Data & Ops Hub' },
    MARKET_BENCHMARKS: { label: t.navMarketBenchmarks, section: 'Data & Ops Hub' },
    CAMPAIGNS: { label: t.navCampaigns, section: 'Relationship Cockpit' },
    CONTROL_ROOM: { label: t.navControlRoom, section: 'Today' },
    MODEL_INVENTORY: { label: t.navModelInventory, section: 'Governance Hub' },
    DOSSIERS: { label: t.navDossiers, section: 'Governance Hub' },
    BUDGET_RECONCILIATION: { label: t.navBudgetReconciliation, section: 'Governance Hub' },
    ATTRIBUTION_REPORTING: { label: t.navAttributionReporting, section: 'Governance Hub' },
    ESCALATIONS: { label: t.auxEscalations, section: 'Governance Hub' },
    ATTRIBUTION_MATRIX: { label: t.auxAttributionMatrix, section: 'Governance Hub' },
  };
  return auxMeta[view];
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
  section: 'Relationship Cockpit' | 'Pricing Cockpit' | 'Data & Ops Hub' | 'Governance Hub';
}

export function buildAuxDestinations(t: NavigationLabels): AuxDestination[] {
  return [
    { id: 'CAMPAIGNS',             label: t.navCampaigns,              sublabel: t.commandNavigateSublabel,        icon: Target,          path: '/campaigns',              section: 'Relationship Cockpit' },
    { id: 'RAROC',                 label: t.navRaroc,                  sublabel: t.commandNavigateSublabel,        icon: Percent,         path: '/raroc',                  section: 'Pricing Cockpit' },
    { id: 'SHOCKS',                label: t.navStressTest,             sublabel: t.commandNavigateSublabel,        icon: Zap,             path: '/stress-testing',         section: 'Pricing Cockpit' },
    { id: 'WHAT_IF',               label: t.navWhatIf,                 sublabel: t.commandNavigateSublabel,        icon: FlaskConical,    path: '/what-if',                section: 'Pricing Cockpit' },
    { id: 'ACCOUNTING',            label: t.auxAccountingLedger,        sublabel: t.auxAccountingLedgerDesc,        icon: LayoutDashboard, path: '/accounting',             section: 'Pricing Cockpit' },
    { id: 'BEHAVIOURAL',           label: t.behaviouralModels,          sublabel: t.commandNavigateSublabel,        icon: Activity,        path: '/behavioural',            section: 'Data & Ops Hub' },
    { id: 'MARKET_BENCHMARKS',     label: t.navMarketBenchmarks,        sublabel: t.auxMarketBenchmarksDesc,        icon: DatabaseZap,     path: '/market-benchmarks',      section: 'Data & Ops Hub' },
    { id: 'GOV_ADAPTERS',          label: t.auxAdapterHealth,           sublabel: t.auxAdapterHealthDesc,           icon: Plug,            path: '/adapters',               section: 'Data & Ops Hub' },
    { id: 'GOV_SLO',               label: t.auxSloDashboard,            sublabel: t.auxSloDashboardDesc,            icon: HeartPulse,      path: '/slo',                    section: 'Data & Ops Hub' },
    { id: 'GOV_SNAPSHOTS',         label: t.auxSnapshotReplay,          sublabel: t.auxSnapshotReplayDesc,          icon: History,         path: '/snapshots',              section: 'Governance Hub' },
    { id: 'MODEL_INVENTORY',       label: t.navModelInventory,          sublabel: t.commandNavigateSublabel,        icon: BookOpenCheck,   path: '/models',                 section: 'Governance Hub' },
    { id: 'DOSSIERS',              label: t.navDossiers,                sublabel: t.commandNavigateSublabel,        icon: FileSignature,   path: '/dossiers',               section: 'Governance Hub' },
    { id: 'BUDGET_RECONCILIATION', label: t.navBudgetReconciliation,    sublabel: t.commandNavigateSublabel,        icon: Scale,           path: '/budget/reconciliation',  section: 'Governance Hub' },
    { id: 'ATTRIBUTION_REPORTING', label: t.navAttributionReporting,    sublabel: t.commandNavigateSublabel,        icon: BarChart4,       path: '/attributions/reporting', section: 'Governance Hub' },
    { id: 'ESCALATIONS',           label: t.auxEscalations,             sublabel: t.auxEscalationsDesc,             icon: ShieldAlert,     path: '/escalations',            section: 'Governance Hub' },
    { id: 'ATTRIBUTION_MATRIX',    label: t.auxAttributionMatrix,       sublabel: t.auxAttributionMatrixDesc,       icon: Plug,            path: '/attributions/matrix',    section: 'Governance Hub' },
  ];
}
