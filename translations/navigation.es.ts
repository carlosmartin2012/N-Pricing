/**
 * Navigation namespace (ES) — versión castellana de `navigation.en.ts`.
 *
 * Migrado desde `translations.ts` monolítico (Ola 7 Bloque D, 2026-05-18).
 * Cualquier nueva entrada de sidebar / sección debe añadirse aquí Y en
 * `navigation.en.ts` con la misma clave.
 */

import type { NavigationTranslationKeys } from './navigation.en';

export const navigationEs: NavigationTranslationKeys = {
  // Sidebar entries
  navClients: 'Clientes',
  navControlRoom: 'Sala de control',
  navPipeline: 'Pipeline',
  navCampaigns: 'Campañas',
  navTargets: 'Targets',
  navCalculator: 'Calculadora',
  navRaroc: 'RAROC',
  navStressTest: 'Stress por deal',
  navStressPricing: 'Stress de pricing · EBA',
  navWhatIf: 'What-If',
  navMarketBenchmarks: 'Benchmarks de mercado',
  navMethodology: 'Metodología',
  navAnalytics: 'Analytics',
  navAttributionReporting: 'Reporting de atribuciones',
  navModelInventory: 'Inventario de modelos',
  navDossiers: 'Dossiers',
  navApprovals: 'Aprobaciones',
  navBudgetReconciliation: 'Reconciliación budget',
  navFtpReconciliation: 'Reconciliación FTP',
  navAiAssistant: 'Asistente IA',

  // Section headers
  navSectionToday: 'Resumen',
  navSectionRelationships: 'Relaciones',
  navSectionPricing: 'Pricing',
  navSectionMarketData: 'Datos de mercado',
  navSectionInsights: 'Insights',
  navSectionGovernance: 'Gobernanza',
  navSectionAssistant: 'Asistente',
  navSectionSystem: 'Sistema',
};
