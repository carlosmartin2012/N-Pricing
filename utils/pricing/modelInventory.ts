/**
 * Model Inventory & MRM (Model Risk Management) — spec §M10
 *
 * Aligned with ECB TRIM guide, BoE SS1/23, BdE model management guide.
 * Provides:
 *   - Model registration with full metadata
 *   - Versioning with effective dates
 *   - Backtesting framework (PD, LGD, behavioral models, bonuses)
 *   - Validation status tracking
 *   - Auto-generated documentation hooks
 */

export type ModelCategory =
  | 'PD' //                  Probability of Default
  | 'LGD' //                 Loss Given Default
  | 'EAD' //                 Exposure at Default
  | 'NMD_BETA' //            Non-maturing deposit beta
  | 'NMD_REPLICATION' //     NMD replicating portfolio
  | 'PREPAYMENT' //          CPR / prepayment model
  | 'CROSS_BONUSES' //       Cross-bonus fulfillment probability
  | 'BEHAVIORAL' //          Other behavioral models
  | 'FTP_CURVE' //           Curve construction (NSS, bootstrap)
  | 'STRESS_SCENARIO' //     Macro stress scenarios
  | 'OTHER';

export type ModelStatus =
  | 'DRAFT'
  | 'INTERNAL_VALIDATION'
  | 'APPROVED'
  | 'PRODUCTION'
  | 'DEPRECATED'
  | 'RETIRED';

export type ValidationFrequency =
  | 'ANNUAL'
  | 'SEMI_ANNUAL'
  | 'QUARTERLY'
  | 'MONTHLY'
  | 'AD_HOC';

export interface ModelMetadata {
  /** Unique model identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Model category per BdE/TRIM taxonomy */
  category: ModelCategory;
  /** Current lifecycle status */
  status: ModelStatus;
  /** Semantic version (e.g. "1.2.3") */
  version: string;
  /** Owner team or individual */
  owner: string;
  /** Methodology reference (doc URL or spec) */
  methodologyRef?: string;
  /** Description of scope and limitations */
  description: string;
  /** Date when this version entered production (ISO) */
  effectiveFrom: string;
  /** Date when this version was superseded (ISO), null if current */
  effectiveTo: string | null;
  /** Next scheduled validation date (ISO) */
  nextValidationDate: string;
  /** Frequency of required validation */
  validationFrequency: ValidationFrequency;
  /** Last validation result */
  lastValidation?: ModelValidationRecord;
  /** Segments this model applies to */
  applicableSegments?: string[];
  /** Data sources used */
  dataSources?: string[];
  /** Known limitations (disclosed to supervisor) */
  limitations?: string[];
  /** Regulatory references (CRR3 article, EBA GL, etc.) */
  regulatoryRefs?: string[];
}

export interface ModelValidationRecord {
  validationDate: string;
  validator: string;
  status: 'PASSED' | 'PASSED_WITH_OBSERVATIONS' | 'FAILED';
  findings: string[];
  /** Links to validation documents */
  documentRefs?: string[];
}

/**
 * Backtesting input for a PD/LGD/bonus model.
 * Each entry is one prediction + actual outcome.
 */
export interface BacktestObservation {
  /** Observation date */
  date: string;
  /** Model's prediction (e.g., PD = 0.02, LGD = 0.45, beta = 0.5) */
  predicted: number;
  /** Actual realized value (0 or 1 for default events, continuous for LGD) */
  actual: number;
  /** Optional segment / bucket */
  segment?: string;
}

export interface BacktestResult {
  modelId: string;
  category: ModelCategory;
  observations: number;
  /** Mean absolute error */
  mae: number;
  /** Root mean squared error */
  rmse: number;
  /** Mean bias (predicted - actual) */
  bias: number;
  /** Hosmer-Lemeshow style goodness-of-fit p-value (approximate) */
  gofPValue?: number;
  /** Hit rate for binary (PD) models: % correct predictions at 0.5 threshold */
  hitRate?: number;
  /** Traffic light status */
  trafficLight: 'GREEN' | 'AMBER' | 'RED';
  /** Findings narrative */
  findings: string[];
}

/**
 * Backtest a PD model: predicted PD vs actual default indicator (0/1).
 * Metrics:
 *   - Mean bias: positive means overestimating PD (conservative)
 *   - MAE, RMSE
 *   - Hit rate (threshold 0.5)
 *   - Traffic light: GREEN if bias within ±0.01, AMBER ±0.03, RED beyond
 */
export function backtestPDModel(
  modelId: string,
  observations: BacktestObservation[],
): BacktestResult {
  if (observations.length === 0) {
    return {
      modelId,
      category: 'PD',
      observations: 0,
      mae: 0,
      rmse: 0,
      bias: 0,
      trafficLight: 'GREEN',
      findings: ['No observations'],
    };
  }

  const n = observations.length;
  let sumError = 0;
  let sumAbsError = 0;
  let sumSqError = 0;
  let hits = 0;

  for (const obs of observations) {
    const err = obs.predicted - obs.actual;
    sumError += err;
    sumAbsError += Math.abs(err);
    sumSqError += err * err;

    // Hit rate: predicted > 0.5 → predicted default; actual = 1 → default
    const predictedDefault = obs.predicted >= 0.5;
    const actualDefault = obs.actual >= 0.5;
    if (predictedDefault === actualDefault) hits++;
  }

  const bias = sumError / n;
  const mae = sumAbsError / n;
  const rmse = Math.sqrt(sumSqError / n);
  const hitRate = hits / n;

  let trafficLight: 'GREEN' | 'AMBER' | 'RED';
  const absBias = Math.abs(bias);
  if (absBias <= 0.01) trafficLight = 'GREEN';
  else if (absBias <= 0.03) trafficLight = 'AMBER';
  else trafficLight = 'RED';

  const findings: string[] = [];
  if (bias > 0.03)
    findings.push(
      `Overestimating PD by ${(bias * 100).toFixed(2)}pp — too conservative`,
    );
  if (bias < -0.03)
    findings.push(
      `Underestimating PD by ${(Math.abs(bias) * 100).toFixed(2)}pp — risk of under-provisioning`,
    );
  if (hitRate < 0.5)
    findings.push(
      `Hit rate ${(hitRate * 100).toFixed(1)}% below random benchmark`,
    );
  if (findings.length === 0) findings.push('Within tolerance');

  return {
    modelId,
    category: 'PD',
    observations: n,
    mae,
    rmse,
    bias,
    hitRate,
    trafficLight,
    findings,
  };
}

/**
 * Backtest an LGD model: predicted LGD vs realized loss rate.
 * Metrics: bias, MAE, RMSE. Traffic light based on bias magnitude.
 */
export function backtestLGDModel(
  modelId: string,
  observations: BacktestObservation[],
): BacktestResult {
  const n = observations.length;
  if (n === 0) {
    return {
      modelId,
      category: 'LGD',
      observations: 0,
      mae: 0,
      rmse: 0,
      bias: 0,
      trafficLight: 'GREEN',
      findings: ['No observations'],
    };
  }

  let sumError = 0;
  let sumAbsError = 0;
  let sumSqError = 0;

  for (const obs of observations) {
    const err = obs.predicted - obs.actual;
    sumError += err;
    sumAbsError += Math.abs(err);
    sumSqError += err * err;
  }

  const bias = sumError / n;
  const mae = sumAbsError / n;
  const rmse = Math.sqrt(sumSqError / n);

  let trafficLight: 'GREEN' | 'AMBER' | 'RED';
  const absBias = Math.abs(bias);
  if (absBias <= 0.05) trafficLight = 'GREEN';
  else if (absBias <= 0.1) trafficLight = 'AMBER';
  else trafficLight = 'RED';

  const findings: string[] = [];
  if (bias > 0.1)
    findings.push(
      `Overestimating LGD by ${(bias * 100).toFixed(1)}pp — overly conservative`,
    );
  if (bias < -0.1)
    findings.push(
      `Underestimating LGD by ${(Math.abs(bias) * 100).toFixed(1)}pp — risk of under-provisioning`,
    );
  if (rmse > 0.25)
    findings.push(
      `RMSE ${(rmse * 100).toFixed(1)}pp is high — model precision concerns`,
    );
  if (findings.length === 0) findings.push('Within tolerance');

  return {
    modelId,
    category: 'LGD',
    observations: n,
    mae,
    rmse,
    bias,
    trafficLight,
    findings,
  };
}

/**
 * Backtest a behavioral or bonus fulfillment model.
 * Generic: treats actual as the observed fulfillment rate (0-1).
 */
export function backtestBehavioralModel(
  modelId: string,
  category: ModelCategory,
  observations: BacktestObservation[],
): BacktestResult {
  const n = observations.length;
  if (n === 0) {
    return {
      modelId,
      category,
      observations: 0,
      mae: 0,
      rmse: 0,
      bias: 0,
      trafficLight: 'GREEN',
      findings: ['No observations'],
    };
  }

  let sumError = 0;
  let sumAbsError = 0;
  let sumSqError = 0;

  for (const obs of observations) {
    const err = obs.predicted - obs.actual;
    sumError += err;
    sumAbsError += Math.abs(err);
    sumSqError += err * err;
  }

  const bias = sumError / n;
  const mae = sumAbsError / n;
  const rmse = Math.sqrt(sumSqError / n);

  let trafficLight: 'GREEN' | 'AMBER' | 'RED';
  const absBias = Math.abs(bias);
  if (absBias <= 0.05) trafficLight = 'GREEN';
  else if (absBias <= 0.1) trafficLight = 'AMBER';
  else trafficLight = 'RED';

  const findings: string[] = [];
  if (mae > 0.15) findings.push(`MAE ${(mae * 100).toFixed(1)}pp — poor fit`);
  if (findings.length === 0) findings.push('Within tolerance');

  return {
    modelId,
    category,
    observations: n,
    mae,
    rmse,
    bias,
    trafficLight,
    findings,
  };
}

/**
 * Generate a validation report summary for a model.
 * Used by the auto-documentation layer.
 */
export function buildValidationReport(
  metadata: ModelMetadata,
  backtestResults: BacktestResult[],
): {
  modelId: string;
  modelName: string;
  status: ModelStatus;
  summary: string;
  overallTrafficLight: 'GREEN' | 'AMBER' | 'RED';
  recommendations: string[];
} {
  const lights = backtestResults.map((r) => r.trafficLight);
  const overallTrafficLight: 'GREEN' | 'AMBER' | 'RED' = lights.includes('RED')
    ? 'RED'
    : lights.includes('AMBER')
      ? 'AMBER'
      : 'GREEN';

  const recommendations: string[] = [];
  if (overallTrafficLight === 'RED') {
    recommendations.push('Immediate model review required');
    recommendations.push('Escalate to model risk committee');
  } else if (overallTrafficLight === 'AMBER') {
    recommendations.push('Schedule ad-hoc review within 30 days');
    recommendations.push('Increase monitoring frequency');
  }

  const nextValidation = new Date(metadata.nextValidationDate);
  const now = new Date();
  if (nextValidation < now) {
    recommendations.push('Validation overdue — schedule immediately');
  }

  const summary =
    `Model ${metadata.name} v${metadata.version} (${metadata.category}). ` +
    `Status: ${metadata.status}. Owner: ${metadata.owner}. ` +
    `${backtestResults.length} backtest(s) run. Overall: ${overallTrafficLight}.`;

  return {
    modelId: metadata.id,
    modelName: metadata.name,
    status: metadata.status,
    summary,
    overallTrafficLight,
    recommendations,
  };
}
