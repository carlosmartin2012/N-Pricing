/**
 * IFRS 9 / Anejo IX credit lifecycle engine.
 * Covers: Stage classification, SICR triggers, lifetime EL calculation
 * with term-structural PD curves and stage-aware provisioning.
 */

/** IFRS 9 stages per Anejo IX */
export type IFRS9Stage = 1 | 2 | 3;

/** SICR trigger inputs — significant increase in credit risk */
export interface SICRInputs {
  /** Current 12m PD vs PD at origination — ratio (e.g., 2.5 = 2.5× increase) */
  pdMultiplier?: number;
  /** Days past due */
  daysPastDue?: number;
  /** Deal has been refinanced under financial difficulties */
  isRefinanced?: boolean;
  /** Deal flagged on internal watchlist */
  isWatchlist?: boolean;
  /** Counterparty is in forbearance */
  isForborne?: boolean;
}

export interface SICRResult {
  triggered: boolean;
  stage: IFRS9Stage;
  reasons: string[];
}

/**
 * Detect SICR (Significant Increase in Credit Risk) per IFRS 9 + Anejo IX.
 * Returns stage classification with triggered reasons.
 *
 * Stage 3 (default): DPD > 90, or already in default
 * Stage 2 (SICR): PD multiplier > 2, DPD > 30, refinanced, watchlist, forborne
 * Stage 1 (performing): neither
 */
export function detectSICR(input: SICRInputs): SICRResult {
  const reasons: string[] = [];

  // Stage 3 triggers (default)
  if ((input.daysPastDue ?? 0) > 90) {
    reasons.push('Default: DPD > 90');
    return { triggered: true, stage: 3, reasons };
  }

  // Stage 2 triggers (SICR)
  if ((input.pdMultiplier ?? 1) >= 2.0) {
    reasons.push(`PD multiplier ${input.pdMultiplier!.toFixed(2)}× ≥ 2.0`);
  }
  if ((input.daysPastDue ?? 0) > 30) {
    reasons.push('DPD > 30');
  }
  if (input.isRefinanced) reasons.push('Refinanced under financial difficulties');
  if (input.isWatchlist) reasons.push('Watchlist');
  if (input.isForborne) reasons.push('Forborne exposure');

  if (reasons.length > 0) {
    return { triggered: true, stage: 2, reasons };
  }

  return { triggered: false, stage: 1, reasons: [] };
}

/**
 * Build a term-structural PD curve from a 12m point-in-time PD.
 * Uses a simple constant-hazard (exponential) extrapolation:
 *   PD(t) = 1 - exp(-λ × t)  where λ = -ln(1 - PD_12m)
 *
 * Returns array of cumulative PD values per year, length = ceil(months/12).
 */
export function buildPdTermStructure(
  pd12m: number,
  durationMonths: number,
): number[] {
  if (pd12m <= 0 || pd12m >= 1) {
    const years = Math.max(1, Math.ceil(durationMonths / 12));
    return Array(years).fill(Math.min(0.9999, Math.max(0, pd12m)));
  }

  const lambda = -Math.log(1 - pd12m);
  const years = Math.max(1, Math.ceil(durationMonths / 12));
  const curve: number[] = [];
  for (let t = 1; t <= years; t++) {
    curve.push(1 - Math.exp(-lambda * t));
  }
  return curve;
}

/**
 * Calculate Expected Loss under stage-aware IFRS 9 rules.
 *
 * Stage 1: EL 12m = PD_12m × LGD × EAD
 * Stage 2: EL lifetime = Σ [ΔPD(t) × LGD × EAD_t × DF(t)]
 * Stage 3: EL = LGD × EAD (defaulted, full expected loss)
 *
 * DF uses a simple discount at riskFreeRate (default 3% flat).
 */
export interface LifetimeELInput {
  pd12m: number;
  lgd: number;
  ead: number;
  durationMonths: number;
  stage: IFRS9Stage;
  /** Discount rate for lifetime EL (% annual). Default 3% */
  discountRate?: number;
}

export interface LifetimeELResult {
  stage: IFRS9Stage;
  el12m: number;
  elLifetime: number;
  /** EL applicable for provisioning: el12m for stage 1, elLifetime for stage 2/3 */
  provisionEL: number;
  /** Annualized EL cost as % EAD (for pricing waterfall) */
  annualCostPct: number;
  /** Per-year cumulative PD curve used */
  pdCurve: number[];
}

export function calculateLifetimeEL(input: LifetimeELInput): LifetimeELResult {
  const { pd12m, lgd, ead, durationMonths, stage } = input;
  const discountRate = (input.discountRate ?? 3) / 100;
  const yearsRaw = durationMonths / 12;
  const years = Math.max(1, Math.ceil(yearsRaw));

  // Sanitize inputs
  const pdSafe = Math.min(0.9999, Math.max(0, pd12m));
  const lgdSafe = Math.min(1, Math.max(0, lgd));

  // Build term-structural PD curve (cumulative)
  const pdCurve = buildPdTermStructure(pdSafe, durationMonths);

  // Stage 1: 12m EL only
  const el12m = pdSafe * lgdSafe * ead;

  // Stage 2: lifetime EL with incremental PD per period
  let elLifetime = 0;
  let prevCumPd = 0;
  for (let t = 0; t < years; t++) {
    const cumPd = pdCurve[t];
    const marginalPd = Math.max(0, cumPd - prevCumPd);
    const df = 1 / Math.pow(1 + discountRate, t + 1);
    elLifetime += marginalPd * lgdSafe * ead * df;
    prevCumPd = cumPd;
  }

  // Stage 3: defaulted — full LGD × EAD
  const stage3EL = lgdSafe * ead;

  const provisionEL =
    stage === 3 ? stage3EL : stage === 2 ? elLifetime : el12m;

  const annualCostPct = yearsRaw > 0 ? (provisionEL / ead / yearsRaw) * 100 : 0;

  return {
    stage,
    el12m,
    elLifetime,
    provisionEL,
    annualCostPct,
    pdCurve,
  };
}

/**
 * Combine SICR detection + lifetime EL calculation into a single call.
 * Convenience function for integration in pricingEngine.
 */
export function assessCreditLifecycle(
  pd12m: number,
  lgd: number,
  ead: number,
  durationMonths: number,
  sicrInputs: SICRInputs = {},
  explicitStage?: IFRS9Stage,
): LifetimeELResult & { sicrResult: SICRResult } {
  const sicrResult = detectSICR(sicrInputs);
  const stage: IFRS9Stage = explicitStage ?? sicrResult.stage;

  const el = calculateLifetimeEL({
    pd12m,
    lgd,
    ead,
    durationMonths,
    stage,
  });

  return { ...el, sicrResult };
}
