/**
 * Macro stress scenarios — extends the basic interest-rate / liquidity shocks
 * with real macroeconomic stress factors.
 *
 * Per EBA GL/2018/02 and BdE scenario templates.
 */

export interface MacroScenario {
  id: string;
  label: string;
  /** Interest rate parallel shift (bps) */
  interestRateShift: number;
  /** Liquidity spread shock (bps) */
  liquiditySpreadShock: number;
  /** PD multiplier (1.0 = no stress) */
  pdMultiplier: number;
  /** LGD multiplier (1.0 = no stress) */
  lgdMultiplier: number;
  /** HPI shock — house price index change, e.g. -0.20 = -20% */
  hpiShock: number;
  /** GDP YoY shock (e.g. -0.03 = -3% recession) */
  gdpShock: number;
  /** Unemployment rate shock (pp, e.g., +3 = +3pp) */
  unemploymentShock: number;
  /** Description for UI */
  description: string;
}

/** Standard EBA stress scenarios */
export const MACRO_SCENARIOS: Record<string, MacroScenario> = {
  BASELINE: {
    id: 'BASELINE',
    label: 'Baseline',
    interestRateShift: 0,
    liquiditySpreadShock: 0,
    pdMultiplier: 1.0,
    lgdMultiplier: 1.0,
    hpiShock: 0,
    gdpShock: 0,
    unemploymentShock: 0,
    description: 'Escenario base sin stress',
  },
  ADVERSE_MILD: {
    id: 'ADVERSE_MILD',
    label: 'Adverse (mild)',
    interestRateShift: 100,
    liquiditySpreadShock: 50,
    pdMultiplier: 1.5,
    lgdMultiplier: 1.1,
    hpiShock: -0.10,
    gdpShock: -0.015,
    unemploymentShock: 1.5,
    description: 'Deterioro moderado: +100bp, HPI -10%, PD ×1.5',
  },
  ADVERSE_SEVERE: {
    id: 'ADVERSE_SEVERE',
    label: 'Adverse (severe)',
    interestRateShift: 200,
    liquiditySpreadShock: 100,
    pdMultiplier: 2.5,
    lgdMultiplier: 1.25,
    hpiShock: -0.20,
    gdpShock: -0.030,
    unemploymentShock: 3.0,
    description: 'EBA adverse: +200bp, HPI -20%, PD ×2.5',
  },
  LIQUIDITY_STRESS: {
    id: 'LIQUIDITY_STRESS',
    label: 'Liquidity stress',
    interestRateShift: 0,
    liquiditySpreadShock: 200,
    pdMultiplier: 1.1,
    lgdMultiplier: 1.0,
    hpiShock: 0,
    gdpShock: 0,
    unemploymentShock: 0,
    description: 'Shock de liquidez: spread +200bp',
  },
  RATE_SHOCK_UP: {
    id: 'RATE_SHOCK_UP',
    label: 'Rate shock +200bp',
    interestRateShift: 200,
    liquiditySpreadShock: 20,
    pdMultiplier: 1.2,
    lgdMultiplier: 1.0,
    hpiShock: -0.05,
    gdpShock: -0.005,
    unemploymentShock: 0.5,
    description: 'Subida de tipos parallel',
  },
  RATE_SHOCK_DOWN: {
    id: 'RATE_SHOCK_DOWN',
    label: 'Rate shock -200bp',
    interestRateShift: -200,
    liquiditySpreadShock: 0,
    pdMultiplier: 1.0,
    lgdMultiplier: 1.0,
    hpiShock: 0.05,
    gdpShock: 0.005,
    unemploymentShock: -0.3,
    description: 'Bajada de tipos parallel',
  },
};

/**
 * Apply macro scenario stress to a PD input.
 * Caps PD at 99.9% to avoid degenerate EL calculations.
 */
export function stressedPd(pd: number, scenario: MacroScenario): number {
  return Math.min(0.999, pd * scenario.pdMultiplier);
}

/**
 * Apply macro scenario stress to an LGD input.
 * Caps LGD at 100%.
 */
export function stressedLgd(lgd: number, scenario: MacroScenario): number {
  return Math.min(1, lgd * scenario.lgdMultiplier);
}

/**
 * Apply HPI shock to a collateral value.
 * Used in secured lending to compute stressed LTV.
 */
export function stressedCollateralValue(
  baseValue: number,
  scenario: MacroScenario,
): number {
  return Math.max(0, baseValue * (1 + scenario.hpiShock));
}

/**
 * Extract basic PricingShocks (interest rate + liquidity spread) from a macro scenario.
 * Returned value can be passed directly to calculatePricing.
 */
export function toPricingShocks(scenario: MacroScenario): {
  interestRate: number;
  liquiditySpread: number;
} {
  return {
    interestRate: scenario.interestRateShift,
    liquiditySpread: scenario.liquiditySpreadShock,
  };
}
