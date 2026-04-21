/**
 * Pricing namespace (EN) — Calculator, RAROC, Stress, What-If.
 *
 * Keys for the Pricing workspace. Disjoint from the monolith
 * `translations.ts` — only NEW keys land here during the incremental
 * migration (see translations/README.md).
 */

interface PricingPack {
  [key: string]: string;
}

export const pricingEn: PricingPack = {
  // Workspace shell / tab bar
  pricingTabDeal: 'Deal',
  pricingTabRaroc: 'RAROC',
  pricingTabStress: 'Stress',
  pricingTabWhatIf: 'What-If',
  pricingTabDealSub: 'Motor + recommendation',
  pricingTabRarocSub: 'Economic profit + hurdle',
  pricingTabStressSub: 'EBA 6 scenarios',
  pricingTabWhatIfSub: 'Simulation + backtest',

  // Calculator panels
  pricingCalculatorShellError: 'Pricing calculator encountered an error',
  pricingRecomputeInProgress: 'Recomputing pricing…',
  pricingNoResult: 'No pricing result — check deal inputs and rules.',

  // Deal lifecycle
  pricingDealDraft: 'Draft',
  pricingDealPendingApproval: 'Pending approval',
  pricingDealApproved: 'Approved',
  pricingDealRejected: 'Rejected',

  // RAROC terminal
  pricingRarocHurdle: 'Hurdle',
  pricingRarocEconomicProfit: 'Economic Profit',
  pricingRarocAdjustedEp: 'Adjusted EP (post ESG)',
  pricingRarocReturnOnCapital: 'Return on Capital',

  // Stress
  pricingStressScenarios: 'Scenarios',
  pricingStressImpact: 'Shock impact',
  pricingStressClear: 'Clear shocks',

  // What-If
  pricingWhatIfSandbox: 'Sandbox',
  pricingWhatIfRun: 'Run backtest',
  pricingWhatIfDrift: 'Drift vs. baseline',
};

export type PricingTranslationKeys = typeof pricingEn;
