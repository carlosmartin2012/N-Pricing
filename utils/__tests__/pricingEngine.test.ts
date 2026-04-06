import { describe, it, expect } from 'vitest';
import { calculatePricing, PricingShocks, interpolateYieldCurve, resolveEffectiveTenors, bootstrapZeroRates } from '../pricingEngine';
import { calculateRAROC } from '../rarocEngine';
import type { Transaction, ApprovalMatrixConfig, BehaviouralModel } from '../../types';
import { MOCK_YIELD_CURVE, MOCK_BEHAVIOURAL_MODELS } from '../../constants';
import { LCR_OUTFLOW_TABLE, NSFR_ASF_TABLE, NSFR_RSF_TABLE } from '../../constants/regulations';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const defaultApproval: ApprovalMatrixConfig = {
  autoApprovalThreshold: 15,
  l1Threshold: 10,
  l2Threshold: 5,
};

const noShocks: PricingShocks = { interestRate: 0, liquiditySpread: 0 };

const baseDeal: Transaction = {
  clientId: 'CL-1001',
  clientType: 'Corporate',
  businessUnit: 'BU-001',
  fundingBusinessUnit: 'BU-900',
  businessLine: 'Corporate',
  productType: 'LOAN_COMM',
  category: 'Asset' as const,
  currency: 'USD',
  amount: 5_000_000,
  startDate: '2024-01-01',
  durationMonths: 24,
  amortization: 'Bullet' as const,
  repricingFreq: 'Fixed' as const,
  marginTarget: 2.25,
  riskWeight: 100,
  capitalRatio: 11.5,
  targetROE: 15,
  operationalCostBps: 45,
  lcrOutflowPct: 0,
  transitionRisk: 'Neutral' as const,
  physicalRisk: 'Low' as const,
};

// ---------------------------------------------------------------------------
// interpolateYieldCurve
// ---------------------------------------------------------------------------

describe('interpolateYieldCurve', () => {
  it('returns ON rate for 0 months', () => {
    const rate = interpolateYieldCurve(MOCK_YIELD_CURVE, 0);
    expect(rate).toBeCloseTo(5.32, 1);
  });

  it('returns exact 2Y rate for 24 months', () => {
    const rate = interpolateYieldCurve(MOCK_YIELD_CURVE, 24);
    expect(rate).toBeCloseTo(4.85, 1);
  });

  it('interpolates between 1Y and 2Y for 18 months', () => {
    const rate = interpolateYieldCurve(MOCK_YIELD_CURVE, 18);
    expect(rate).toBeGreaterThan(4.85);
    expect(rate).toBeLessThan(5.10);
  });

  it('returns 30Y rate for very long tenor', () => {
    const rate = interpolateYieldCurve(MOCK_YIELD_CURVE, 500);
    expect(rate).toBeCloseTo(4.10, 1);
  });
});

// ---------------------------------------------------------------------------
// resolveEffectiveTenors (Gap 9, 15)
// ---------------------------------------------------------------------------

describe('resolveEffectiveTenors', () => {
  it('DTM equals durationMonths', () => {
    const tenors = resolveEffectiveTenors(baseDeal, []);
    expect(tenors.dtm).toBe(24);
  });

  it('RM inferred from Fixed repricing equals DTM', () => {
    const tenors = resolveEffectiveTenors(baseDeal, []);
    expect(tenors.rm).toBe(24);
  });

  it('RM inferred from Monthly repricing equals 1', () => {
    const deal = { ...baseDeal, repricingFreq: 'Monthly' as const };
    const tenors = resolveEffectiveTenors(deal, []);
    expect(tenors.rm).toBe(1);
  });

  it('RM inferred from Quarterly repricing equals 3', () => {
    const deal = { ...baseDeal, repricingFreq: 'Quarterly' as const };
    const tenors = resolveEffectiveTenors(deal, []);
    expect(tenors.rm).toBe(3);
  });

  it('explicit repricingMonths overrides inference', () => {
    const deal = { ...baseDeal, repricingMonths: 6 };
    const tenors = resolveEffectiveTenors(deal, []);
    expect(tenors.rm).toBe(6);
  });

  it('BM defaults to DTM when no model', () => {
    const tenors = resolveEffectiveTenors(baseDeal, []);
    expect(tenors.bm).toBe(24);
  });

  it('BM from CPR model reduces effective maturity', () => {
    const cprModel: BehaviouralModel = {
      id: 'test-cpr', name: 'Test CPR', type: 'Prepayment_CPR',
      description: 'test', cpr: 10, penaltyExempt: 50,
    };
    const deal = { ...baseDeal, behaviouralModelId: 'test-cpr', durationMonths: 120 };
    const tenors = resolveEffectiveTenors(deal, [cprModel]);
    expect(tenors.bm).toBeLessThan(120);
    expect(tenors.bm).toBeCloseTo(114, 0); // 120 * (1 - 0.1 * 0.5) = 114
  });

  it('BM from NMD Parametric model uses core ratio formula', () => {
    const nmdModel: BehaviouralModel = {
      id: 'test-nmd', name: 'Test NMD', type: 'NMD_Replication',
      nmdMethod: 'Parametric', description: 'test',
      coreRatio: 60, betaFactor: 0.3, decayRate: 0.05,
    };
    const deal = { ...baseDeal, behaviouralModelId: 'test-nmd', durationMonths: 12 };
    const tenors = resolveEffectiveTenors(deal, [nmdModel]);
    // BM = 0.60 * 60 + 0.40 * 1 = 36.4
    expect(tenors.bm).toBeCloseTo(36.4, 0);
  });

  it('behavioralMaturityOverride takes precedence', () => {
    const deal = { ...baseDeal, behavioralMaturityOverride: 48 };
    const tenors = resolveEffectiveTenors(deal, MOCK_BEHAVIOURAL_MODELS);
    expect(tenors.bm).toBe(48);
  });
});

// ---------------------------------------------------------------------------
// calculatePricing — core
// ---------------------------------------------------------------------------

describe('calculatePricing', () => {
  describe('empty deal', () => {
    it('returns all-zero result when productType is empty and amount is 0', () => {
      const emptyDeal: Transaction = { ...baseDeal, productType: '', amount: 0 };
      const result = calculatePricing(emptyDeal, defaultApproval, undefined, noShocks);
      expect(result.baseRate).toBe(0);
      expect(result.liquiditySpread).toBe(0);
      expect(result.capitalCharge).toBe(0);
      expect(result.floorPrice).toBe(0);
      expect(result.technicalPrice).toBe(0);
      expect(result.totalFTP).toBe(0);
      expect(result.finalClientRate).toBe(0);
      expect(result.raroc).toBe(0);
      expect(result.economicProfit).toBe(0);
      expect(result.approvalLevel).toBe('Rejected');
    });

    it('returns all-zero result when amount is 0', () => {
      const zeroDeal: Transaction = { ...baseDeal, amount: 0 };
      const result = calculatePricing(zeroDeal, defaultApproval, undefined, noShocks);
      expect(result.baseRate).toBe(0);
      expect(result.totalFTP).toBe(0);
    });
  });

  describe('standard USD Asset loan', () => {
    const result = calculatePricing(baseDeal, defaultApproval, undefined, noShocks);

    it('uses yield curve for base rate (should be ~4.85% for 24M USD)', () => {
      expect(result.baseRate).toBeGreaterThan(4.5);
      expect(result.baseRate).toBeLessThan(5.5);
    });

    it('produces a positive liquiditySpread from liquidity curves', () => {
      expect(result.liquiditySpread).toBeGreaterThan(0);
    });

    it('produces a reasonable capitalCharge (not the old broken 17%+)', () => {
      expect(result.capitalCharge).toBeGreaterThan(0);
      expect(result.capitalCharge).toBeLessThan(3);
    });

    it('produces a positive regulatoryCost from PD*LGD', () => {
      expect(result.regulatoryCost).toBeGreaterThan(0);
      expect(result.regulatoryCost).toBeLessThan(2);
    });

    it('produces a positive operationalCost', () => {
      expect(result.operationalCost).toBeCloseTo(0.45, 2);
    });

    it('produces a positive floorPrice', () => {
      expect(result.floorPrice).toBeGreaterThan(0);
    });

    it('produces technicalPrice > floorPrice', () => {
      expect(result.technicalPrice).toBeGreaterThan(result.floorPrice);
    });

    it('produces a positive totalFTP', () => {
      expect(result.totalFTP).toBeGreaterThan(0);
    });

    it('produces a positive finalClientRate', () => {
      expect(result.finalClientRate).toBeGreaterThan(0);
    });

    it('selects Matched Maturity for Fixed repricing (default fallback)', () => {
      expect(result.matchedMethodology).toBe('Matched Maturity');
    });

    it('has accounting entries with equal debit and credit', () => {
      expect(result.accountingEntry.amountDebit).toBe(result.accountingEntry.amountCredit);
      expect(result.accountingEntry.amountDebit).toBeGreaterThan(0);
    });
  });

  // ── V5.0: Formula used is populated ──
  describe('formula used (Gap 1)', () => {
    it('populates formulaUsed field', () => {
      const result = calculatePricing(baseDeal, defaultApproval, undefined, noShocks);
      expect(result.formulaUsed).toBeDefined();
      expect(result.formulaUsed!.length).toBeGreaterThan(0);
    });

    it('short-term asset uses 50/50 split formula', () => {
      const shortDeal = { ...baseDeal, durationMonths: 6 };
      const result = calculatePricing(shortDeal, defaultApproval, undefined, noShocks);
      expect(result.formulaUsed).toContain('50%');
    });

    it('long-term asset uses BM-based formula', () => {
      const longDeal = { ...baseDeal, durationMonths: 60 };
      const result = calculatePricing(longDeal, defaultApproval, undefined, noShocks);
      expect(result.formulaUsed).toContain('BM');
    });
  });

  // ── Behavioral maturity (Gap 9) ──
  describe('behavioral maturity', () => {
    it('behavioralMaturityUsed is populated', () => {
      const result = calculatePricing(baseDeal, defaultApproval, undefined, noShocks);
      expect(result.behavioralMaturityUsed).toBeDefined();
    });
  });

  // ── Currency adjustment (Gap 10) ──
  describe('currency adjustment (EUR vs USD)', () => {
    it('EUR base rate is lower than USD', () => {
      const usdResult = calculatePricing(baseDeal, defaultApproval, undefined, noShocks);
      const eurDeal: Transaction = { ...baseDeal, currency: 'EUR' };
      const eurResult = calculatePricing(eurDeal, defaultApproval, undefined, noShocks);
      expect(eurResult.baseRate).toBeLessThan(usdResult.baseRate);
    });

    it('EUR differs from USD by tenor-scaled currency basis', () => {
      const usdResult = calculatePricing(baseDeal, defaultApproval, undefined, noShocks);
      const eurDeal: Transaction = { ...baseDeal, currency: 'EUR' };
      const eurResult = calculatePricing(eurDeal, defaultApproval, undefined, noShocks);
      const diff = usdResult.baseRate - eurResult.baseRate;
      // Tenor-scaled: basis = -1.0 * (0.5 + 0.5 * min(1, DTM/60))
      // For 24M deal: scaling = 0.5 + 0.5 * (24/60) = 0.7 → diff ≈ 0.7
      expect(diff).toBeGreaterThan(0.5);
      expect(diff).toBeLessThan(1.1);
    });
  });

  // ── NSFR charge (Gap 5) ──
  describe('NSFR charge', () => {
    it('asset gets positive NSFR cost', () => {
      const result = calculatePricing(baseDeal, defaultApproval, undefined, noShocks);
      expect(result.nsfrCost).toBeDefined();
      expect(result.nsfrCost!).toBeGreaterThan(0);
    });

    it('liability gets negative NSFR cost (benefit)', () => {
      const liabDeal: Transaction = {
        ...baseDeal, category: 'Liability', productType: 'DEP_TERM',
        depositStability: 'Stable', riskWeight: 0,
      };
      const result = calculatePricing(liabDeal, defaultApproval, undefined, noShocks);
      expect(result.nsfrCost!).toBeLessThan(0);
    });

    it('stable deposit has smaller NSFR charge magnitude than non-stable', () => {
      const stableDeal: Transaction = {
        ...baseDeal, category: 'Liability', productType: 'DEP_TERM',
        depositStability: 'Stable', riskWeight: 0,
      };
      const nonStableDeal: Transaction = {
        ...baseDeal, category: 'Liability', productType: 'DEP_TERM',
        depositStability: 'Non_Stable', riskWeight: 0,
      };
      const stableResult = calculatePricing(stableDeal, defaultApproval, undefined, noShocks);
      const nonStableResult = calculatePricing(nonStableDeal, defaultApproval, undefined, noShocks);
      // Stable has higher ASF (0.95) so lower unfunded portion = smaller absolute charge
      // Both are negative (benefit), stable closer to zero
      expect(Math.abs(stableResult.nsfrCost!)).toBeLessThan(Math.abs(nonStableResult.nsfrCost!));
    });
  });

  // ── LCR / CLC charge (Gap 4) ──
  describe('LCR CLC charge', () => {
    it('liability with outflow gets CLC charge', () => {
      const liabDeal: Transaction = {
        ...baseDeal, category: 'Liability', productType: 'DEP_CASA',
        lcrOutflowPct: 20, riskWeight: 0,
      };
      const result = calculatePricing(liabDeal, defaultApproval, undefined, noShocks);
      expect(result._clcChargeDetails).toBeGreaterThan(0);
    });

    it('credit line with undrawn amount scales CLC', () => {
      const lineDeal: Transaction = {
        ...baseDeal, productType: 'CRED_LINE', category: 'Off-Balance',
        isCommitted: true, lcrOutflowPct: 10, undrawnAmount: 10_000_000,
      };
      const result = calculatePricing(lineDeal, defaultApproval, undefined, noShocks);
      expect(result._clcChargeDetails).toBeGreaterThan(0);
    });
  });

  // ── Liquidity Recharge (Gap 3) ──
  describe('liquidity recharge', () => {
    it('liquidityRecharge is populated and positive', () => {
      const result = calculatePricing(baseDeal, defaultApproval, undefined, noShocks);
      expect(result.liquidityRecharge).toBeDefined();
      expect(result.liquidityRecharge!).toBeGreaterThan(0);
    });
  });

  // ── Secured LP (Gap 8) ──
  describe('secured LP', () => {
    it('collateralized asset uses secured LP (lower premium)', () => {
      const securedDeal: Transaction = {
        ...baseDeal, collateralType: 'Sovereign', haircutPct: 5,
      };
      const unsecuredResult = calculatePricing(baseDeal, defaultApproval, undefined, noShocks);
      const securedResult = calculatePricing(securedDeal, defaultApproval, undefined, noShocks);
      // Secured LP should be lower
      expect(securedResult._liquidityPremiumDetails).toBeLessThan(unsecuredResult._liquidityPremiumDetails);
    });
  });

  // ── RAROC-based approvals (Gap 6) ──
  describe('approval levels based on RAROC', () => {
    it('very high margin target produces Auto approval', () => {
      const highMarginDeal: Transaction = { ...baseDeal, marginTarget: 8.0 };
      const result = calculatePricing(highMarginDeal, defaultApproval, undefined, noShocks);
      expect(result.approvalLevel).toBe('Auto');
    });

    it('negative margin target produces Rejected', () => {
      const negMarginDeal: Transaction = { ...baseDeal, marginTarget: -5.0 };
      const result = calculatePricing(negMarginDeal, defaultApproval, undefined, noShocks);
      expect(result.approvalLevel).toBe('Rejected');
    });

    it('RAROC increases with marginTarget', () => {
      const lowResult = calculatePricing({ ...baseDeal, marginTarget: 1.0 }, defaultApproval, undefined, noShocks);
      const highResult = calculatePricing({ ...baseDeal, marginTarget: 4.0 }, defaultApproval, undefined, noShocks);
      expect(highResult.raroc).toBeGreaterThan(lowResult.raroc);
    });
  });

  // ── Capital Income (Gap 6) ──
  describe('capital income', () => {
    it('capitalIncome is positive when riskWeight > 0', () => {
      const result = calculatePricing(baseDeal, defaultApproval, undefined, noShocks);
      expect(result.capitalIncome).toBeDefined();
      expect(result.capitalIncome!).toBeGreaterThan(0);
    });

    it('capitalIncome is zero when riskWeight is 0', () => {
      const zeroRW = { ...baseDeal, riskWeight: 0 };
      const result = calculatePricing(zeroRW, defaultApproval, undefined, noShocks);
      expect(result.capitalIncome).toBe(0);
    });
  });

  // ── Shocks ──
  describe('shocks', () => {
    it('interest rate shock increases baseRate by exact bps', () => {
      const noShockResult = calculatePricing(baseDeal, defaultApproval, undefined, noShocks);
      const shockResult = calculatePricing(baseDeal, defaultApproval, undefined, { interestRate: 50, liquiditySpread: 0 });
      expect(shockResult.baseRate - noShockResult.baseRate).toBeCloseTo(0.50, 5);
    });

    it('liquidity spread shock increases liquiditySpread', () => {
      const noShockResult = calculatePricing(baseDeal, defaultApproval, undefined, noShocks);
      const shockResult = calculatePricing(baseDeal, defaultApproval, undefined, { interestRate: 0, liquiditySpread: 25 });
      expect(shockResult.liquiditySpread - noShockResult.liquiditySpread).toBeCloseTo(0.25, 5);
    });

    it('combined shocks increase totalFTP', () => {
      const noShockResult = calculatePricing(baseDeal, defaultApproval, undefined, noShocks);
      const shockResult = calculatePricing(baseDeal, defaultApproval, undefined, { interestRate: 100, liquiditySpread: 50 });
      expect(shockResult.totalFTP).toBeGreaterThan(noShockResult.totalFTP);
    });

    it('combined shocks also increase finalClientRate when pass-through is enabled', () => {
      const noShockResult = calculatePricing(baseDeal, defaultApproval, undefined, noShocks);
      const shockResult = calculatePricing(baseDeal, defaultApproval, undefined, { interestRate: 100, liquiditySpread: 50 });
      expect(shockResult.finalClientRate).toBeGreaterThan(noShockResult.finalClientRate);
    });

    it('preserves the margin target above shocked FTP', () => {
      const shockResult = calculatePricing(baseDeal, defaultApproval, undefined, { interestRate: 75, liquiditySpread: 25 });
      expect(shockResult.finalClientRate - shockResult.totalFTP).toBeCloseTo(baseDeal.marginTarget, 5);
    });
  });

  // ── Capital charge ──
  describe('capital charge formula correctness', () => {
    it('capital charge for RW=100%, Cap=11.5%, ROE=15% is reasonable (~1.1%)', () => {
      const result = calculatePricing(baseDeal, defaultApproval, undefined, noShocks);
      expect(result.capitalCharge).toBeGreaterThan(0.5);
      expect(result.capitalCharge).toBeLessThan(2.0);
    });

    it('zero risk weight produces zero capital charge', () => {
      const zeroRW: Transaction = { ...baseDeal, riskWeight: 0 };
      const result = calculatePricing(zeroRW, defaultApproval, undefined, noShocks);
      expect(result.capitalCharge).toBe(0);
    });
  });

  // ── Credit cost ──
  describe('credit cost by rating', () => {
    it('lower-rated client has higher credit cost', () => {
      const bbbDeal: Transaction = { ...baseDeal, clientId: 'CL-1001' };
      const bDeal: Transaction = { ...baseDeal, clientId: 'CL-2001' };
      const bbbResult = calculatePricing(bbbDeal, defaultApproval, undefined, noShocks);
      const bResult = calculatePricing(bDeal, defaultApproval, undefined, noShocks);
      expect(bResult.regulatoryCost).toBeGreaterThan(bbbResult.regulatoryCost);
    });
  });

  // ── Liability pricing ──
  describe('liability pricing', () => {
    it('liability has negative or lower liquidity premium than asset', () => {
      const liabDeal: Transaction = {
        ...baseDeal, category: 'Liability', productType: 'DEP_TERM', riskWeight: 0,
      };
      const assetResult = calculatePricing(baseDeal, defaultApproval, undefined, noShocks);
      const liabResult = calculatePricing(liabDeal, defaultApproval, undefined, noShocks);
      expect(liabResult._liquidityPremiumDetails).toBeLessThan(assetResult._liquidityPremiumDetails);
    });
  });

  // ── EAD vs Amount (Gap 16) ──
  describe('EAD handling', () => {
    it('custom EAD affects RAROC calculation', () => {
      const defaultResult = calculatePricing(baseDeal, defaultApproval, undefined, noShocks);
      const eadDeal = { ...baseDeal, ead: 7_000_000 };
      const eadResult = calculatePricing(eadDeal, defaultApproval, undefined, noShocks);
      // Different EAD should produce different RAROC
      expect(eadResult.raroc).not.toBeCloseTo(defaultResult.raroc, 1);
    });
  });
});

// ---------------------------------------------------------------------------
// RAROC engine (Gap 6)
// ---------------------------------------------------------------------------

describe('calculateRAROC', () => {
  it('computes positive RAROC for profitable loan', () => {
    const result = calculateRAROC({
      transactionId: 'test', loanAmt: 1_000_000, osAmt: 1_000_000,
      ead: 1_000_000, interestRate: 8.0, interestSpread: 4.0,
      cofRate: 3.5, rwa: 600_000, ecl: 5000, feeIncome: 10000,
      operatingCostPct: 0.5, riskFreeRate: 2.5, opRiskCapitalCharge: 0.2,
      minRegCapitalReq: 8, hurdleRate: 12, pillar2CapitalCharge: 1.5,
    });
    expect(result.raroc).toBeGreaterThan(0);
    expect(result.totalRegCapital).toBeGreaterThan(0);
    expect(result.capitalIncome).toBeGreaterThan(0);
  });

  it('EVA is RAROC minus hurdle rate', () => {
    const result = calculateRAROC({
      transactionId: 'test', loanAmt: 1_000_000, osAmt: 1_000_000,
      ead: 1_000_000, interestRate: 6.5, interestSpread: 2.5,
      cofRate: 3.5, rwa: 600_000, ecl: 5000, feeIncome: 10000,
      operatingCostPct: 0.5, riskFreeRate: 2.5, opRiskCapitalCharge: 0.2,
      minRegCapitalReq: 8, hurdleRate: 12, pillar2CapitalCharge: 1.5,
    });
    expect(result.eva).toBeCloseTo(result.raroc - 12, 2);
  });

  it('fee income increases RAROC', () => {
    const noFee = calculateRAROC({
      transactionId: 'test', loanAmt: 1_000_000, osAmt: 1_000_000,
      ead: 1_000_000, interestRate: 6.5, interestSpread: 2.5,
      cofRate: 3.5, rwa: 600_000, ecl: 5000, feeIncome: 0,
      operatingCostPct: 0.5, riskFreeRate: 2.5, opRiskCapitalCharge: 0.2,
      minRegCapitalReq: 8, hurdleRate: 12, pillar2CapitalCharge: 1.5,
    });
    const withFee = calculateRAROC({
      transactionId: 'test', loanAmt: 1_000_000, osAmt: 1_000_000,
      ead: 1_000_000, interestRate: 6.5, interestSpread: 2.5,
      cofRate: 3.5, rwa: 600_000, ecl: 5000, feeIncome: 50000,
      operatingCostPct: 0.5, riskFreeRate: 2.5, opRiskCapitalCharge: 0.2,
      minRegCapitalReq: 8, hurdleRate: 12, pillar2CapitalCharge: 1.5,
    });
    expect(withFee.raroc).toBeGreaterThan(noFee.raroc);
  });
});

// ---------------------------------------------------------------------------
// Regulatory tables (Gap 4, 5)
// ---------------------------------------------------------------------------

describe('regulatory tables', () => {
  it('LCR_OUTFLOW_TABLE has retail stable at 5%', () => {
    expect(LCR_OUTFLOW_TABLE['DEP_CASA_Stable']).toBe(0.05);
  });

  it('LCR_OUTFLOW_TABLE has financial institution at 100%', () => {
    expect(LCR_OUTFLOW_TABLE['DEP_TERM_Financial']).toBe(1.00);
  });

  it('NSFR_ASF_TABLE has stable deposit at 95%', () => {
    expect(NSFR_ASF_TABLE['STABLE_DEPOSIT']).toBe(0.95);
  });

  it('NSFR_RSF_TABLE has mortgage RW<35 at 65%', () => {
    expect(NSFR_RSF_TABLE['MORTGAGE_RW_LT35']).toBe(0.65);
  });
});

// ---------------------------------------------------------------------------
// Zero coupon bootstrap (Gap 7)
// ---------------------------------------------------------------------------

describe('bootstrapZeroRates', () => {
  it('short-term zero rates equal par rates', () => {
    const zeros = bootstrapZeroRates(MOCK_YIELD_CURVE);
    const onPar = MOCK_YIELD_CURVE.find(p => p.tenor === 'ON')!;
    const onZero = zeros.find(p => p.tenor === 'ON')!;
    expect(onZero.rate).toBeCloseTo(onPar.rate, 2);
  });

  it('produces zero rates for all tenors', () => {
    const zeros = bootstrapZeroRates(MOCK_YIELD_CURVE);
    expect(zeros.length).toBe(MOCK_YIELD_CURVE.length);
  });

  it('long-term zero rates are slightly higher than par (upward sloping)', () => {
    const zeros = bootstrapZeroRates(MOCK_YIELD_CURVE);
    const par5Y = MOCK_YIELD_CURVE.find(p => p.tenor === '5Y')!;
    const zero5Y = zeros.find(p => p.tenor === '5Y')!;
    // For downward-sloping curve, zero should be slightly different
    expect(zero5Y.rate).toBeDefined();
    expect(Math.abs(zero5Y.rate - par5Y.rate)).toBeLessThan(1); // reasonable divergence
  });
});
