import { describe, it, expect } from 'vitest';
import {
  bucketAmount,
  bucketTenor,
  buildSegmentKey,
  fitElasticityModel,
  fitSegmentedModels,
  predictConversion,
  buildPriceResponseCurve,
  findOptimalPrice,
  estimateUplift,
  type HistoricalDemandObservation,
  type ElasticityModel,
} from '../pricing/priceElasticity';

// ---------------------------------------------------------------------------
// Deterministic pseudo-random generator (so tests are reproducible)
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate synthetic observations with a known true elasticity.
 * True model: P(convert | rate) = baseline * (rate / anchor)^(-elasticity)
 */
function generateObservations(
  n: number,
  opts: {
    trueElasticity?: number;
    baseline?: number;
    anchor?: number;
    productType?: string;
    clientType?: string;
    amountBucket?: 'SMALL' | 'MEDIUM' | 'LARGE' | 'JUMBO';
    tenorBucket?: 'ST' | 'MT' | 'LT';
    seed?: number;
    treatmentBoost?: number;
  } = {},
): HistoricalDemandObservation[] {
  const {
    trueElasticity = 2.0,
    baseline = 0.5,
    anchor = 5.0,
    productType = 'LOAN',
    clientType = 'SME',
    amountBucket = 'MEDIUM',
    tenorBucket = 'MT',
    seed = 42,
    treatmentBoost = 0,
  } = opts;

  const rand = mulberry32(seed);
  const obs: HistoricalDemandObservation[] = [];

  for (let i = 0; i < n; i++) {
    // Sample a rate from [anchor*0.6, anchor*1.6]
    const rate = anchor * (0.6 + rand() * 1.0);
    // True conversion probability
    const ratio = rate / anchor;
    let p = baseline * Math.pow(ratio, -trueElasticity);
    p = Math.min(1, Math.max(0, p));

    // Treatment group gets a boost
    const isTreatment = i % 2 === 0;
    if (isTreatment) p = Math.min(1, p + treatmentBoost);

    const converted = rand() < p ? 1 : 0;

    obs.push({
      date: '2025-01-01',
      productType,
      clientType,
      amountBucket,
      tenorBucket,
      offeredRate: rate,
      converted,
      treatment: isTreatment,
    });
  }
  return obs;
}

// ---------------------------------------------------------------------------
// Bucketing helpers
// ---------------------------------------------------------------------------

describe('bucketAmount', () => {
  it('buckets by amount boundaries', () => {
    expect(bucketAmount(0)).toBe('SMALL');
    expect(bucketAmount(99_999)).toBe('SMALL');
    expect(bucketAmount(100_000)).toBe('MEDIUM');
    expect(bucketAmount(999_999)).toBe('MEDIUM');
    expect(bucketAmount(1_000_000)).toBe('LARGE');
    expect(bucketAmount(9_999_999)).toBe('LARGE');
    expect(bucketAmount(10_000_000)).toBe('JUMBO');
    expect(bucketAmount(50_000_000)).toBe('JUMBO');
  });
});

describe('bucketTenor', () => {
  it('buckets by tenor boundaries (months)', () => {
    expect(bucketTenor(1)).toBe('ST');
    expect(bucketTenor(12)).toBe('ST');
    expect(bucketTenor(13)).toBe('MT');
    expect(bucketTenor(60)).toBe('MT');
    expect(bucketTenor(61)).toBe('LT');
    expect(bucketTenor(120)).toBe('LT');
  });
});

describe('buildSegmentKey', () => {
  it('produces stable pipe-delimited keys', () => {
    expect(buildSegmentKey('LOAN', 'SME', 'MEDIUM', 'MT')).toBe('LOAN|SME|MEDIUM|MT');
    // Same inputs → same key
    const a = buildSegmentKey('DEPOSIT', 'CORP', 'LARGE', 'LT');
    const b = buildSegmentKey('DEPOSIT', 'CORP', 'LARGE', 'LT');
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Model fitting
// ---------------------------------------------------------------------------

describe('fitElasticityModel', () => {
  it('returns null for zero observations', () => {
    const model = fitElasticityModel([], 'EMPTY|SEG|X|Y');
    expect(model).toBeNull();
  });

  it('returns LOW-confidence fallback for fewer than 10 observations', () => {
    const obs = generateObservations(5, { seed: 1 });
    const model = fitElasticityModel(obs, 'TINY');
    expect(model).not.toBeNull();
    expect(model!.confidence).toBe('LOW');
    expect(model!.elasticity).toBe(0);
    expect(model!.sampleSize).toBe(5);
  });

  it('returns MEDIUM confidence for 100-499 observations', () => {
    const obs = generateObservations(200, { seed: 2 });
    const model = fitElasticityModel(obs, 'MED');
    expect(model).not.toBeNull();
    expect(model!.confidence).toBe('MEDIUM');
  });

  it('returns HIGH confidence for >= 500 observations', () => {
    const obs = generateObservations(600, { seed: 3 });
    const model = fitElasticityModel(obs, 'HI');
    expect(model).not.toBeNull();
    expect(model!.confidence).toBe('HIGH');
  });

  it('recovers the sign of the true elasticity (positive ε)', () => {
    // With a large enough sample and a clear negative slope, fitted elasticity > 0
    const obs = generateObservations(1000, {
      trueElasticity: 2.0,
      baseline: 0.6,
      anchor: 5.0,
      seed: 7,
    });
    const model = fitElasticityModel(obs, 'SIGN');
    expect(model).not.toBeNull();
    expect(model!.elasticity).toBeGreaterThan(0);
  });
});

describe('fitSegmentedModels', () => {
  it('groups observations by segment key', () => {
    const segA = generateObservations(100, {
      productType: 'LOAN',
      clientType: 'SME',
      amountBucket: 'MEDIUM',
      tenorBucket: 'MT',
      seed: 10,
    });
    const segB = generateObservations(100, {
      productType: 'DEPOSIT',
      clientType: 'CORP',
      amountBucket: 'LARGE',
      tenorBucket: 'LT',
      seed: 11,
    });
    const all = [...segA, ...segB];
    const models = fitSegmentedModels(all);
    expect(models.size).toBe(2);
    expect(models.has('LOAN|SME|MEDIUM|MT')).toBe(true);
    expect(models.has('DEPOSIT|CORP|LARGE|LT')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Prediction
// ---------------------------------------------------------------------------

describe('predictConversion', () => {
  const model: ElasticityModel = {
    segmentKey: 'TEST',
    elasticity: 2.0,
    baselineConversion: 0.5,
    anchorRate: 5.0,
    sampleSize: 1000,
    confidence: 'HIGH',
  };

  it('returns baseline at anchor rate', () => {
    expect(predictConversion(model, 5.0)).toBeCloseTo(0.5, 6);
  });

  it('predicts lower conversion at higher rates (positive elasticity)', () => {
    const low = predictConversion(model, 4.0);
    const mid = predictConversion(model, 5.0);
    const high = predictConversion(model, 6.5);
    expect(low).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(high);
  });

  it('clamps predictions to [0, 1]', () => {
    // Very low rate would blow up the prediction; must clamp to 1
    expect(predictConversion(model, 0.01)).toBeLessThanOrEqual(1);
    expect(predictConversion(model, 0.01)).toBeGreaterThanOrEqual(0);
    // Very high rate should clamp to >= 0
    expect(predictConversion(model, 10_000)).toBeGreaterThanOrEqual(0);
  });

  it('returns baseline for non-positive rate input', () => {
    expect(predictConversion(model, 0)).toBe(0.5);
    expect(predictConversion(model, -1)).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// Price response curve
// ---------------------------------------------------------------------------

describe('buildPriceResponseCurve', () => {
  const model: ElasticityModel = {
    segmentKey: 'CURVE',
    elasticity: 1.5,
    baselineConversion: 0.4,
    anchorRate: 5.0,
    sampleSize: 1000,
    confidence: 'HIGH',
  };

  it('returns the requested number of points', () => {
    const curve = buildPriceResponseCurve(model, 5.0, 1_000_000, undefined, undefined, 25);
    expect(curve.length).toBe(25);
  });

  it('conversion is monotonically non-increasing with rate', () => {
    const curve = buildPriceResponseCurve(model, 5.0, 1_000_000, 3, 8, 20);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i].conversion).toBeLessThanOrEqual(curve[i - 1].conversion + 1e-9);
    }
  });

  it('computes expected volume and revenue consistently', () => {
    const curve = buildPriceResponseCurve(model, 5.0, 1_000_000, 4, 6, 5);
    for (const point of curve) {
      expect(point.expectedVolume).toBeCloseTo(1_000_000 * point.conversion, 6);
      expect(point.expectedRevenue).toBeCloseTo(point.rate * point.expectedVolume, 6);
    }
  });
});

// ---------------------------------------------------------------------------
// Optimal price
// ---------------------------------------------------------------------------

describe('findOptimalPrice', () => {
  it('returns the max-revenue point from the curve', () => {
    const model: ElasticityModel = {
      segmentKey: 'OPT',
      elasticity: 1.5,
      baselineConversion: 0.4,
      anchorRate: 5.0,
      sampleSize: 1000,
      confidence: 'HIGH',
    };
    const result = findOptimalPrice(model, 5.0, 1_000_000, 3, 8);
    // Brute check: sample the same range and confirm no point beats it
    const curve = buildPriceResponseCurve(model, 5.0, 1_000_000, 3, 8, 50);
    const maxRev = curve.reduce((m, p) => Math.max(m, p.expectedRevenue), 0);
    expect(result.expectedRevenue).toBeCloseTo(maxRev, 6);
  });

  it('returns non-negative uplift when current rate is suboptimal', () => {
    const model: ElasticityModel = {
      segmentKey: 'OPT2',
      elasticity: 1.2,
      baselineConversion: 0.5,
      anchorRate: 5.0,
      sampleSize: 1000,
      confidence: 'HIGH',
    };
    // Current rate is arbitrarily chosen below anchor; optimizer scans the range
    const result = findOptimalPrice(model, 3.5, 1_000_000, 2, 8);
    expect(result.upliftVsCurrent).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Uplift modelling
// ---------------------------------------------------------------------------

describe('estimateUplift', () => {
  it('returns null when there is no treatment group', () => {
    const obs: HistoricalDemandObservation[] = [
      {
        date: '2025-01-01',
        productType: 'LOAN',
        clientType: 'SME',
        amountBucket: 'MEDIUM',
        tenorBucket: 'MT',
        offeredRate: 5,
        converted: 1,
        treatment: false,
      },
      {
        date: '2025-01-02',
        productType: 'LOAN',
        clientType: 'SME',
        amountBucket: 'MEDIUM',
        tenorBucket: 'MT',
        offeredRate: 5,
        converted: 0,
        treatment: false,
      },
    ];
    expect(estimateUplift(obs)).toBeNull();
  });

  it('returns null when there is no control group', () => {
    const obs: HistoricalDemandObservation[] = [
      {
        date: '2025-01-01',
        productType: 'LOAN',
        clientType: 'SME',
        amountBucket: 'MEDIUM',
        tenorBucket: 'MT',
        offeredRate: 5,
        converted: 1,
        treatment: true,
      },
    ];
    expect(estimateUplift(obs)).toBeNull();
  });

  it('returns positive upliftPct when treatment converts more than control', () => {
    // Force: treatment = 80% conversion, control = 20% conversion
    const obs: HistoricalDemandObservation[] = [];
    for (let i = 0; i < 200; i++) {
      obs.push({
        date: '2025-01-01',
        productType: 'LOAN',
        clientType: 'SME',
        amountBucket: 'MEDIUM',
        tenorBucket: 'MT',
        offeredRate: 5,
        converted: i < 160 ? 1 : 0, // 160/200 = 80%
        treatment: true,
      });
    }
    for (let i = 0; i < 200; i++) {
      obs.push({
        date: '2025-01-01',
        productType: 'LOAN',
        clientType: 'SME',
        amountBucket: 'MEDIUM',
        tenorBucket: 'MT',
        offeredRate: 5,
        converted: i < 40 ? 1 : 0, // 40/200 = 20%
        treatment: false,
      });
    }
    const result = estimateUplift(obs);
    expect(result).not.toBeNull();
    expect(result!.treatmentConversion).toBeCloseTo(0.8, 6);
    expect(result!.controlConversion).toBeCloseTo(0.2, 6);
    expect(result!.upliftPct).toBeCloseTo(0.6, 6);
    expect(result!.relativeUplift).toBeCloseTo(3.0, 6);
    expect(result!.significance).toBe('SIGNIFICANT');
  });

  it('marks small differences as NOT_SIGNIFICANT', () => {
    // Treatment and control with nearly identical conversion rates
    const obs: HistoricalDemandObservation[] = [];
    for (let i = 0; i < 50; i++) {
      obs.push({
        date: '2025-01-01',
        productType: 'LOAN',
        clientType: 'SME',
        amountBucket: 'MEDIUM',
        tenorBucket: 'MT',
        offeredRate: 5,
        converted: i < 25 ? 1 : 0, // 50%
        treatment: true,
      });
    }
    for (let i = 0; i < 50; i++) {
      obs.push({
        date: '2025-01-01',
        productType: 'LOAN',
        clientType: 'SME',
        amountBucket: 'MEDIUM',
        tenorBucket: 'MT',
        offeredRate: 5,
        converted: i < 24 ? 1 : 0, // 48%
        treatment: false,
      });
    }
    const result = estimateUplift(obs);
    expect(result).not.toBeNull();
    expect(result!.significance).toBe('NOT_SIGNIFICANT');
  });
});
