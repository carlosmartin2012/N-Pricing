import { describe, it, expect } from 'vitest';
import {
  calculateCSRBBCharge,
  calculateContingentLiquidityCharge,
  calculateAdditionalFTPCharges,
  CSRBB_BASE_BPS_PER_YEAR,
  CSRBB_QUALITY_MULTIPLIER,
  CONTINGENT_LIQUIDITY_COST_BPS,
  CONTINGENT_DRAW_FACTOR,
} from '../pricing/additionalCharges';
import type { Transaction } from '../../types';

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

const baseDeal: Transaction = {
  clientId: 'CL-1001',
  clientType: 'Corporate',
  businessUnit: 'BU-001',
  fundingBusinessUnit: 'BU-900',
  businessLine: 'Corporate',
  productType: 'LOAN_COMM',
  category: 'Asset',
  currency: 'EUR',
  amount: 1_000_000,
  startDate: '2024-01-01',
  durationMonths: 24,
  amortization: 'Bullet',
  repricingFreq: 'Fixed',
  marginTarget: 2.0,
  riskWeight: 100,
  capitalRatio: 11.5,
  targetROE: 15,
  operationalCostBps: 45,
  transitionRisk: 'Neutral',
  physicalRisk: 'Low',
};

// ---------------------------------------------------------------------------
// CSRBB
// ---------------------------------------------------------------------------

describe('calculateCSRBBCharge', () => {
  it('returns zero for Liability category', () => {
    const result = calculateCSRBBCharge({
      durationMonths: 60,
      clientRating: 'A',
      category: 'Liability',
    });
    expect(result.chargePct).toBe(0);
    expect(result.durationYears).toBe(0);
    expect(result.qualityMultiplier).toBe(0);
  });

  it('computes BBB asset charge = base × duration × 1.0', () => {
    const result = calculateCSRBBCharge({
      durationMonths: 24,
      clientRating: 'BBB',
      category: 'Asset',
    });
    // 2.5 bps × 2 years × 1.0 = 5 bps = 0.05 %
    const expectedBps = CSRBB_BASE_BPS_PER_YEAR * 2 * CSRBB_QUALITY_MULTIPLIER.BBB;
    expect(result.chargePct).toBeCloseTo(expectedBps / 100, 6);
    expect(result.durationYears).toBe(2);
    expect(result.qualityMultiplier).toBe(1.0);
  });

  it('scales charge by rating quality (AAA < BBB < CCC)', () => {
    const aaa = calculateCSRBBCharge({ durationMonths: 60, clientRating: 'AAA', category: 'Asset' });
    const bbb = calculateCSRBBCharge({ durationMonths: 60, clientRating: 'BBB', category: 'Asset' });
    const ccc = calculateCSRBBCharge({ durationMonths: 60, clientRating: 'CCC', category: 'Asset' });

    expect(aaa.chargePct).toBeLessThan(bbb.chargePct);
    expect(bbb.chargePct).toBeLessThan(ccc.chargePct);
    // Ratio sanity: CCC / AAA = 5.0 / 0.3 ≈ 16.67
    expect(ccc.chargePct / aaa.chargePct).toBeCloseTo(5.0 / 0.3, 3);
  });

  it('caps duration scaling at 10 years (20Y deal = 10Y deal)', () => {
    const tenY = calculateCSRBBCharge({ durationMonths: 120, clientRating: 'BBB', category: 'Asset' });
    const twentyY = calculateCSRBBCharge({ durationMonths: 240, clientRating: 'BBB', category: 'Asset' });
    expect(twentyY.chargePct).toBeCloseTo(tenY.chargePct, 10);
    // But raw duration years should reflect input
    expect(twentyY.durationYears).toBe(20);
    expect(tenY.durationYears).toBe(10);
  });

  it('defaults unknown ratings to BBB multiplier (1.0)', () => {
    const unknown = calculateCSRBBCharge({
      durationMonths: 36,
      clientRating: 'XYZ',
      category: 'Asset',
    });
    const bbb = calculateCSRBBCharge({
      durationMonths: 36,
      clientRating: 'BBB',
      category: 'Asset',
    });
    expect(unknown.qualityMultiplier).toBe(1.0);
    expect(unknown.chargePct).toBeCloseTo(bbb.chargePct, 10);
  });

  it('uses BBB as default when no rating supplied', () => {
    const result = calculateCSRBBCharge({
      durationMonths: 12,
      category: 'Asset',
    });
    expect(result.qualityMultiplier).toBe(1.0);
    expect(result.chargePct).toBeCloseTo(
      (CSRBB_BASE_BPS_PER_YEAR * 1 * 1.0) / 100,
      10,
    );
  });
});

// ---------------------------------------------------------------------------
// Contingent Liquidity
// ---------------------------------------------------------------------------

describe('calculateContingentLiquidityCharge', () => {
  it('returns zero when there is no undrawn commitment', () => {
    const result = calculateContingentLiquidityCharge({
      productType: 'CRED_LINE',
      amount: 1_000_000,
      undrawnAmount: 0,
      isCommitted: true,
      clientType: 'Corporate',
    });
    expect(result.chargePct).toBe(0);
    expect(result.drawFactor).toBe(0);
    expect(result.undrawnRatio).toBe(0);
  });

  it('charges committed corporate credit line correctly', () => {
    const result = calculateContingentLiquidityCharge({
      productType: 'CRED_LINE',
      amount: 1_000_000,
      undrawnAmount: 1_000_000,
      isCommitted: true,
      clientType: 'Corporate',
    });
    // undrawnRatio = 1, factor = 0.10, cost = 15 bps → 1 × 0.10 × 15 = 1.5 bps
    const expectedBps = 1 * CONTINGENT_DRAW_FACTOR.CRED_LINE_Committed_Corporate * CONTINGENT_LIQUIDITY_COST_BPS;
    expect(result.chargePct).toBeCloseTo(expectedBps / 100, 6);
    expect(result.drawFactor).toBe(0.10);
    expect(result.undrawnRatio).toBe(1);
  });

  it('uses lower factor for uncommitted lines vs committed', () => {
    const committed = calculateContingentLiquidityCharge({
      productType: 'CRED_LINE',
      amount: 1_000_000,
      undrawnAmount: 500_000,
      isCommitted: true,
      clientType: 'Corporate',
    });
    const uncommitted = calculateContingentLiquidityCharge({
      productType: 'CRED_LINE',
      amount: 1_000_000,
      undrawnAmount: 500_000,
      isCommitted: false,
      clientType: 'Corporate',
    });
    expect(uncommitted.drawFactor).toBeLessThan(committed.drawFactor);
    expect(uncommitted.chargePct).toBeLessThan(committed.chargePct);
    expect(uncommitted.drawFactor).toBe(CONTINGENT_DRAW_FACTOR.CRED_LINE_Uncommitted);
  });

  it('picks financial-counterparty factor for Institution client type', () => {
    const result = calculateContingentLiquidityCharge({
      productType: 'CRED_LINE',
      amount: 2_000_000,
      undrawnAmount: 2_000_000,
      isCommitted: true,
      clientType: 'Institution',
    });
    expect(result.drawFactor).toBe(CONTINGENT_DRAW_FACTOR.CRED_LINE_Committed_Financial);
  });

  it('handles GUARANTEE products via product type key', () => {
    const financial = calculateContingentLiquidityCharge({
      productType: 'GUARANTEE_Financial',
      amount: 500_000,
      undrawnAmount: 500_000,
    });
    const performance = calculateContingentLiquidityCharge({
      productType: 'GUARANTEE_Performance',
      amount: 500_000,
      undrawnAmount: 500_000,
    });
    expect(financial.drawFactor).toBe(CONTINGENT_DRAW_FACTOR.GUARANTEE_Financial);
    expect(performance.drawFactor).toBe(CONTINGENT_DRAW_FACTOR.GUARANTEE_Performance);
    expect(financial.chargePct).toBeGreaterThan(performance.chargePct);
  });

  it('handles STANDBY_LC with the highest draw factor', () => {
    const result = calculateContingentLiquidityCharge({
      productType: 'STANDBY_LC',
      amount: 1_000_000,
      undrawnAmount: 1_000_000,
    });
    expect(result.drawFactor).toBe(CONTINGENT_DRAW_FACTOR.STANDBY_LC);
    expect(result.chargePct).toBeCloseTo(
      (1 * CONTINGENT_DRAW_FACTOR.STANDBY_LC * CONTINGENT_LIQUIDITY_COST_BPS) / 100,
      6,
    );
  });
});

// ---------------------------------------------------------------------------
// calculateAdditionalFTPCharges — combined helper
// ---------------------------------------------------------------------------

describe('calculateAdditionalFTPCharges', () => {
  it('combines CSRBB + contingent liquidity for an Asset credit line', () => {
    const deal: Transaction = {
      ...baseDeal,
      productType: 'CRED_LINE',
      category: 'Asset',
      amount: 1_000_000,
      undrawnAmount: 1_000_000,
      isCommitted: true,
      clientType: 'Corporate',
      durationMonths: 24,
    };
    const result = calculateAdditionalFTPCharges(deal, 'BBB');

    // CSRBB: 2.5 × 2 × 1.0 = 5 bps = 0.05 %
    expect(result.csrbb.chargePct).toBeCloseTo(0.05, 6);
    // CL: 1 × 0.10 × 15 = 1.5 bps = 0.015 %
    expect(result.contingentLiquidity.chargePct).toBeCloseTo(0.015, 6);
    expect(result.totalAdditionalChargePct).toBeCloseTo(0.065, 6);
  });

  it('returns only contingent liquidity portion for a Liability deal', () => {
    const deal: Transaction = {
      ...baseDeal,
      productType: 'DEPO_DEMAND',
      category: 'Liability',
      amount: 5_000_000,
      undrawnAmount: 0,
      durationMonths: 12,
    };
    const result = calculateAdditionalFTPCharges(deal, 'A');

    // CSRBB zero for Liability
    expect(result.csrbb.chargePct).toBe(0);
    // No undrawn → contingent is zero
    expect(result.contingentLiquidity.chargePct).toBe(0);
    expect(result.totalAdditionalChargePct).toBe(0);
  });

  it('applies CSRBB but not CL for a plain Asset loan with no undrawn', () => {
    const deal: Transaction = {
      ...baseDeal,
      productType: 'LOAN_COMM',
      category: 'Asset',
      amount: 2_000_000,
      durationMonths: 60,
    };
    const result = calculateAdditionalFTPCharges(deal, 'A');

    // CSRBB: 2.5 × 5 × 0.8 = 10 bps = 0.10 %
    expect(result.csrbb.chargePct).toBeCloseTo(0.10, 6);
    // No undrawn → CL zero
    expect(result.contingentLiquidity.chargePct).toBe(0);
    expect(result.totalAdditionalChargePct).toBeCloseTo(0.10, 6);
  });
});
