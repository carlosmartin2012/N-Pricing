/**
 * Anejo IX (Circular 4/2017, updated by Circular 6/2021)
 * Banco de España credit risk provisioning framework.
 * "Soluciones alternativas" — regulatory coverage percentages by segment and stage.
 */

export type AnejoSegment =
  | 'CONSTRUCTION'
  | 'CIVIL_WORKS'
  | 'LARGE_CORPORATE'
  | 'SME'
  | 'SELF_EMPLOYED'
  | 'MORTGAGE_LOW_LTV'
  | 'MORTGAGE_HIGH_LTV'
  | 'CONSUMER'
  | 'CREDIT_CARDS'
  | 'PUBLIC_SECTOR'
  | 'SPECIALIZED'
  | 'OTHER';

export interface AnejoSegmentDef {
  id: AnejoSegment;
  label: string;
  /** Stage 1 coverage (%) applied to net exposure */
  stage1Coverage: number;
  /** Stage 2 coverage (%) applied to net exposure */
  stage2Coverage: number;
}

/**
 * Coverage percentages per segment for Stage 1 and Stage 2.
 * Source: Circular 6/2021 (BOE-A-2021-21666), effective June 30, 2022.
 * Applied to gross book value not covered by effective guarantees.
 */
export const ANEJO_SEGMENTS: Record<AnejoSegment, AnejoSegmentDef> = {
  CONSTRUCTION:      { id: 'CONSTRUCTION',      label: 'Construcción y promoción',    stage1Coverage: 1.9,  stage2Coverage: 30.0 },
  CIVIL_WORKS:       { id: 'CIVIL_WORKS',       label: 'Obra civil',                 stage1Coverage: 2.0,  stage2Coverage: 18.8 },
  LARGE_CORPORATE:   { id: 'LARGE_CORPORATE',   label: 'Grandes empresas',           stage1Coverage: 0.6,  stage2Coverage: 15.0 },
  SME:               { id: 'SME',               label: 'PYMEs',                      stage1Coverage: 1.1,  stage2Coverage: 17.8 },
  SELF_EMPLOYED:     { id: 'SELF_EMPLOYED',      label: 'Empresarios individuales',   stage1Coverage: 1.4,  stage2Coverage: 16.0 },
  MORTGAGE_LOW_LTV:  { id: 'MORTGAGE_LOW_LTV',  label: 'Hipotecario (LTV ≤ 80%)',    stage1Coverage: 0.7,  stage2Coverage: 18.0 },
  MORTGAGE_HIGH_LTV: { id: 'MORTGAGE_HIGH_LTV', label: 'Hipotecario (LTV > 80%)',    stage1Coverage: 0.7,  stage2Coverage: 18.0 },
  CONSUMER:          { id: 'CONSUMER',           label: 'Crédito al consumo',         stage1Coverage: 1.8,  stage2Coverage: 20.2 },
  CREDIT_CARDS:      { id: 'CREDIT_CARDS',       label: 'Tarjetas de crédito',        stage1Coverage: 1.0,  stage2Coverage: 18.0 },
  PUBLIC_SECTOR:     { id: 'PUBLIC_SECTOR',      label: 'Sector público',             stage1Coverage: 0.0,  stage2Coverage: 3.0 },
  SPECIALIZED:       { id: 'SPECIALIZED',        label: 'Financiación especializada', stage1Coverage: 1.5,  stage2Coverage: 20.0 },
  OTHER:             { id: 'OTHER',              label: 'Otros',                      stage1Coverage: 1.1,  stage2Coverage: 17.0 },
};

/**
 * Stage 3 coverage (%) by aging in default, per segment.
 * Keys are the minimum months overdue. Applied to net exposure.
 * Source: Circular 6/2021 doubtful aging schedule.
 */
export const STAGE3_AGING_COVERAGE: Record<AnejoSegment, Record<number, number>> = {
  CONSTRUCTION:      { 3: 25, 6: 50, 9: 60, 12: 75, 18: 85, 24: 95 },
  CIVIL_WORKS:       { 3: 25, 6: 40, 9: 55, 12: 67, 18: 80, 24: 95 },
  LARGE_CORPORATE:   { 3: 25, 6: 35, 9: 50, 12: 60, 18: 75, 24: 90 },
  SME:               { 3: 25, 6: 40, 9: 55, 12: 67, 18: 80, 24: 95 },
  SELF_EMPLOYED:     { 3: 25, 6: 40, 9: 55, 12: 67, 18: 80, 24: 95 },
  MORTGAGE_LOW_LTV:  { 3: 25, 6: 35, 9: 45, 12: 55, 18: 75, 24: 95 },
  MORTGAGE_HIGH_LTV: { 3: 25, 6: 40, 9: 50, 12: 60, 18: 80, 24: 95 },
  CONSUMER:          { 3: 25, 6: 45, 9: 60, 12: 75, 18: 90, 24: 100 },
  CREDIT_CARDS:      { 3: 25, 6: 45, 9: 60, 12: 75, 18: 90, 24: 100 },
  PUBLIC_SECTOR:     { 3: 10, 6: 20, 9: 30, 12: 40, 18: 60, 24: 80 },
  SPECIALIZED:       { 3: 25, 6: 45, 9: 55, 12: 67, 18: 80, 24: 95 },
  OTHER:             { 3: 25, 6: 40, 9: 55, 12: 67, 18: 80, 24: 95 },
};

/**
 * Guarantee haircuts by property type (for mortgage collateral).
 * Applied to appraisal value before netting against exposure.
 */
export const GUARANTEE_HAIRCUTS: Record<string, number> = {
  RESIDENTIAL_FINISHED: 0.25,
  COMMERCIAL_OFFICE:    0.30,
  URBAN_LAND:           0.35,
  OTHER_PROPERTY:       0.40,
};

/** LTV threshold for favorable mortgage segment classification */
export const MORTGAGE_LTV_THRESHOLD = 0.80;

/**
 * Guarantee types recognized by Anejo IX.
 * Each type has different netting treatment.
 */
export type GuaranteeType = 'MORTGAGE' | 'FINANCIAL_PLEDGE' | 'PERSONAL_GUARANTEE' | 'PUBLIC_GUARANTEE' | 'NONE';

/**
 * Appraisal age discount factors for mortgage collateral.
 * Key = max months since last appraisal. Value = discount factor on appraisal value.
 * Beyond 36 months, requires retasación — apply HPI proxy (0.85 default).
 */
export const APPRAISAL_AGE_FACTORS: [number, number][] = [
  [12, 1.00],   // < 1 year: no discount
  [24, 0.95],   // 1-2 years: 5% discount
  [36, 0.90],   // 2-3 years: 10% discount
];
export const APPRAISAL_STALE_FACTOR = 0.85; // > 3 years: 15% discount (proxy for HPI decline)

/**
 * Financial pledge coverage — near-full deduction.
 * Deposits/securities pledged receive minimal haircut.
 */
export const FINANCIAL_PLEDGE_HAIRCUT = 0.02; // 2% haircut for cash/securities

/**
 * LTV cap for mortgage guarantee benefit.
 * The portion of exposure above this LTV gets no guarantee netting.
 */
export const MORTGAGE_LTV_CAP = 0.80; // residential
export const COMMERCIAL_LTV_CAP = 0.60; // commercial

// ── Sprint 3: Forward-looking & migration ──────────────────────────────────

/** Macroeconomic scenario for forward-looking adjustment */
export interface MacroScenario {
  id: string;
  label: string;
  weight: number; // 0-1, all scenarios should sum to 1
  /** Multiplicative factor applied to Stage 1 coverage (>1 = more conservative) */
  coverageAdjustmentFactor: number;
  /** Multiplicative factor on migration probability (>1 = more migrations expected) */
  migrationAdjustmentFactor: number;
}

/** Default scenarios for Spanish banking (configurable per entity) */
export const DEFAULT_MACRO_SCENARIOS: MacroScenario[] = [
  { id: 'base', label: 'Base', weight: 0.55, coverageAdjustmentFactor: 1.00, migrationAdjustmentFactor: 1.00 },
  { id: 'optimistic', label: 'Optimistic', weight: 0.20, coverageAdjustmentFactor: 0.85, migrationAdjustmentFactor: 0.75 },
  { id: 'pessimistic', label: 'Pessimistic', weight: 0.20, coverageAdjustmentFactor: 1.30, migrationAdjustmentFactor: 1.50 },
  { id: 'severe', label: 'Severe', weight: 0.05, coverageAdjustmentFactor: 1.80, migrationAdjustmentFactor: 2.50 },
];

/**
 * Average annual migration probabilities from Stage 1 → Stage 2 by segment.
 * Calibrated from Spanish banking system historical data (BdE statistical bulletin).
 * These are base scenario probabilities — adjusted by scenario factor.
 */
export const BASE_MIGRATION_PROB_S1_TO_S2: Record<AnejoSegment, number> = {
  CONSTRUCTION: 0.08,
  CIVIL_WORKS: 0.06,
  LARGE_CORPORATE: 0.03,
  SME: 0.05,
  SELF_EMPLOYED: 0.06,
  MORTGAGE_LOW_LTV: 0.02,
  MORTGAGE_HIGH_LTV: 0.04,
  CONSUMER: 0.06,
  CREDIT_CARDS: 0.05,
  PUBLIC_SECTOR: 0.01,
  SPECIALIZED: 0.04,
  OTHER: 0.05,
};

// ── Sprint 5: Credit Conversion Factors ──────────────────────────────────

/**
 * Credit Conversion Factors for off-balance sheet exposures (CRR3).
 * Applied to undrawn portion: EAD = drawn + CCF × undrawn
 */
export const CCF_TABLE: Record<string, number> = {
  /** Unconditionally cancellable commitments (phase-in to 10% by 2029) */
  UCC: 0.10,
  /** Other commitments (corporate credit lines) */
  OTHER_COMMITMENT: 0.40,
  /** Trade finance (short-term, self-liquidating) */
  TRADE_FINANCE: 0.20,
  /** Note issuance facilities / revolving underwriting */
  NIF_RUF: 0.50,
  /** Direct credit substitutes (guarantees, standby LCs) */
  DIRECT_SUBSTITUTE: 1.00,
  /** Performance bonds */
  PERFORMANCE_BOND: 0.50,
};

/** Annual probability of Stage 2 → Stage 3 (conditional on being in Stage 2) */
export const BASE_MIGRATION_PROB_S2_TO_S3: Record<AnejoSegment, number> = {
  CONSTRUCTION: 0.30,
  CIVIL_WORKS: 0.25,
  LARGE_CORPORATE: 0.20,
  SME: 0.25,
  SELF_EMPLOYED: 0.28,
  MORTGAGE_LOW_LTV: 0.15,
  MORTGAGE_HIGH_LTV: 0.20,
  CONSUMER: 0.30,
  CREDIT_CARDS: 0.35,
  PUBLIC_SECTOR: 0.10,
  SPECIALIZED: 0.22,
  OTHER: 0.25,
};
