/**
 * Core bounded context — public surface (Ola C-7).
 *
 * The *orchestrator* of the pricing motor. Glues together credit,
 * liquidity, capital, market, governance and analytics into a single
 * `calculatePricing` entry point.
 *
 * Strategy: re-export the orchestrator through `@npricing/pricing-core`, plus
 * bitemporal/model-inventory/formula helpers that still live under `utils`.
 * The physical inversion (so package files own implementation directly) is a
 * subsequent mechanical move — see contexts/README.md.
 *
 * This closes the 7-wave extraction plan: all public motor surface is now
 * reachable through the `contexts/` hierarchy + root namespaces.
 */

// Main orchestrator + context + shocks
export { calculatePricing, batchReprice, resolveEffectiveTenors, DEFAULT_PRICING_SHOCKS } from '@npricing/pricing-core';

export type { PricingContext, PricingShocks } from '@npricing/pricing-core';

// Bitemporal — as-of recomputation support (Gap 18)
export * as bitemporal from '../../bitemporal';

// Model inventory — metadata registry used by MRM views
export * as modelInventory from '../../modelInventory';

// Formula engine — kept as first-class because tests reference it directly
export {
  inferFormulaFromProduct,
  applyProductFormula,
  calculateCreditCost,
  getClientRating,
  calculateBehaviouralSpread,
  calculateMovingAverageFTP,
  lookupIncentivisation,
} from '../../formulaEngine';

export type { FormulaResult } from '../../formulaEngine';
