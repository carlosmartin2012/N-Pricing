import type { PricingTranslationKeys } from './pricing.en';

export const pricingEs: PricingTranslationKeys = {
  pricingTabDeal: 'Deal',
  pricingTabRaroc: 'RAROC',
  pricingTabStress: 'Estrés',
  pricingTabWhatIf: 'What-If',
  pricingTabDealSub: 'Motor + recomendación',
  pricingTabRarocSub: 'Economic profit + hurdle',
  pricingTabStressSub: 'EBA 6 escenarios',
  pricingTabWhatIfSub: 'Simulación + backtest',

  pricingCalculatorShellError: 'Error en el motor de pricing',
  pricingRecomputeInProgress: 'Recalculando pricing…',
  pricingNoResult: 'Sin resultado — revisa inputs y reglas.',

  pricingDealDraft: 'Borrador',
  pricingDealPendingApproval: 'Pendiente de aprobación',
  pricingDealApproved: 'Aprobado',
  pricingDealRejected: 'Rechazado',

  pricingRarocHurdle: 'Hurdle',
  pricingRarocEconomicProfit: 'Economic Profit',
  pricingRarocAdjustedEp: 'EP ajustado (post ESG)',
  pricingRarocReturnOnCapital: 'Retorno sobre capital',

  pricingStressScenarios: 'Escenarios',
  pricingStressImpact: 'Impacto del shock',
  pricingStressClear: 'Limpiar shocks',

  pricingWhatIfSandbox: 'Sandbox',
  pricingWhatIfRun: 'Ejecutar backtest',
  pricingWhatIfDrift: 'Drift vs. baseline',
};
