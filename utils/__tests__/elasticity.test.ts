import { describe, it, expect } from 'vitest';
import { predictVolumeImpact, calibrateFromHistory, createExpertModel } from '../elasticity/model';
import type { ElasticityModel } from '../../types/whatIf';

describe('elasticity model', () => {
  const MODEL: ElasticityModel = {
    id: 'e-1',
    product: 'Loan',
    segment: 'Corporate',
    slope: -0.1, // 1bp price increase → -0.1% volume
    intercept: 0,
    rSquared: 0.85,
    source: 'empirical',
    calibratedAt: '2026-01-01',
    calibratedByEmail: 'test@nfq.es',
    validFrom: '2026-01-01',
  };

  describe('predictVolumeImpact', () => {
    it('predicts volume decrease for price increase', () => {
      const prediction = predictVolumeImpact(MODEL, 10);
      expect(prediction.volumeDeltaPct).toBeCloseTo(-1, 1); // -0.1 * 10 = -1%
    });

    it('predicts volume increase for price decrease', () => {
      const prediction = predictVolumeImpact(MODEL, -10);
      expect(prediction.volumeDeltaPct).toBeCloseTo(1, 1);
    });

    it('returns zero impact for zero price change', () => {
      const prediction = predictVolumeImpact(MODEL, 0);
      expect(prediction.volumeDeltaPct).toBe(0);
    });

    it('includes confidence interval when R² is available', () => {
      const prediction = predictVolumeImpact(MODEL, 10);
      expect(prediction.confidenceInterval).toBeDefined();
    });

    it('omits confidence interval when R² is null', () => {
      const noRModel = { ...MODEL, rSquared: null };
      const prediction = predictVolumeImpact(noRModel, 10);
      expect(prediction.confidenceInterval).toBeUndefined();
    });
  });

  describe('calibrateFromHistory', () => {
    it('returns null for insufficient data', () => {
      const result = calibrateFromHistory([], 'Loan', 'Corporate', 'test@nfq.es');
      expect(result).toBeNull();
    });

    it('calibrates from sufficient data', () => {
      const outcomes = Array.from({ length: 20 }, (_, i) => ({
        deal: {
          id: `d-${i}`,
          productType: 'Loan',
          clientType: 'Corporate',
          clientId: 'C-1',
          businessUnit: 'BU-1',
          fundingBusinessUnit: 'BU-1',
          businessLine: 'BL-1',
          category: 'Asset' as const,
          currency: 'EUR',
          amount: 1_000_000,
          startDate: '2026-01-01',
          durationMonths: 48,
          amortization: 'Bullet' as const,
          repricingFreq: 'Fixed' as const,
          marginTarget: 0,
          riskWeight: 0.75,
          capitalRatio: 0.08,
          targetROE: 0.12,
          operationalCostBps: 25,
          transitionRisk: 'Neutral' as const,
          physicalRisk: 'Low' as const,
        },
        proposedRate: 0.05 + i * 0.002,
        won: i < 10, // first 10 win (lower rates), last 10 lose
        competitorRate: 0.06,
      }));

      const model = calibrateFromHistory(outcomes, 'Loan', 'Corporate', 'test@nfq.es');
      expect(model).not.toBeNull();
      expect(model!.source).toBe('empirical');
      expect(model!.sampleSize).toBe(20);
      expect(typeof model!.slope).toBe('number');
      expect(typeof model!.rSquared).toBe('number');
    });
  });

  describe('createExpertModel', () => {
    it('creates an expert model with given parameters', () => {
      const model = createExpertModel('Loan', 'SME', -0.05, 0, 'expert@nfq.es', 'Manual calibration');
      expect(model.source).toBe('expert');
      expect(model.slope).toBe(-0.05);
      expect(model.rSquared).toBeNull();
      expect(model.notes).toBe('Manual calibration');
    });
  });
});
