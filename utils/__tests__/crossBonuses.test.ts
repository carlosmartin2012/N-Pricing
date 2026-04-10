import { describe, it, expect } from 'vitest';
import {
  calculateCrossBonusAdjustment,
  DEFAULT_CROSS_BONUS_CATALOGUE,
  type CrossBonusRule,
} from '../pricing/crossBonuses';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LOAN = 200_000;
const DURATION_24Y = 24 * 12; // 288 months
const DURATION_10Y = 10 * 12;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('calculateCrossBonusAdjustment', () => {
  it('returns zero result when no attachments are provided', () => {
    const result = calculateCrossBonusAdjustment({
      attachments: [],
      loanAmount: LOAN,
      loanDurationMonths: DURATION_24Y,
    });

    expect(result.breakdown).toHaveLength(0);
    expect(result.totalDiscountPct).toBeCloseTo(0, 10);
    expect(result.totalNpvMarginIncome).toBeCloseTo(0, 10);
    expect(result.netBonusAdjustmentPct).toBeCloseTo(0, 10);
  });

  it('computes discount and NPV correctly for a single payroll attachment', () => {
    const result = calculateCrossBonusAdjustment({
      attachments: [{ ruleId: 'NOMINA' }],
      loanAmount: LOAN,
      loanDurationMonths: DURATION_24Y,
    });

    expect(result.breakdown).toHaveLength(1);
    const row = result.breakdown[0];

    // Expected discount = 25bps × 0.85 = 21.25bps = 0.2125%
    expect(row.expectedDiscountCostPct).toBeCloseTo(0.2125, 6);
    expect(row.effectiveProbability).toBeCloseTo(0.85, 6);

    // NPV ≈ 80 × annuity(24y, 3%) × 0.85
    // annuity(24, 3%) = (1 - 1.03^-24)/0.03 ≈ 16.9355
    // gross NPV ≈ 80 × 16.9355 ≈ 1354.84
    // prob-weighted ≈ 1151.62
    expect(row.npvMarginIncome).toBeGreaterThan(1100);
    expect(row.npvMarginIncome).toBeLessThan(1200);

    expect(result.totalDiscountPct).toBeCloseTo(0.2125, 6);
    expect(result.totalNpvMarginIncome).toBeCloseTo(row.npvMarginIncome, 6);
  });

  it('sums discounts and NPVs across multiple stackable attachments', () => {
    const result = calculateCrossBonusAdjustment({
      attachments: [
        { ruleId: 'NOMINA' },
        { ruleId: 'SEG_HOGAR' },
        { ruleId: 'SEG_VIDA' },
      ],
      loanAmount: LOAN,
      loanDurationMonths: DURATION_24Y,
    });

    expect(result.breakdown).toHaveLength(3);

    // Discounts: 25×0.85 + 10×0.75 + 15×0.65 = 21.25 + 7.5 + 9.75 = 38.5 bps = 0.385%
    expect(result.totalDiscountPct).toBeCloseTo(0.385, 6);

    // Sum of breakdown NPVs equals total
    const summed = result.breakdown.reduce(
      (acc, b) => acc + b.npvMarginIncome,
      0,
    );
    expect(summed).toBeCloseTo(result.totalNpvMarginIncome, 6);
    expect(result.totalNpvMarginIncome).toBeGreaterThan(0);
  });

  it('ignores unknown rule IDs silently', () => {
    const result = calculateCrossBonusAdjustment({
      attachments: [
        { ruleId: 'NOMINA' },
        { ruleId: 'DOES_NOT_EXIST' },
        { ruleId: 'ALSO_UNKNOWN' },
      ],
      loanAmount: LOAN,
      loanDurationMonths: DURATION_24Y,
    });

    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].ruleId).toBe('NOMINA');
  });

  it('applies overrideProbability when provided', () => {
    const result = calculateCrossBonusAdjustment({
      attachments: [{ ruleId: 'NOMINA', overrideProbability: 0.5 }],
      loanAmount: LOAN,
      loanDurationMonths: DURATION_24Y,
    });

    const row = result.breakdown[0];
    expect(row.effectiveProbability).toBeCloseTo(0.5, 6);
    // 25bps × 0.5 = 12.5bps = 0.125%
    expect(row.expectedDiscountCostPct).toBeCloseTo(0.125, 6);
  });

  it('clamps overrideProbability to [0, 1]', () => {
    const over = calculateCrossBonusAdjustment({
      attachments: [{ ruleId: 'NOMINA', overrideProbability: 1.5 }],
      loanAmount: LOAN,
      loanDurationMonths: DURATION_24Y,
    });
    const under = calculateCrossBonusAdjustment({
      attachments: [{ ruleId: 'NOMINA', overrideProbability: -0.2 }],
      loanAmount: LOAN,
      loanDurationMonths: DURATION_24Y,
    });

    expect(over.breakdown[0].effectiveProbability).toBeCloseTo(1, 6);
    expect(under.breakdown[0].effectiveProbability).toBeCloseTo(0, 6);
  });

  it('handles zero loan amount without dividing by zero', () => {
    const result = calculateCrossBonusAdjustment({
      attachments: [{ ruleId: 'NOMINA' }],
      loanAmount: 0,
      loanDurationMonths: DURATION_24Y,
    });

    expect(Number.isFinite(result.netBonusAdjustmentPct)).toBe(true);
    // With zero loan, net contribution defaults to -expectedDiscountCostPct
    expect(result.breakdown[0].netContributionPct).toBeCloseTo(
      -result.breakdown[0].expectedDiscountCostPct,
      6,
    );
  });

  it('handles zero duration — no NPV income, discount still applies', () => {
    const result = calculateCrossBonusAdjustment({
      attachments: [{ ruleId: 'NOMINA' }],
      loanAmount: LOAN,
      loanDurationMonths: 0,
    });

    expect(result.totalNpvMarginIncome).toBeCloseTo(0, 10);
    expect(result.totalDiscountPct).toBeCloseTo(0.2125, 6);
    // Negative net: only cost, no income
    expect(result.netBonusAdjustmentPct).toBeLessThan(0);
  });

  it('accepts a custom catalogue', () => {
    const custom: CrossBonusRule[] = [
      {
        id: 'CUSTOM_RULE',
        productType: 'OTHER',
        label: 'Custom bundle',
        rateDiscountBps: 50,
        annualMarginEur: 500,
        fulfillmentProbability: 1,
        stackable: true,
      },
    ];

    const result = calculateCrossBonusAdjustment({
      attachments: [{ ruleId: 'CUSTOM_RULE' }],
      loanAmount: LOAN,
      loanDurationMonths: DURATION_10Y,
      catalogue: custom,
    });

    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].label).toBe('Custom bundle');
    // 50bps × 1.0 = 0.5%
    expect(result.totalDiscountPct).toBeCloseTo(0.5, 6);
  });

  it('produces a larger NPV for longer durations (all else equal)', () => {
    const short = calculateCrossBonusAdjustment({
      attachments: [{ ruleId: 'NOMINA' }],
      loanAmount: LOAN,
      loanDurationMonths: 60, // 5y
    });
    const long = calculateCrossBonusAdjustment({
      attachments: [{ ruleId: 'NOMINA' }],
      loanAmount: LOAN,
      loanDurationMonths: 360, // 30y
    });

    expect(long.totalNpvMarginIncome).toBeGreaterThan(
      short.totalNpvMarginIncome,
    );
    // Discount probability-weighted bps should be identical (not duration-dependent)
    expect(long.totalDiscountPct).toBeCloseTo(short.totalDiscountPct, 6);
  });

  it('net adjustment is negative when discounts dominate NPV income', () => {
    // Tiny loan + cheap-margin rule → discount cost dominates % of loan
    const heavyDiscountRule: CrossBonusRule[] = [
      {
        id: 'HEAVY',
        productType: 'OTHER',
        label: 'Heavy discount',
        rateDiscountBps: 200,
        annualMarginEur: 10,
        fulfillmentProbability: 1,
      },
    ];

    const result = calculateCrossBonusAdjustment({
      attachments: [{ ruleId: 'HEAVY' }],
      loanAmount: 1_000_000,
      loanDurationMonths: 120,
      catalogue: heavyDiscountRule,
    });

    expect(result.netBonusAdjustmentPct).toBeLessThan(0);
  });

  it('net adjustment is positive when NPV income dominates discounts', () => {
    // Small loan with very high annual margin → income per % of loan is huge
    const richRule: CrossBonusRule[] = [
      {
        id: 'RICH',
        productType: 'OTHER',
        label: 'Rich margin',
        rateDiscountBps: 5,
        annualMarginEur: 5000,
        fulfillmentProbability: 1,
      },
    ];

    const result = calculateCrossBonusAdjustment({
      attachments: [{ ruleId: 'RICH' }],
      loanAmount: 50_000,
      loanDurationMonths: DURATION_24Y,
      catalogue: richRule,
    });

    expect(result.netBonusAdjustmentPct).toBeGreaterThan(0);
  });

  it('handles discountRate = 0 (simple linear annuity)', () => {
    // With 0% discount rate: NPV = annualMargin × years
    const rule: CrossBonusRule[] = [
      {
        id: 'FLAT',
        productType: 'OTHER',
        label: 'Flat',
        rateDiscountBps: 0,
        annualMarginEur: 100,
        fulfillmentProbability: 1,
      },
    ];

    const result = calculateCrossBonusAdjustment({
      attachments: [{ ruleId: 'FLAT' }],
      loanAmount: LOAN,
      loanDurationMonths: 120, // 10y
      discountRate: 0,
      catalogue: rule,
    });

    // NPV = 100 × 10 × 1.0 = 1000
    expect(result.totalNpvMarginIncome).toBeCloseTo(1000, 6);
    expect(result.totalDiscountPct).toBeCloseTo(0, 6);
  });

  it('default catalogue contains the expected core rules', () => {
    const ids = DEFAULT_CROSS_BONUS_CATALOGUE.map((r) => r.id);
    expect(ids).toContain('NOMINA');
    expect(ids).toContain('SEG_HOGAR');
    expect(ids).toContain('SEG_VIDA');
    expect(ids).toContain('PLAN_PENS');
  });
});
