/**
 * Price elasticity & demand forecasting — spec §M11
 *
 * Simplified ML approach without external dependencies:
 *   - Log-linear elasticity model: demand = a × rate^(-ε)
 *   - Segment-level calibration by (product × segment × amount × tenor) bucket
 *   - Uplift modelling: treatment vs control group comparison
 *   - Price response curve for what-if analysis
 *
 * For production use with real gradient boosting, integrate with an
 * external inference service (SageMaker, Vertex AI) via a proxy endpoint.
 */

export interface HistoricalDemandObservation {
  /** Observation date (ISO) */
  date: string;
  /** Segment identifiers */
  productType: string;
  clientType: string;
  /** Bucketed features */
  amountBucket: 'SMALL' | 'MEDIUM' | 'LARGE' | 'JUMBO';
  tenorBucket: 'ST' | 'MT' | 'LT';
  /** Price offered (final client rate, %) */
  offeredRate: number;
  /** Observed demand: 1 if deal booked, 0 if rejected/walked */
  converted: number;
  /** Deal amount if converted */
  amount?: number;
  /** Treatment flag for uplift experiments (optional) */
  treatment?: boolean;
}

export interface ElasticityModel {
  segmentKey: string;
  /** Log-linear elasticity coefficient — higher ε = more price-sensitive */
  elasticity: number;
  /** Baseline conversion rate at anchor price */
  baselineConversion: number;
  /** Anchor price used for baseline */
  anchorRate: number;
  /** Number of observations used to fit */
  sampleSize: number;
  /** Confidence: proxy via sample size */
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
}

/** Build a stable segment key from features */
export function buildSegmentKey(
  productType: string,
  clientType: string,
  amountBucket: string,
  tenorBucket: string,
): string {
  return `${productType}|${clientType}|${amountBucket}|${tenorBucket}`;
}

/**
 * Bucket an amount into size categories.
 */
export function bucketAmount(amount: number): 'SMALL' | 'MEDIUM' | 'LARGE' | 'JUMBO' {
  if (amount < 100_000) return 'SMALL';
  if (amount < 1_000_000) return 'MEDIUM';
  if (amount < 10_000_000) return 'LARGE';
  return 'JUMBO';
}

/**
 * Bucket a tenor in months.
 */
export function bucketTenor(months: number): 'ST' | 'MT' | 'LT' {
  if (months <= 12) return 'ST';
  if (months <= 60) return 'MT';
  return 'LT';
}

/**
 * Fit a log-linear elasticity model to a set of observations.
 *
 * Model: log(conversion_rate) = log(a) - ε × log(rate)
 *
 * We bin observations by rate (price) and compute the conversion rate
 * in each bin, then fit the log-log linear regression.
 *
 * Uses simple OLS (no gradient descent, no dependencies).
 */
export function fitElasticityModel(
  observations: HistoricalDemandObservation[],
  segmentKey: string,
): ElasticityModel | null {
  if (observations.length < 10) {
    // Insufficient data for reliable fit
    if (observations.length === 0) return null;

    // Fallback: simple average conversion rate with zero elasticity
    const convRate = observations.reduce((s, o) => s + o.converted, 0) / observations.length;
    const avgRate = observations.reduce((s, o) => s + o.offeredRate, 0) / observations.length;
    return {
      segmentKey,
      elasticity: 0,
      baselineConversion: convRate,
      anchorRate: avgRate,
      sampleSize: observations.length,
      confidence: 'LOW',
    };
  }

  // Bin observations by price (rate) into 10 quantile buckets
  const sorted = [...observations].sort((a, b) => a.offeredRate - b.offeredRate);
  const numBins = Math.min(10, Math.max(3, Math.floor(sorted.length / 5)));
  const binSize = Math.floor(sorted.length / numBins);

  const bins: Array<{ avgRate: number; convRate: number; n: number }> = [];
  for (let i = 0; i < numBins; i++) {
    const start = i * binSize;
    const end = i === numBins - 1 ? sorted.length : (i + 1) * binSize;
    const slice = sorted.slice(start, end);
    if (slice.length === 0) continue;
    const avgRate = slice.reduce((s, o) => s + o.offeredRate, 0) / slice.length;
    const conv = slice.reduce((s, o) => s + o.converted, 0) / slice.length;
    if (avgRate > 0 && conv > 0) {
      // Only include bins with positive conversion for log transform
      bins.push({ avgRate, convRate: conv, n: slice.length });
    }
  }

  if (bins.length < 3) {
    // Not enough valid bins — fall back to average
    const convRate = observations.reduce((s, o) => s + o.converted, 0) / observations.length;
    const avgRate = observations.reduce((s, o) => s + o.offeredRate, 0) / observations.length;
    return {
      segmentKey,
      elasticity: 0,
      baselineConversion: convRate,
      anchorRate: avgRate,
      sampleSize: observations.length,
      confidence: 'LOW',
    };
  }

  // OLS on (log(rate), log(convRate))
  // y = β₀ + β₁ × x where β₁ = -ε
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0;
  for (const bin of bins) {
    const x = Math.log(bin.avgRate);
    const y = Math.log(bin.convRate);
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const n = bins.length;
  const meanX = sumX / n;
  const meanY = sumY / n;
  const denom = sumXX - n * meanX * meanX;
  // Guard against a near-singular regression (all bins at ~same log(rate)).
  // Returning a LOW-confidence zero-elasticity model is safer than emitting NaN/Infinity
  // into downstream pricing calculations.
  if (!Number.isFinite(denom) || Math.abs(denom) < 1e-12) {
    const convRate = observations.reduce((s, o) => s + o.converted, 0) / observations.length;
    const avgRate = observations.reduce((s, o) => s + o.offeredRate, 0) / observations.length;
    return {
      segmentKey,
      elasticity: 0,
      baselineConversion: convRate,
      anchorRate: avgRate,
      sampleSize: observations.length,
      confidence: 'LOW',
    };
  }
  const slope = (sumXY - n * meanX * meanY) / denom;
  const intercept = meanY - slope * meanX;

  const elasticity = -slope; // ε = -β₁
  const anchorRate = bins[Math.floor(bins.length / 2)].avgRate;
  const baselineConversion = Math.exp(intercept) * Math.pow(anchorRate, slope);
  if (!Number.isFinite(elasticity) || !Number.isFinite(baselineConversion)) {
    const convRate = observations.reduce((s, o) => s + o.converted, 0) / observations.length;
    const avgRate = observations.reduce((s, o) => s + o.offeredRate, 0) / observations.length;
    return {
      segmentKey,
      elasticity: 0,
      baselineConversion: convRate,
      anchorRate: avgRate,
      sampleSize: observations.length,
      confidence: 'LOW',
    };
  }

  let confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  if (observations.length >= 500) confidence = 'HIGH';
  else if (observations.length >= 100) confidence = 'MEDIUM';
  else confidence = 'LOW';

  return {
    segmentKey,
    elasticity,
    baselineConversion,
    anchorRate,
    sampleSize: observations.length,
    confidence,
  };
}

/**
 * Fit elasticity models for every segment present in the observations.
 */
export function fitSegmentedModels(
  observations: HistoricalDemandObservation[],
): Map<string, ElasticityModel> {
  const bySegment = new Map<string, HistoricalDemandObservation[]>();
  for (const obs of observations) {
    const key = buildSegmentKey(
      obs.productType,
      obs.clientType,
      obs.amountBucket,
      obs.tenorBucket,
    );
    const list = bySegment.get(key) ?? [];
    list.push(obs);
    bySegment.set(key, list);
  }

  const models = new Map<string, ElasticityModel>();
  for (const [key, obs] of bySegment.entries()) {
    const model = fitElasticityModel(obs, key);
    if (model) models.set(key, model);
  }

  return models;
}

/**
 * Predict the expected conversion probability at a given price.
 * Uses: conv(rate) = baseline × (rate / anchorRate)^(-ε)
 */
export function predictConversion(model: ElasticityModel, rate: number): number {
  if (rate <= 0 || model.anchorRate <= 0) return model.baselineConversion;
  const ratio = rate / model.anchorRate;
  const prediction = model.baselineConversion * Math.pow(ratio, -model.elasticity);
  return Math.min(1, Math.max(0, prediction));
}

/**
 * Generate a full price-response curve for what-if analysis.
 * Returns conversion predictions at a range of rate offsets around the current rate.
 */
export interface PriceResponsePoint {
  rate: number;
  conversion: number;
  expectedVolume: number; // conversion × baseVolume
  expectedRevenue: number; // rate × expectedVolume
}

export function buildPriceResponseCurve(
  model: ElasticityModel,
  currentRate: number,
  baseVolume: number,
  minRate: number = currentRate * 0.5,
  maxRate: number = currentRate * 1.5,
  points: number = 20,
): PriceResponsePoint[] {
  // Clamp callers to a minimum of 2 points and defend against minRate > maxRate
  // so the curve is always monotonic and reduce()/max searches always have data.
  const safePoints = Math.max(2, Math.floor(points));
  const lo = Math.min(minRate, maxRate);
  const hi = Math.max(minRate, maxRate);
  const curve: PriceResponsePoint[] = [];
  const step = (hi - lo) / (safePoints - 1);
  for (let i = 0; i < safePoints; i++) {
    const rate = lo + i * step;
    const conversion = predictConversion(model, rate);
    const expectedVolume = baseVolume * conversion;
    const expectedRevenue = rate * expectedVolume;
    curve.push({ rate, conversion, expectedVolume, expectedRevenue });
  }
  return curve;
}

/**
 * Find the revenue-maximizing price (simple grid search on the price response curve).
 */
export function findOptimalPrice(
  model: ElasticityModel,
  currentRate: number,
  baseVolume: number,
  minRate?: number,
  maxRate?: number,
): { rate: number; expectedRevenue: number; conversion: number; upliftVsCurrent: number } {
  const curve = buildPriceResponseCurve(model, currentRate, baseVolume, minRate, maxRate, 50);
  const best = curve.reduce((a, b) => (b.expectedRevenue > a.expectedRevenue ? b : a));
  const currentPoint = {
    rate: currentRate,
    conversion: predictConversion(model, currentRate),
    expectedRevenue: currentRate * baseVolume * predictConversion(model, currentRate),
  };

  return {
    rate: best.rate,
    expectedRevenue: best.expectedRevenue,
    conversion: best.conversion,
    upliftVsCurrent: best.expectedRevenue - currentPoint.expectedRevenue,
  };
}

/**
 * Uplift modelling: compare treatment vs control groups.
 *
 * Returns the incremental conversion rate attributable to the treatment
 * (e.g., a promotional discount).
 */
export interface UpliftResult {
  treatmentSize: number;
  controlSize: number;
  treatmentConversion: number;
  controlConversion: number;
  /** Incremental lift: treatment - control */
  upliftPct: number;
  /** Relative lift: (treatment - control) / control */
  relativeUplift: number;
  /** Simple z-test p-value approximation */
  significance: 'SIGNIFICANT' | 'NOT_SIGNIFICANT';
}

export function estimateUplift(
  observations: HistoricalDemandObservation[],
): UpliftResult | null {
  const treatment = observations.filter((o) => o.treatment === true);
  const control = observations.filter((o) => o.treatment === false);

  if (treatment.length === 0 || control.length === 0) return null;

  const treatmentConv = treatment.reduce((s, o) => s + o.converted, 0) / treatment.length;
  const controlConv = control.reduce((s, o) => s + o.converted, 0) / control.length;

  const upliftPct = treatmentConv - controlConv;
  const relativeUplift = controlConv > 0 ? upliftPct / controlConv : 0;

  // Z-test for proportions (approximate)
  const pooledP =
    (treatment.reduce((s, o) => s + o.converted, 0) +
      control.reduce((s, o) => s + o.converted, 0)) /
    (treatment.length + control.length);
  const se = Math.sqrt(
    pooledP * (1 - pooledP) * (1 / treatment.length + 1 / control.length),
  );
  const z = se > 0 ? upliftPct / se : 0;
  const significance: 'SIGNIFICANT' | 'NOT_SIGNIFICANT' =
    Math.abs(z) > 1.96 ? 'SIGNIFICANT' : 'NOT_SIGNIFICANT';

  return {
    treatmentSize: treatment.length,
    controlSize: control.length,
    treatmentConversion: treatmentConv,
    controlConversion: controlConv,
    upliftPct,
    relativeUplift,
    significance,
  };
}
