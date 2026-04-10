import { describe, it, expect } from 'vitest';
import {
  backtestPDModel,
  backtestLGDModel,
  backtestBehavioralModel,
  buildValidationReport,
  type BacktestObservation,
  type ModelMetadata,
  type BacktestResult,
} from '../pricing/modelInventory';

// ---------- Helpers ----------

function makePDObs(
  predicted: number,
  actual: number,
  i = 0,
): BacktestObservation {
  return {
    date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
    predicted,
    actual,
  };
}

function baseMetadata(overrides: Partial<ModelMetadata> = {}): ModelMetadata {
  return {
    id: 'PD-RETAIL-001',
    name: 'Retail PD Model',
    category: 'PD',
    status: 'PRODUCTION',
    version: '1.2.0',
    owner: 'Risk Analytics Team',
    description: 'Retail mortgage PD model',
    effectiveFrom: '2025-01-01',
    effectiveTo: null,
    nextValidationDate: '2027-01-01',
    validationFrequency: 'ANNUAL',
    ...overrides,
  };
}

// ---------- backtestPDModel ----------

describe('backtestPDModel', () => {
  it('returns empty/GREEN result for zero observations', () => {
    const result = backtestPDModel('PD-RETAIL-001', []);
    expect(result.observations).toBe(0);
    expect(result.bias).toBe(0);
    expect(result.mae).toBe(0);
    expect(result.rmse).toBe(0);
    expect(result.trafficLight).toBe('GREEN');
    expect(result.findings).toContain('No observations');
  });

  it('returns GREEN with zero error for perfect predictions', () => {
    // Perfect predictions: predicted matches actual exactly
    const obs: BacktestObservation[] = [
      makePDObs(0, 0, 0),
      makePDObs(0, 0, 1),
      makePDObs(0, 0, 2),
      makePDObs(1, 1, 3),
      makePDObs(0, 0, 4),
    ];
    const result = backtestPDModel('PD-RETAIL-001', obs);
    expect(result.bias).toBe(0);
    expect(result.mae).toBe(0);
    expect(result.rmse).toBe(0);
    expect(result.trafficLight).toBe('GREEN');
    expect(result.hitRate).toBe(1);
    expect(result.findings).toContain('Within tolerance');
  });

  it('flags over-conservative model (bias > 0.03) as RED', () => {
    // Predict PD=0.10 consistently but actual default rate is ~2%
    // bias = 0.10 - 0.02 = 0.08
    const obs: BacktestObservation[] = [];
    for (let i = 0; i < 100; i++) {
      obs.push(makePDObs(0.1, i < 2 ? 1 : 0, i));
    }
    const result = backtestPDModel('PD-RETAIL-001', obs);
    expect(result.bias).toBeGreaterThan(0.03);
    expect(result.trafficLight).toBe('RED');
    expect(result.findings.some((f) => f.includes('Overestimating'))).toBe(
      true,
    );
  });

  it('flags under-estimation (bias < -0.03) with finding', () => {
    // Predict PD=0.01 but actual default rate is ~10%
    // bias = 0.01 - 0.10 = -0.09
    const obs: BacktestObservation[] = [];
    for (let i = 0; i < 100; i++) {
      obs.push(makePDObs(0.01, i < 10 ? 1 : 0, i));
    }
    const result = backtestPDModel('PD-RETAIL-001', obs);
    expect(result.bias).toBeLessThan(-0.03);
    expect(result.trafficLight).toBe('RED');
    expect(result.findings.some((f) => f.includes('Underestimating'))).toBe(
      true,
    );
  });

  it('computes hit rate correctly at 0.5 threshold', () => {
    // 4 obs: 2 correct (predicted≥0.5 & actual=1), 1 correct (predicted<0.5 & actual=0), 1 wrong
    const obs: BacktestObservation[] = [
      makePDObs(0.8, 1, 0), // correct
      makePDObs(0.6, 1, 1), // correct
      makePDObs(0.2, 0, 2), // correct
      makePDObs(0.7, 0, 3), // wrong (predicted default but no default)
    ];
    const result = backtestPDModel('PD-RETAIL-001', obs);
    expect(result.hitRate).toBe(0.75);
  });

  it('yields AMBER for bias between 0.01 and 0.03', () => {
    // Predict PD=0.03, actual rate ~1% → bias ≈ 0.02
    const obs: BacktestObservation[] = [];
    for (let i = 0; i < 100; i++) {
      obs.push(makePDObs(0.03, i < 1 ? 1 : 0, i));
    }
    const result = backtestPDModel('PD-RETAIL-001', obs);
    expect(Math.abs(result.bias)).toBeGreaterThan(0.01);
    expect(Math.abs(result.bias)).toBeLessThanOrEqual(0.03);
    expect(result.trafficLight).toBe('AMBER');
  });
});

// ---------- backtestLGDModel ----------

describe('backtestLGDModel', () => {
  it('returns GREEN when bias is within 5%', () => {
    // Predicted LGD ≈ 0.45, actual ≈ 0.43 → bias ≈ 0.02
    const obs: BacktestObservation[] = [
      { date: '2026-01-01', predicted: 0.45, actual: 0.43 },
      { date: '2026-02-01', predicted: 0.46, actual: 0.44 },
      { date: '2026-03-01', predicted: 0.44, actual: 0.42 },
      { date: '2026-04-01', predicted: 0.45, actual: 0.43 },
    ];
    const result = backtestLGDModel('LGD-RETAIL-001', obs);
    expect(Math.abs(result.bias)).toBeLessThanOrEqual(0.05);
    expect(result.trafficLight).toBe('GREEN');
  });

  it('returns AMBER when bias is around 8%', () => {
    // Predicted 0.50, actual 0.42 → bias 0.08
    const obs: BacktestObservation[] = [
      { date: '2026-01-01', predicted: 0.5, actual: 0.42 },
      { date: '2026-02-01', predicted: 0.5, actual: 0.42 },
      { date: '2026-03-01', predicted: 0.5, actual: 0.42 },
    ];
    const result = backtestLGDModel('LGD-RETAIL-001', obs);
    expect(result.bias).toBeCloseTo(0.08, 5);
    expect(result.trafficLight).toBe('AMBER');
  });

  it('returns RED when bias is around 15%', () => {
    // Predicted 0.55, actual 0.40 → bias 0.15
    const obs: BacktestObservation[] = [
      { date: '2026-01-01', predicted: 0.55, actual: 0.4 },
      { date: '2026-02-01', predicted: 0.55, actual: 0.4 },
      { date: '2026-03-01', predicted: 0.55, actual: 0.4 },
    ];
    const result = backtestLGDModel('LGD-RETAIL-001', obs);
    expect(result.bias).toBeCloseTo(0.15, 5);
    expect(result.trafficLight).toBe('RED');
    expect(result.findings.some((f) => f.includes('Overestimating'))).toBe(
      true,
    );
  });

  it('returns zero-ed GREEN result with no observations', () => {
    const result = backtestLGDModel('LGD-RETAIL-001', []);
    expect(result.observations).toBe(0);
    expect(result.trafficLight).toBe('GREEN');
    expect(result.findings).toContain('No observations');
  });
});

// ---------- backtestBehavioralModel ----------

describe('backtestBehavioralModel', () => {
  it('works as generic function for NMD beta', () => {
    // Predicted pass-through beta 0.50, realized ~0.48 → bias 0.02
    const obs: BacktestObservation[] = [
      { date: '2026-01-01', predicted: 0.5, actual: 0.48 },
      { date: '2026-02-01', predicted: 0.5, actual: 0.49 },
      { date: '2026-03-01', predicted: 0.5, actual: 0.47 },
      { date: '2026-04-01', predicted: 0.5, actual: 0.48 },
    ];
    const result = backtestBehavioralModel(
      'NMD-BETA-RETAIL',
      'NMD_BETA',
      obs,
    );
    expect(result.category).toBe('NMD_BETA');
    expect(result.trafficLight).toBe('GREEN');
    expect(result.observations).toBe(4);
  });

  it('flags poor fit via MAE finding', () => {
    // MAE > 0.15
    const obs: BacktestObservation[] = [
      { date: '2026-01-01', predicted: 0.3, actual: 0.6 },
      { date: '2026-02-01', predicted: 0.35, actual: 0.55 },
      { date: '2026-03-01', predicted: 0.4, actual: 0.6 },
    ];
    const result = backtestBehavioralModel(
      'BONUS-FULFILLMENT',
      'CROSS_BONUSES',
      obs,
    );
    expect(result.mae).toBeGreaterThan(0.15);
    expect(result.findings.some((f) => f.includes('MAE'))).toBe(true);
  });
});

// ---------- buildValidationReport ----------

describe('buildValidationReport', () => {
  const greenResult: BacktestResult = {
    modelId: 'PD-RETAIL-001',
    category: 'PD',
    observations: 100,
    mae: 0.005,
    rmse: 0.01,
    bias: 0.001,
    trafficLight: 'GREEN',
    findings: ['Within tolerance'],
  };

  const amberResult: BacktestResult = {
    modelId: 'PD-RETAIL-001',
    category: 'PD',
    observations: 100,
    mae: 0.02,
    rmse: 0.025,
    bias: 0.02,
    trafficLight: 'AMBER',
    findings: ['Slight overestimation'],
  };

  const redResult: BacktestResult = {
    modelId: 'PD-RETAIL-001',
    category: 'PD',
    observations: 100,
    mae: 0.08,
    rmse: 0.12,
    bias: 0.08,
    trafficLight: 'RED',
    findings: ['Overestimating PD significantly'],
  };

  it('overall GREEN when all backtests are GREEN', () => {
    const report = buildValidationReport(baseMetadata(), [
      greenResult,
      greenResult,
    ]);
    expect(report.overallTrafficLight).toBe('GREEN');
    expect(
      report.recommendations.filter((r) => !r.includes('overdue')).length,
    ).toBe(0);
    expect(report.summary).toContain('GREEN');
  });

  it('overall RED if any backtest is RED', () => {
    const report = buildValidationReport(baseMetadata(), [
      greenResult,
      amberResult,
      redResult,
    ]);
    expect(report.overallTrafficLight).toBe('RED');
    expect(
      report.recommendations.some((r) => r.includes('Immediate model review')),
    ).toBe(true);
    expect(
      report.recommendations.some((r) => r.includes('model risk committee')),
    ).toBe(true);
  });

  it('flags overdue validation when nextValidationDate is in the past', () => {
    const report = buildValidationReport(
      baseMetadata({ nextValidationDate: '2020-01-01' }),
      [greenResult],
    );
    expect(report.recommendations.some((r) => r.includes('overdue'))).toBe(
      true,
    );
  });

  it('escalates recommendations for RED overall', () => {
    const report = buildValidationReport(baseMetadata(), [redResult]);
    expect(report.overallTrafficLight).toBe('RED');
    expect(report.recommendations).toContain(
      'Immediate model review required',
    );
    expect(report.recommendations).toContain('Escalate to model risk committee');
  });

  it('provides AMBER recommendations for AMBER overall', () => {
    const report = buildValidationReport(baseMetadata(), [
      greenResult,
      amberResult,
    ]);
    expect(report.overallTrafficLight).toBe('AMBER');
    expect(
      report.recommendations.some((r) => r.includes('ad-hoc review')),
    ).toBe(true);
    expect(
      report.recommendations.some((r) => r.includes('monitoring frequency')),
    ).toBe(true);
  });
});
