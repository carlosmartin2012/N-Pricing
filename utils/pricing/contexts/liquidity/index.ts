/**
 * Liquidity bounded context — public surface (Ola C-4).
 *
 * Groups LCR / NSFR / LP curve primitives:
 *   - LP curve interpolation (secured / unsecured dual)
 *   - Blended LP (external vs internal funding mix)
 *   - SDR (stable deposit ratio) modulation
 *   - LCR + NSFR charges from regulatory tables
 *   - Liquidity recharge allocation
 *   - Deposit stability classification (gap 14)
 *
 * Strategy: re-export from `liquidityEngine.ts` until physical move.
 * Consumers: pricingEngine orchestrator, LCR/NSFR UI panels, regulatory
 * reporting.
 */

export {
  interpolateLiquidityCurve,
  calculateBlendedLP,
  applySDRModulation,
  classifyDepositStability,
  calculateLCRCharge,
  calculateNSFRCharge,
  calculateLiquidityRecharge,
} from '../../liquidityEngine';
