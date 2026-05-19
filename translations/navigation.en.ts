/**
 * Navigation namespace (EN) — sidebar labels, section headers, AI assistant.
 *
 * Migrated from the monolithic `translations.ts` (Ola 7 Bloque D — i18n
 * namespaces split, 2026-05-18). Lives outside the legacy monolith so it
 * can be code-split per locale via `translations/lazy.ts`.
 *
 * Keep keys aligned with the sidebar / appNavigation.ts entries. Adding a
 * new ViewState ⇒ add a `navXxx` key here, not in `translations.ts`.
 */

interface NavigationPack {
  [key: string]: string;
}

export const navigationEn: NavigationPack = {
  // Sidebar entries
  navClients: 'Clients',
  navControlRoom: 'Control Room',
  navPipeline: 'Pipeline',
  navCampaigns: 'Campaigns',
  navTargets: 'Targets',
  navCalculator: 'Calculator',
  navRaroc: 'RAROC',
  navStressTest: 'Deal Stress',
  navStressPricing: 'Pricing Stress · EBA',
  navWhatIf: 'What-If',
  navMarketBenchmarks: 'Market Benchmarks',
  navMethodology: 'Methodology',
  navAnalytics: 'Analytics',
  navAttributionReporting: 'Attribution reporting',
  navModelInventory: 'Model Inventory',
  navDossiers: 'Dossiers',
  navApprovals: 'Approvals',
  navBudgetReconciliation: 'Budget reconciliation',
  navFtpReconciliation: 'FTP Reconciliation',
  navAiAssistant: 'AI Assistant',

  // Section headers (groups of sidebar entries)
  navSectionToday: 'Dashboard',
  navSectionRelationships: 'Relationships',
  navSectionPricing: 'Pricing',
  navSectionMarketData: 'Market Data',
  navSectionInsights: 'Insights',
  navSectionGovernance: 'Governance',
  navSectionAssistant: 'Assistant',
  navSectionSystem: 'System',
};

export type NavigationTranslationKeys = typeof navigationEn;
