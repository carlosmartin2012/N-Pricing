/**
 * Centralized pricing constants for the FTP engine.
 * All values in percentage points unless noted otherwise (bps = basis points).
 */

/** Tenor string to months mapping for curve interpolation */
export const TENOR_MONTHS: Record<string, number> = {
  'ON': 0, '1W': 0.25, '2W': 0.5,
  '1M': 1, '2M': 2, '3M': 3, '6M': 6, '9M': 9,
  '1Y': 12, '2Y': 24, '3Y': 36, '5Y': 60,
  '7Y': 84, '10Y': 120, '15Y': 180, '20Y': 240, '30Y': 360,
};

/**
 * PD/LGD parameters by credit rating.
 * PD = annual probability of default (%).
 * LGD = loss given default (%).
 * Source: Basel III IRB calibration (indicative).
 */
export const CREDIT_PARAMS: Record<string, { pd: number; lgd: number }> = {
  'AAA': { pd: 0.01, lgd: 45 },
  'AA+': { pd: 0.02, lgd: 45 },
  'AA':  { pd: 0.03, lgd: 45 },
  'AA-': { pd: 0.04, lgd: 45 },
  'A+':  { pd: 0.05, lgd: 45 },
  'A':   { pd: 0.07, lgd: 45 },
  'A-':  { pd: 0.09, lgd: 45 },
  'BBB+': { pd: 0.15, lgd: 45 },
  'BBB': { pd: 0.25, lgd: 45 },
  'BBB-': { pd: 0.40, lgd: 45 },
  'BB+': { pd: 0.60, lgd: 50 },
  'BB':  { pd: 1.00, lgd: 50 },
  'BB-': { pd: 1.50, lgd: 50 },
  'B+':  { pd: 2.50, lgd: 55 },
  'B':   { pd: 4.00, lgd: 55 },
  'B-':  { pd: 6.00, lgd: 60 },
  'CCC': { pd: 10.00, lgd: 65 },
  'CC':  { pd: 20.00, lgd: 70 },
  'NR':  { pd: 2.00, lgd: 50 },
};

export const PRICING_CONSTANTS = {
  // Currency basis adjustments (%) — proxy for cross-currency basis swap
  CURRENCY_ADJUSTMENTS: {
    EUR: -1.0,
    JPY: -2.5,
    GBP: -0.3,
    CHF: -1.8,
  } as Record<string, number>,

  // NSFR Floor
  NSFR_FLOOR_WEIGHT: 0.5,

  // CLC (Credit Liquidity Cost)
  OPERATIONAL_SEGMENT_DISCOUNT: 0.5,
  UNDRAWN_CLC_SCALE: 0.1,
  DEFAULT_BASIS_SPREAD_BPS: 30,

  // Regulatory
  LCR_OPERATIONAL_BENEFIT: -0.10,

  // Commercial Buffer
  TARGET_PRICE_BUFFER: 0.5,

  // Default fallback credit params
  DEFAULT_CREDIT_RATING: 'BBB',

  // ── ESG Gaps 17–19 ─────────────────────────────────────────────────────
  // Gap 18: DNSH capital discount — multiplier on capitalCharge (e.g. 0.85 = 15% reduction)
  DNSH_CAPITAL_DISCOUNT_FACTOR: 0.85,

  // Gap 19: Infrastructure Supporting Factor (CRR2 Art. 501a) — multiplier on RW
  ISF_RW_FACTOR: 0.75,
};
