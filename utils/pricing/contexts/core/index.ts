/**
 * Core bounded context — public surface (Ola C-7).
 *
 * The *orchestrator* of the pricing motor. Glues together credit,
 * liquidity, capital, market, governance and analytics into a single
 * `calculatePricing` entry point.
 *
 * Strategy: re-export from the monolithic `utils/pricingEngine.ts` and
 * `utils/pricing/bitemporal.ts` + `utils/pricing/modelInventory.ts`. The
 * physical inversion (so pricingEngine imports *from* its own contexts
 * instead of the flat files) is a subsequent PR — see contexts/README.md.
 *
 * This closes the 7-wave extraction plan: all public motor surface is now
 * reachable through the `contexts/` hierarchy + root namespaces.
 */

// Main orchestrator + context + shocks
export {
  calculatePricing,
  batchReprice,
  resolveEffectiveTenors,
  DEFAULT_PRICING_SHOCKS,
} from '../../../pricingEngine';

export type {
  PricingContext,
  PricingShocks,
} from '../../../pricingEngine';

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
