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
 *   4. INSIGHTS      → pure outputs (Analytics, Discipline, Attribution
 *                      Reporting)
 *   5. GOVERNANCE    → control + audit + reproducibility (operativo diario)
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
 *
 * Density pass (Ola 10.7, 2026-04-30): Governance bajó de 8 → 5 entradas:
 *   - ESCALATIONS demoted to AUX — flujo edge case (escalation atascada
 *     genera alerta), no requiere bandeja diaria
 *   - ATTRIBUTION_MATRIX demoted to AUX — es config de organigrama (se
 *     edita cuando cambia la estructura, no a diario)
 *   - ATTRIBUTION_REPORTING moved to Insights — semánticamente es
 *     analytics/output, no governance operativo
 * Sidebar visible passes from 28 → 26 entries without breaking E2E that
 * depend on AUDIT_LOG / HEALTH still being in bottom nav. Reducción mayor
 * (a < 20) requiere refactor UI: collapsed Pricing tabs, Approvals Hub,
 * Reconciliation Hub — diferido a Ola futura post pilot feedback.
 */
export function buildMainNavItems(t: NavigationLabels): NavItem[] {
  const sectionLabels = {
    relationships: t.navSectionRelationships,
    pricing: t.navSectionPricing,
    marketData: t.navSectionMarketData,
    insights: t.navSectionInsights,
    governance: t.navSectionGovernance,
    assistant: t.navSectionAssistant,
  };

  return [
    // ─────────────── RELATIONSHIPS ───────────────
    { id: 'CUSTOMER_360', label: t.navClients,   icon: Users,               section: 'Relationships', sectionLabel: sectionLabels.relationships, path: '/customers' },
    { id: 'PIPELINE',     label: t.navPipeline,  icon: GitPullRequestArrow, section: 'Relationships', sectionLabel: sectionLabels.relationships, path: '/pipeline' },
    { id: 'CAMPAIGNS',    label: t.navCampaigns, icon: Target,              section: 'Relationships', sectionLabel: sectionLabels.relationships, path: '/campaigns' },
    { id: 'TARGET_GRID',  label: t.navTargets,   icon: Grid3X3,             section: 'Relationships', sectionLabel: sectionLabels.relationships, path: '/target-grid' },

    // ─────────────── PRICING ───────────────
    // The 4 workspaces are now first-class entries (nested routes under
    // <PricingLayoutShell>). Post-trade stays in this bucket because its
    // gravity is pricing-adjacent, not an insight or governance artefact.
    { id: 'CALCULATOR',     label: t.navCalculator,    icon: Calculator,   section: 'Pricing', sectionLabel: sectionLabels.pricing, path: '/pricing' },
    { id: 'RAROC',          label: t.navRaroc,         icon: Percent,      section: 'Pricing', sectionLabel: sectionLabels.pricing, path: '/raroc' },
    { id: 'SHOCKS',         label: t.navStressTest,    icon: Zap,          section: 'Pricing', sectionLabel: sectionLabels.pricing, path: '/stress-testing' },
    { id: 'STRESS_PRICING', label: t.navStressPricing, icon: LineChart,    section: 'Pricing', sectionLabel: sectionLabels.pricing, path: '/stress-pricing' },
    { id: 'WHAT_IF',        label: t.navWhatIf,        icon: FlaskConical, section: 'Pricing', sectionLabel: sectionLabels.pricing, path: '/what-if' },
    { id: 'BLOTTER',     label: t.dealBlotter,       icon: FileText,      section: 'Pricing', sectionLabel: sectionLabels.pricing, path: '/blotter' },
    // Accounting Ledger demoted to AUX (reachable via ⌘K) on 2026-04-22.
    // Reason: today the view mixes a FTP-summary + T-accounts + journal
    // ledger for no specific daily user. The valuable use case —
    // reconciliation of BU vs Treasury entries — is a follow-up rewrite.
    // Keep the route alive so deep links + E2E still work.

    // ─────────────── MARKET DATA ───────────────
    // Inputs to the motor. Methodology belongs here because it is engine
    // *configuration*, not a control artefact — and it sits upstream of
    // every pricing call.
    { id: 'MARKET_DATA', label: t.yieldCurves,       icon: TrendingUp, section: 'Market Data', sectionLabel: sectionLabels.marketData, path: '/market-data' },
    { id: 'BEHAVIOURAL', label: t.behaviouralModels, icon: Activity,   section: 'Market Data', sectionLabel: sectionLabels.marketData, path: '/behavioural' },
    { id: 'METHODOLOGY', label: t.navMethodology,    icon: GitBranch,  section: 'Market Data', sectionLabel: sectionLabels.marketData, path: '/methodology' },

    // ─────────────── INSIGHTS ───────────────
    // Outputs only: portfolio analytics + pricing discipline variance +
    // attribution reporting (Ola 10.7 — moved here from Governance because
    // it's pure analytics output, not control operativo).
    { id: 'REPORTING',             label: t.navAnalytics,             icon: BarChart4, section: 'Insights', sectionLabel: sectionLabels.insights, path: '/analytics' },
    { id: 'DISCIPLINE',            label: t.pricingDiscipline,        icon: Sparkles,  section: 'Insights', sectionLabel: sectionLabels.insights, path: '/discipline' },
    { id: 'ATTRIBUTION_REPORTING', label: t.navAttributionReporting,  icon: BarChart4, section: 'Insights', sectionLabel: sectionLabels.insights, path: '/attributions/reporting' },

    // ─────────────── GOVERNANCE ───────────────
    // Operativo diario de control. ESCALATIONS y ATTRIBUTION_MATRIX viven
    // en AUX (⌘K) post Ola 10.7 — son edge case / config infrecuente.
    { id: 'MODEL_INVENTORY',       label: t.navModelInventory,       icon: BookOpenCheck, section: 'Governance', sectionLabel: sectionLabels.governance, path: '/models' },
    { id: 'DOSSIERS',              label: t.navDossiers,             icon: FileSignature, section: 'Governance', sectionLabel: sectionLabels.governance, path: '/dossiers' },
    { id: 'APPROVALS',             label: t.navApprovals,            icon: ShieldCheck,   section: 'Governance', sectionLabel: sectionLabels.governance, path: '/approvals' },
    { id: 'BUDGET_RECONCILIATION', label: t.navBudgetReconciliation, icon: Scale,         section: 'Governance', sectionLabel: sectionLabels.governance, path: '/budget/reconciliation' },
    { id: 'RECONCILIATION',        label: t.navFtpReconciliation,    icon: Scale,         section: 'Governance', sectionLabel: sectionLabels.governance, path: '/reconciliation' },

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

export function buildAuxDestinations(t: NavigationLabels): AuxDestination[] {
  return [
    { id: 'ACCOUNTING',         label: t.auxAccountingLedger,    sublabel: t.auxAccountingLedgerDesc,    icon: LayoutDashboard, path: '/accounting',          section: 'Pricing' },
    { id: 'GOV_SNAPSHOTS',      label: t.auxSnapshotReplay,      sublabel: t.auxSnapshotReplayDesc,      icon: History,         path: '/snapshots',           section: 'Governance' },
    { id: 'GOV_SLO',            label: t.auxSloDashboard,        sublabel: t.auxSloDashboardDesc,        icon: HeartPulse,      path: '/slo',                 section: 'Governance' },
    { id: 'GOV_ADAPTERS',       label: t.auxAdapterHealth,       sublabel: t.auxAdapterHealthDesc,       icon: Plug,            path: '/adapters',            section: 'Governance' },
    // Ola 10.7 \u2014 demoted from main sidebar to keep Governance \u2264 5 entries.
    { id: 'ESCALATIONS',        label: t.auxEscalations,         sublabel: t.auxEscalationsDesc,         icon: ShieldAlert,     path: '/escalations',         section: 'Governance' },
    { id: 'ATTRIBUTION_MATRIX', label: t.auxAttributionMatrix,   sublabel: t.auxAttributionMatrixDesc,   icon: Plug,            path: '/attributions/matrix', section: 'Governance' },
  ];
}

export const AUX_DESTINATIONS: AuxDestination[] = buildAuxDestinations(translations.en);
