import { describe, expect, it } from 'vitest';
import type { ApprovalMatrixConfig, Transaction } from '../../types';
import { calculatePricing } from '../pricingEngine';
import type { PricingContext } from '../pricingEngine';
import { EBA_SHOCK_PRESETS } from '../pricing/shockPresets';
import {
  batchReprice,
  calculatePricing as calculatePricingBoundary,
  calculatePricingCore,
  calculatePricingOutput,
} from '@npricing/pricing-core';

const approvalMatrix: ApprovalMatrixConfig = {
  autoApprovalThreshold: 15,
  l1Threshold: 10,
  l2Threshold: 5,
  autoApprovalEvaBp: 200,
  l1EvaBp: 0,
  l2EvaBp: -100,
};

const emptyContext: PricingContext = {
  yieldCurve: [],
  liquidityCurves: [],
  rules: [],
  rateCards: [],
  transitionGrid: [],
  physicalGrid: [],
  greeniumGrid: [],
  behaviouralModels: [],
  products: [],
  clients: [],
  businessUnits: [],
};

function baseDeal(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'boundary-deal',
    status: 'Draft',
    productType: 'LOAN_COMM',
    currency: 'EUR',
    amount: 2_500_000,
    businessUnit: 'BU_01',
    fundingBusinessUnit: 'TREASURY',
    businessLine: 'Corporate Banking',
    clientId: 'C-1',
    clientType: 'Corporate',
    startDate: '2026-01-01',
    durationMonths: 120,
    repricingFreq: 'Fixed',
    amortization: 'Bullet',
    marginTarget: 0.75,
    capitalRatio: 8,
    targetROE: 12,
    riskWeight: 100,
    category: 'Asset',
    ...overrides,
  } as Transaction;
}

describe('pricing-core package boundary', () => {
  it('preserves the legacy calculatePricing output exactly', () => {
    const deal = baseDeal();
    const legacy = calculatePricing(deal, approvalMatrix, emptyContext);
    const fromBoundary = calculatePricingOutput({
      deal,
      approvalMatrix,
      context: emptyContext,
    });

    expect(fromBoundary).toEqual(legacy);
  });

  it('exposes compatibility adapters for existing consumers', () => {
    const deal = baseDeal();
    const direct = calculatePricingBoundary(deal, approvalMatrix, emptyContext);
    const batch = batchReprice([deal], approvalMatrix, emptyContext);

    expect(direct).toEqual(calculatePricing(deal, approvalMatrix, emptyContext));
    expect(batch.get(deal.id!)).toEqual(direct);
  });

  it('returns metadata without changing the public FTPResult', () => {
    const result = calculatePricingCore({
      deal: baseDeal(),
      approvalMatrix,
      context: emptyContext,
    });

    expect(result.metadata).toEqual({
      boundary: 'pricing-core',
      coreVersion: 'legacy-orchestrator-v1',
      featureFlags: {},
    });
    expect(typeof result.output.totalFTP).toBe('number');
  });

  it('accepts curve-shift pricing as an explicit request flag', () => {
    const deal = baseDeal({ repricingFreq: 'Fixed', repricingMonths: 120 });
    const shocks = EBA_SHOCK_PRESETS.short_up_250;

    const legacyUniform = calculatePricingOutput({
      deal,
      approvalMatrix,
      context: emptyContext,
      shocks,
      featureFlags: { applyCurveShift: false },
    });
    const explicitCurveShift = calculatePricingOutput({
      deal,
      approvalMatrix,
      context: emptyContext,
      shocks,
      featureFlags: { applyCurveShift: true },
    });

    expect(explicitCurveShift.baseRate).not.toBeCloseTo(legacyUniform.baseRate, 6);
    expect(explicitCurveShift.totalFTP).not.toBeCloseTo(legacyUniform.totalFTP, 6);
  });
});
