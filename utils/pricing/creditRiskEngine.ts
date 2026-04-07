/**
 * Credit Risk Engine — Anejo IX (Circular 4/2017, updated by Circular 6/2021)
 *
 * Classifies deals into Banco de España segments and calculates expected loss
 * using the "soluciones alternativas" regulatory coverage percentages.
 */

import type { CreditRiskResult } from '../../types';
import {
  ANEJO_SEGMENTS,
  GUARANTEE_HAIRCUTS,
  MORTGAGE_LTV_THRESHOLD,
  MORTGAGE_LTV_CAP,
  APPRAISAL_AGE_FACTORS,
  APPRAISAL_STALE_FACTOR,
  FINANCIAL_PLEDGE_HAIRCUT,
  DEFAULT_MACRO_SCENARIOS,
  BASE_MIGRATION_PROB_S1_TO_S2,
  BASE_MIGRATION_PROB_S2_TO_S3,
  CCF_TABLE,
  type AnejoSegment,
  type GuaranteeType,
  type MacroScenario,
} from '../../constants/anejoIX';

// ── Input interface ──────────────────────────────────────────────────────────

export interface CreditRiskInput {
  productType: string;
  clientType: string;
  amount: number;
  ltvPct: number;
  /** Property type for mortgage haircuts (RESIDENTIAL_FINISHED, COMMERCIAL_OFFICE, etc.) */
  collateralType: string;
  collateralValue: number;
  /** Type of guarantee: MORTGAGE, FINANCIAL_PLEDGE, PERSONAL_GUARANTEE, PUBLIC_GUARANTEE, NONE */
  guaranteeType?: GuaranteeType;
  /** Months since last property appraisal (for mortgage aging discount) */
  appraisalAgeMonths?: number;
  /** Percentage of exposure covered by public guarantee (ICO/CESCE/FEI), 0-1 */
  publicGuaranteePct?: number;
}

// ── Segment classification ───────────────────────────────────────────────────

/**
 * Classify a deal into an Anejo IX segment based on product type,
 * client type and LTV (for mortgages).
 *
 * Matching is case-insensitive and follows BdE priority:
 *   1. Public-sector clients (Gov / Public / Institution)
 *   2. Product-based segments (mortgage, card, consumer, construction, etc.)
 *   3. Client-based fallback (SME, corporate, retail, self-employed)
 *   4. Default → OTHER
 */
export function classifyAnejoSegment(
  productType: string,
  clientType: string,
  ltvPct?: number,
): AnejoSegment {
  const product = productType.toLowerCase();
  const client = clientType.toLowerCase();

  // 1. Public sector — by client type
  if (
    client.includes('gov') ||
    client.includes('public') ||
    client.includes('institution')
  ) {
    return 'PUBLIC_SECTOR';
  }

  // 2. Product-based classification
  if (product.includes('mortgage') || product.includes('hipoteca')) {
    const ltv = ltvPct ?? 1; // assume high LTV if unknown
    return ltv <= MORTGAGE_LTV_THRESHOLD ? 'MORTGAGE_LOW_LTV' : 'MORTGAGE_HIGH_LTV';
  }

  if (product.includes('card') || product.includes('tarjeta')) {
    return 'CREDIT_CARDS';
  }

  if (
    product.includes('consumer') ||
    product.includes('consumo') ||
    product.includes('personal')
  ) {
    return 'CONSUMER';
  }

  if (product.includes('construction') || product.includes('promotor')) {
    return 'CONSTRUCTION';
  }

  if (product.includes('civil') || product.includes('infrastructure')) {
    return 'CIVIL_WORKS';
  }

  if (
    product.includes('project') ||
    product.includes('specialized') ||
    product.includes('shipping')
  ) {
    return 'SPECIALIZED';
  }

  // 3. Client-based fallback
  if (client.includes('sme') || client.includes('pyme')) {
    return 'SME';
  }

  if (client.includes('corporate')) {
    return 'LARGE_CORPORATE';
  }

  if (client.includes('retail')) {
    return 'CONSUMER';
  }

  if (client.includes('self_employed') || client.includes('autonomo')) {
    return 'SELF_EMPLOYED';
  }

  // 4. Default
  return 'OTHER';
}

// ── Guarantee netting ───────────────────────────────────────────────────────

/** Get appraisal age discount factor */
function getAppraisalAgeFactor(ageMonths: number | undefined): number {
  if (ageMonths == null || ageMonths <= 0) return 1.0;
  for (const [maxMonths, factor] of APPRAISAL_AGE_FACTORS) {
    if (ageMonths <= maxMonths) return factor;
  }
  return APPRAISAL_STALE_FACTOR;
}

/**
 * Calculate effective guarantee by type, following Anejo IX rules:
 * - MORTGAGE: property haircut × appraisal age factor, capped at LTV threshold
 * - FINANCIAL_PLEDGE: near-full deduction (2% haircut)
 * - PERSONAL_GUARANTEE: reclassifies to guarantor risk (treated as partial netting)
 * - PUBLIC_GUARANTEE: portion covered by public entity netted at 100%
 * - NONE / legacy collateralType: falls back to property haircut lookup
 */
function calculateEffectiveGuarantee(input: CreditRiskInput, grossExposure: number): number {
  const gType = input.guaranteeType ?? inferGuaranteeType(input.collateralType);

  switch (gType) {
    case 'FINANCIAL_PLEDGE': {
      const adjusted = input.collateralValue * (1 - FINANCIAL_PLEDGE_HAIRCUT);
      return Math.min(adjusted, grossExposure);
    }

    case 'PUBLIC_GUARANTEE': {
      const pct = input.publicGuaranteePct ?? 0;
      return grossExposure * Math.min(pct, 1);
    }

    case 'PERSONAL_GUARANTEE': {
      // Personal guarantees provide partial netting — typically 50% of collateral value
      return Math.min(input.collateralValue * 0.50, grossExposure);
    }

    case 'MORTGAGE': {
      if (input.collateralValue <= 0) return 0;
      const propertyHaircut = GUARANTEE_HAIRCUTS[input.collateralType] ?? 0.40;
      const ageFactor = getAppraisalAgeFactor(input.appraisalAgeMonths);
      const adjustedAppraisal = input.collateralValue * (1 - propertyHaircut) * ageFactor;

      // LTV cap: only the portion within threshold benefits from guarantee
      const ltvCap = MORTGAGE_LTV_CAP;
      const maxGuaranteedExposure = input.collateralValue * ltvCap;
      const cappedGuarantee = Math.min(adjustedAppraisal, maxGuaranteedExposure, grossExposure);

      return Math.max(0, cappedGuarantee);
    }

    case 'NONE':
    default: {
      // Legacy path: use collateralType as property key for haircut
      if (!input.collateralType || input.collateralType === 'None' || input.collateralValue <= 0) return 0;
      const haircut = GUARANTEE_HAIRCUTS[input.collateralType] ?? 0.40;
      return Math.min(input.collateralValue * (1 - haircut), grossExposure);
    }
  }
}

/** Infer guarantee type from legacy collateralType string */
function inferGuaranteeType(collateralType: string): GuaranteeType {
  if (!collateralType || collateralType === 'None') return 'NONE';
  const ct = collateralType.toLowerCase();
  if (ct.includes('sovereign') || ct.includes('public') || ct.includes('ico') || ct.includes('cesce')) return 'PUBLIC_GUARANTEE';
  if (ct.includes('pledge') || ct.includes('cash') || ct.includes('deposit') || ct.includes('securities')) return 'FINANCIAL_PLEDGE';
  if (ct.includes('personal') || ct.includes('aval') || ct.includes('guarantee')) return 'PERSONAL_GUARANTEE';
  if (ct.includes('residential') || ct.includes('commercial') || ct.includes('urban') || ct.includes('property')) return 'MORTGAGE';
  return 'NONE';
}

// ── Expected-loss calculation ────────────────────────────────────────────────

/**
 * Calculate Anejo IX credit risk metrics for a deal.
 *
 * Steps:
 *   1. Classify the segment
 *   2. Net guarantees (differentiated by type)
 *   3. Look up Stage 1 coverage from ANEJO_SEGMENTS
 *   4. Compute EL₁₂m = netExposure × (coverage / 100)
 *   5. Derive creditCostAnnualPct = (EL₁₂m / grossExposure) × 100
 */
export function calculateAnejoCreditRisk(input: CreditRiskInput): CreditRiskResult {
  const grossExposure = input.amount;

  // 1. Classify
  const anejoSegment = classifyAnejoSegment(input.productType, input.clientType, input.ltvPct);

  // 2. Guarantee netting (differentiated by type)
  const effectiveGuarantee = calculateEffectiveGuarantee(input, grossExposure);

  // 3. Net exposure
  const netExposure = Math.max(0, grossExposure - effectiveGuarantee);

  // 4. Coverage lookup (Stage 1 — performing book)
  const segmentDef = ANEJO_SEGMENTS[anejoSegment];
  const coveragePct = segmentDef.stage1Coverage;

  // 5. Expected loss
  const el12m = netExposure * (coveragePct / 100);

  // 6. Credit cost (guard division by zero)
  const creditCostAnnualPct = grossExposure > 0 ? (el12m / grossExposure) * 100 : 0;

  return {
    anejoSegment,
    stage: 1,
    grossExposure,
    effectiveGuarantee,
    netExposure,
    coveragePct,
    el12m,
    creditCostAnnualPct,
  };
}

// ── Sprint 3: Forward-looking & migration ──────────────────────────────────

export interface ForwardLookingInput extends CreditRiskInput {
  durationMonths: number;
  scenarios?: MacroScenario[];
  // Sprint 4: Mirror mode — external PD/LGD/EAD from bank's IFRS 9 engine
  /** Override mode: 'native' uses Anejo IX tables, 'mirror' uses external PD/LGD */
  mode?: 'native' | 'mirror';
  /** External PD 12-month (annual, as decimal e.g. 0.0025 = 0.25%) */
  externalPd12m?: number;
  /** External LGD (as decimal e.g. 0.45 = 45%) */
  externalLgd?: number;
  /** External EAD override */
  externalEad?: number;
  // Sprint 5: Product-specific fields for off-balance sheet exposures
  /** For credit lines / revolving: undrawn committed amount */
  undrawnAmount?: number;
  /** CCF type for off-balance sheet conversion */
  ccfType?: string;
  /** For revolving: utilization rate (drawn / limit) */
  utilizationRate?: number;
}

// ── Sprint 5: Product-specific EAD ──────────────────────────────────────────

/**
 * Calculate Exposure at Default for off-balance sheet products.
 * EAD = drawn + CCF × undrawn
 * For revolving (cards): if utilization > 90%, increase CCF by 50% (stress indicator)
 */
export function calculateEAD(input: ForwardLookingInput): number {
  const drawn = input.amount;
  const undrawn = input.undrawnAmount ?? 0;

  if (undrawn <= 0) return drawn;

  let ccf = CCF_TABLE[input.ccfType ?? 'OTHER_COMMITMENT'] ?? 0.40;

  // Stress for high-utilization revolving
  if (input.utilizationRate != null && input.utilizationRate > 0.90) {
    ccf = Math.min(ccf * 1.5, 1.0);
  }

  return drawn + ccf * undrawn;
}

// ── Sprint 5: Backtesting ───────────────────────────────────────────────────

export interface BacktestRecord {
  dealId: string;
  originationDate: string;
  segment: AnejoSegment;
  predictedEL: number;      // EL predicted at origination
  actualLoss: number;        // Actual loss observed
  predictedCoverage: number; // Coverage % at origination
  actualDefault: boolean;    // Did the deal default?
}

export interface BacktestResult {
  totalDeals: number;
  defaultedDeals: number;
  observedDefaultRate: number;
  predictedDefaultRate: number;
  totalPredictedEL: number;
  totalActualLoss: number;
  elAccuracyRatio: number;  // actualLoss / predictedEL (1.0 = perfect)
  bySegment: Record<string, {
    deals: number;
    defaults: number;
    observedRate: number;
    predictedRate: number;
    accuracyRatio: number;
  }>;
}

/**
 * Basic backtesting: compare predicted vs realized EL across a portfolio.
 * Returns accuracy metrics by segment and overall.
 */
export function backtestCreditRisk(records: BacktestRecord[]): BacktestResult {
  if (records.length === 0) {
    return {
      totalDeals: 0,
      defaultedDeals: 0,
      observedDefaultRate: 0,
      predictedDefaultRate: 0,
      totalPredictedEL: 0,
      totalActualLoss: 0,
      elAccuracyRatio: 0,
      bySegment: {},
    };
  }

  const totalDeals = records.length;
  const defaultedDeals = records.filter(r => r.actualDefault).length;
  const observedDefaultRate = defaultedDeals / totalDeals;

  const totalPredictedEL = records.reduce((sum, r) => sum + r.predictedEL, 0);
  const totalActualLoss = records.reduce((sum, r) => sum + r.actualLoss, 0);

  // Predicted default rate: average of per-deal coverage (proxy for PD)
  const predictedDefaultRate = records.reduce((sum, r) => sum + r.predictedCoverage, 0) / totalDeals / 100;

  // Accuracy ratio: actual / predicted (guard division by zero)
  const elAccuracyRatio = totalPredictedEL > 0 ? totalActualLoss / totalPredictedEL : 0;

  // Segment breakdown
  const segmentMap: Record<string, { deals: number; defaults: number; predictedEL: number; actualLoss: number; coverageSum: number }> = {};

  for (const r of records) {
    if (!segmentMap[r.segment]) {
      segmentMap[r.segment] = { deals: 0, defaults: 0, predictedEL: 0, actualLoss: 0, coverageSum: 0 };
    }
    const s = segmentMap[r.segment];
    s.deals++;
    if (r.actualDefault) s.defaults++;
    s.predictedEL += r.predictedEL;
    s.actualLoss += r.actualLoss;
    s.coverageSum += r.predictedCoverage;
  }

  const bySegment: BacktestResult['bySegment'] = {};
  for (const [seg, data] of Object.entries(segmentMap)) {
    bySegment[seg] = {
      deals: data.deals,
      defaults: data.defaults,
      observedRate: data.deals > 0 ? data.defaults / data.deals : 0,
      predictedRate: data.deals > 0 ? data.coverageSum / data.deals / 100 : 0,
      accuracyRatio: data.predictedEL > 0 ? data.actualLoss / data.predictedEL : 0,
    };
  }

  return {
    totalDeals,
    defaultedDeals,
    observedDefaultRate,
    predictedDefaultRate,
    totalPredictedEL,
    totalActualLoss,
    elAccuracyRatio,
    bySegment,
  };
}

/**
 * Calculate scenario-weighted coverage adjustment.
 * Returns weighted average of coverage × scenario factor.
 */
export function calculateScenarioWeightedCoverage(
  baseCoverage: number,
  scenarios: MacroScenario[],
): number {
  return scenarios.reduce(
    (sum, s) => sum + s.weight * baseCoverage * s.coverageAdjustmentFactor,
    0,
  );
}

/**
 * Calculate scenario-weighted migration adjustment factor.
 * Returns weighted average of scenario migration factors.
 */
function calculateWeightedMigrationFactor(scenarios: MacroScenario[]): number {
  return scenarios.reduce(
    (sum, s) => sum + s.weight * s.migrationAdjustmentFactor,
    0,
  );
}

/**
 * Calculate annual migration cost = expected cost of transitioning between stages.
 *
 * Formula:
 *   migrationCost = P(S1→S2) × (coverageS2 - coverageS1) × netExposure
 *                 + P(S1→S2) × P(S2→S3) × (averageCoverageS3 - coverageS1) × netExposure
 *
 * All probabilities adjusted by scenario-weighted migration factor.
 */
export function calculateMigrationCost(
  segment: AnejoSegment,
  netExposure: number,
  scenarios: MacroScenario[],
): { migrationCostAnnual: number; pMigrateS2: number; pMigrateS3: number } {
  const migFactor = calculateWeightedMigrationFactor(scenarios);

  const baseProbS1S2 = BASE_MIGRATION_PROB_S1_TO_S2[segment];
  const baseProbS2S3 = BASE_MIGRATION_PROB_S2_TO_S3[segment];
  const pMigrateS2 = baseProbS1S2 * migFactor;
  const pMigrateS3 = baseProbS2S3 * migFactor;

  const segDef = ANEJO_SEGMENTS[segment];
  const coverageS1 = segDef.stage1Coverage;
  const coverageS2 = segDef.stage2Coverage;

  // Use average Stage 3 coverage (mid-point of aging schedule: ~60%)
  const averageCoverageS3 = 60;

  // Cost of migrating from S1 → S2: incremental coverage × probability
  const costS1toS2 = pMigrateS2 * ((coverageS2 - coverageS1) / 100) * netExposure;

  // Cost of migrating from S1 → S2 → S3: compound probability × incremental coverage
  const costS1toS3 = pMigrateS2 * pMigrateS3 * ((averageCoverageS3 - coverageS1) / 100) * netExposure;

  const migrationCostAnnual = costS1toS2 + costS1toS3;

  return { migrationCostAnnual, pMigrateS2: baseProbS1S2, pMigrateS3: baseProbS2S3 };
}

/**
 * Calculate EL lifetime = sum of annual EL over deal duration.
 * Simplified: EL_lifetime ≈ EL_annual × min(durationYears, 30) (no discount for simplicity in Sprint 3)
 */
export function calculateELLifetime(
  elAnnual: number,
  durationMonths: number,
): number {
  const durationYears = Math.min(durationMonths / 12, 30);
  return elAnnual * durationYears;
}

// ── Sprint 4: Capital params & mirror mode ───────────────────────────────

/** Exposure class for CapitalEngine (M3) */
type ExposureClass = 'RETAIL_MORTGAGE' | 'RETAIL_OTHER' | 'CORPORATE' | 'SME' | 'SOVEREIGN';

/** Map Anejo IX segment to CapitalEngine exposure class */
function mapExposureClass(segment: AnejoSegment): ExposureClass {
  switch (segment) {
    case 'MORTGAGE_LOW_LTV':
    case 'MORTGAGE_HIGH_LTV':
      return 'RETAIL_MORTGAGE';
    case 'CONSUMER':
    case 'CREDIT_CARDS':
    case 'SELF_EMPLOYED':
      return 'RETAIL_OTHER';
    case 'LARGE_CORPORATE':
    case 'CONSTRUCTION':
    case 'CIVIL_WORKS':
    case 'SPECIALIZED':
    case 'OTHER':
      return 'CORPORATE';
    case 'SME':
      return 'SME';
    case 'PUBLIC_SECTOR':
      return 'SOVEREIGN';
  }
}

/**
 * CRR3 PD floors by exposure class.
 * Corporate/Sovereign/Bank: 3 bps, Retail: 5 bps, QRRE (credit cards): 10 bps.
 */
function getPdFloor(segment: AnejoSegment, exposureClass: ExposureClass): number {
  if (segment === 'CREDIT_CARDS') return 0.0010; // QRRE: 10 bps
  if (exposureClass === 'RETAIL_MORTGAGE' || exposureClass === 'RETAIL_OTHER') return 0.0005; // Retail: 5 bps
  return 0.0003; // Corporate, Sovereign, SME: 3 bps
}

/**
 * Supervisory F-IRB LGD values (when no external LGD provided).
 * Secured by real estate: 20%, financial collateral: 5%, unsecured: 40%.
 */
function getSupervisoryLgd(segment: AnejoSegment): number {
  switch (segment) {
    case 'MORTGAGE_LOW_LTV':
    case 'MORTGAGE_HIGH_LTV':
      return 0.20; // secured by real estate
    default:
      return 0.40; // unsecured corporate/retail/sovereign
  }
}

/**
 * Build capital params for CapitalEngine (M3) integration.
 * Derives PD, LGD, EAD, maturity, and exposure class.
 */
function buildCapitalParams(
  input: ForwardLookingInput,
  segment: AnejoSegment,
  coveragePct: number,
): CreditRiskResult['capitalParams'] {
  const exposureClass = mapExposureClass(segment);
  const mode = input.mode ?? 'native';

  // PD: use external if mirror, else derive from Anejo IX coverage as proxy
  let pd: number;
  if (mode === 'mirror' && input.externalPd12m != null) {
    pd = input.externalPd12m;
  } else {
    // Coverage-based proxy: stage1Coverage / 100
    pd = coveragePct / 100;
  }
  // Apply CRR3 PD floor
  const pdFloor = getPdFloor(segment, exposureClass);
  pd = Math.max(pd, pdFloor);

  // LGD: use external if mirror, else supervisory F-IRB values
  let lgd: number;
  if (mode === 'mirror' && input.externalLgd != null) {
    lgd = input.externalLgd;
  } else {
    lgd = getSupervisoryLgd(segment);
  }

  // EAD: use external if provided, else calculateEAD (handles off-balance sheet)
  const ead = input.externalEad ?? calculateEAD(input);

  const maturityYears = input.durationMonths / 12;

  return { pd, lgd, ead, maturityYears, exposureClass };
}

/**
 * Full credit risk calculation with forward-looking and migration.
 * Wraps calculateAnejoCreditRisk and adds Sprint 3 outputs.
 * Sprint 4: supports mirror mode (external PD/LGD) and produces capitalParams.
 * Sprint 5: integrates calculateEAD for off-balance sheet products.
 */
export function calculateFullCreditRisk(input: ForwardLookingInput): CreditRiskResult {
  const mode = input.mode ?? 'native';

  // Sprint 5: Calculate EAD for off-balance sheet products
  const ead = calculateEAD(input);
  const hasUndrawn = (input.undrawnAmount ?? 0) > 0;

  // 1. Base Anejo IX calculation (Sprint 1/2) — always run for segment & guarantee netting
  // If undrawn amount exists, re-run with EAD as the amount for proper netting/coverage
  const effectiveInput = hasUndrawn ? { ...input, amount: ead } : input;
  const baseResult = calculateAnejoCreditRisk(effectiveInput);

  // 2. Resolve scenarios
  const scenarios = input.scenarios ?? DEFAULT_MACRO_SCENARIOS;
  const segment = baseResult.anejoSegment as AnejoSegment;

  if (mode === 'mirror') {
    // ── Mirror mode: use external PD/LGD instead of Anejo IX coverage tables ──
    const externalPd = input.externalPd12m ?? 0;
    const externalLgd = input.externalLgd ?? 0;
    const ead = input.externalEad ?? input.amount;

    // Scenario-weighted PD adjustment: apply coverage adjustment factors to PD
    const scenarioWeightedPd = scenarios.reduce(
      (sum, s) => sum + s.weight * externalPd * s.coverageAdjustmentFactor,
      0,
    );

    // EL = PD × LGD × EAD
    const el12m = externalPd * externalLgd * ead;
    const day1Provision = scenarioWeightedPd * externalLgd * ead;

    // Migration cost (still uses Anejo IX segment probabilities)
    const { migrationCostAnnual, pMigrateS2, pMigrateS3 } = calculateMigrationCost(
      segment,
      baseResult.netExposure,
      scenarios,
    );

    const scenarioWeightedELAnnual = day1Provision + migrationCostAnnual;
    const elLifetime = calculateELLifetime(scenarioWeightedELAnnual, input.durationMonths);

    // Credit cost = (PD × LGD × 100) adjusted by scenarios
    const creditCostAnnualPct = ead > 0
      ? (scenarioWeightedELAnnual / ead) * 100
      : 0;

    // Scenario-weighted coverage equivalent (for reporting compatibility)
    const scenarioWeightedCoveragePct = calculateScenarioWeightedCoverage(
      baseResult.coveragePct,
      scenarios,
    );

    // Capital params
    const capitalParams = buildCapitalParams(input, segment, baseResult.coveragePct);

    return {
      ...baseResult,
      el12m,
      creditCostAnnualPct,
      day1Provision,
      elLifetime,
      migrationCostAnnual,
      pMigrateS2,
      pMigrateS3,
      scenarioWeightedCoveragePct,
      capitalParams,
      mode: 'mirror',
    };
  }

  // ── Native mode (default): existing Anejo IX logic ──

  // 3. Scenario-weighted coverage
  const scenarioWeightedCoveragePct = calculateScenarioWeightedCoverage(
    baseResult.coveragePct,
    scenarios,
  );

  // 4. Recalculate EL with scenario-weighted coverage (day 1 provision)
  const day1Provision = baseResult.netExposure * (scenarioWeightedCoveragePct / 100);

  // 5. Migration cost
  const { migrationCostAnnual, pMigrateS2, pMigrateS3 } = calculateMigrationCost(
    segment,
    baseResult.netExposure,
    scenarios,
  );

  // 6. Scenario-weighted annual EL (base EL adjusted by scenario + migration cost)
  const scenarioWeightedELAnnual = day1Provision + migrationCostAnnual;

  // 7. EL lifetime
  const elLifetime = calculateELLifetime(scenarioWeightedELAnnual, input.durationMonths);

  // 8. Update credit cost to use scenario-weighted coverage
  const creditCostAnnualPct = baseResult.grossExposure > 0
    ? (scenarioWeightedELAnnual / baseResult.grossExposure) * 100
    : 0;

  // 9. Capital params (Sprint 4)
  const capitalParams = buildCapitalParams(input, segment, baseResult.coveragePct);

  return {
    ...baseResult,
    coveragePct: baseResult.coveragePct, // preserve original Stage 1 coverage
    el12m: baseResult.el12m, // preserve original EL
    creditCostAnnualPct,
    day1Provision,
    elLifetime,
    migrationCostAnnual,
    pMigrateS2,
    pMigrateS3,
    scenarioWeightedCoveragePct,
    capitalParams,
    mode: 'native',
  };
}
