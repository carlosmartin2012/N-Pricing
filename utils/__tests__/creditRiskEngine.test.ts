import { describe, it, expect } from 'vitest';
import {
  classifyAnejoSegment,
  calculateAnejoCreditRisk,
  calculateScenarioWeightedCoverage,
  calculateMigrationCost,
  calculateELLifetime,
  calculateFullCreditRisk,
  calculateEAD,
  backtestCreditRisk,
  type CreditRiskInput,
  type ForwardLookingInput,
  type BacktestRecord,
} from '../pricing/creditRiskEngine';
import { DEFAULT_MACRO_SCENARIOS, CCF_TABLE, type MacroScenario } from '../../constants/anejoIX';

// ── Segment classification ───────────────────────────────────────────────────

describe('classifyAnejoSegment', () => {
  it('classifies mortgage with low LTV (≤ 80%)', () => {
    expect(classifyAnejoSegment('Mortgage Loan', 'Retail', 0.70)).toBe('MORTGAGE_LOW_LTV');
    expect(classifyAnejoSegment('Hipoteca', 'Retail', 0.80)).toBe('MORTGAGE_LOW_LTV');
  });

  it('classifies mortgage with high LTV (> 80%)', () => {
    expect(classifyAnejoSegment('Mortgage Loan', 'Retail', 0.85)).toBe('MORTGAGE_HIGH_LTV');
    expect(classifyAnejoSegment('hipoteca variable', 'Retail', 0.95)).toBe('MORTGAGE_HIGH_LTV');
  });

  it('classifies consumer products', () => {
    expect(classifyAnejoSegment('Consumer Loan', 'Retail')).toBe('CONSUMER');
    expect(classifyAnejoSegment('Préstamo Consumo', 'Retail')).toBe('CONSUMER');
    expect(classifyAnejoSegment('Personal Loan', 'Retail')).toBe('CONSUMER');
  });

  it('classifies credit cards', () => {
    expect(classifyAnejoSegment('Credit Card', 'Retail')).toBe('CREDIT_CARDS');
    expect(classifyAnejoSegment('Tarjeta Revolving', 'Retail')).toBe('CREDIT_CARDS');
  });

  it('classifies large corporate by client type', () => {
    expect(classifyAnejoSegment('Term Loan', 'Corporate')).toBe('LARGE_CORPORATE');
  });

  it('classifies SME by client type', () => {
    expect(classifyAnejoSegment('Working Capital', 'SME')).toBe('SME');
    expect(classifyAnejoSegment('Línea de crédito', 'PYME')).toBe('SME');
  });

  it('classifies public sector', () => {
    expect(classifyAnejoSegment('Term Loan', 'Gov')).toBe('PUBLIC_SECTOR');
    expect(classifyAnejoSegment('Bond', 'Public Sector')).toBe('PUBLIC_SECTOR');
    expect(classifyAnejoSegment('Syndicated', 'Institution')).toBe('PUBLIC_SECTOR');
  });

  it('classifies retail client as CONSUMER', () => {
    expect(classifyAnejoSegment('Generic Product', 'Retail')).toBe('CONSUMER');
  });

  it('falls back to OTHER for unknown combos', () => {
    expect(classifyAnejoSegment('Unknown Product', 'Unknown Client')).toBe('OTHER');
  });
});

// ── Expected-loss calculation ────────────────────────────────────────────────

describe('calculateAnejoCreditRisk', () => {
  it('corporate loan 1M, no collateral → 0.6% coverage', () => {
    const input: CreditRiskInput = {
      productType: 'Term Loan',
      clientType: 'Corporate',
      amount: 1_000_000,
      ltvPct: 0,
      collateralType: 'None',
      collateralValue: 0,
    };

    const result = calculateAnejoCreditRisk(input);

    expect(result.anejoSegment).toBe('LARGE_CORPORATE');
    expect(result.stage).toBe(1);
    expect(result.grossExposure).toBe(1_000_000);
    expect(result.effectiveGuarantee).toBe(0);
    expect(result.netExposure).toBe(1_000_000);
    expect(result.coveragePct).toBeCloseTo(0.6, 2);
    expect(result.el12m).toBeCloseTo(6_000, 0);
    expect(result.creditCostAnnualPct).toBeCloseTo(0.6, 2);
  });

  it('mortgage 200k, collateral 285,714 (LTV 70%, RESIDENTIAL_FINISHED haircut 25%) → full cover → el12m = 0', () => {
    const input: CreditRiskInput = {
      productType: 'Mortgage Loan',
      clientType: 'Retail',
      amount: 200_000,
      ltvPct: 0.70,
      collateralType: 'RESIDENTIAL_FINISHED',
      collateralValue: 285_714,
    };

    const result = calculateAnejoCreditRisk(input);

    expect(result.anejoSegment).toBe('MORTGAGE_LOW_LTV');
    expect(result.grossExposure).toBe(200_000);
    // adjustedValue = 285,714 * (1 - 0.25) = 214,285.50, capped at 200,000
    expect(result.effectiveGuarantee).toBe(200_000);
    expect(result.netExposure).toBe(0);
    expect(result.el12m).toBe(0);
    expect(result.creditCostAnnualPct).toBeCloseTo(0, 2);
  });

  it('consumer 30k, no collateral → 1.8% → el12m = 540', () => {
    const input: CreditRiskInput = {
      productType: 'Consumer Loan',
      clientType: 'Retail',
      amount: 30_000,
      ltvPct: 0,
      collateralType: 'None',
      collateralValue: 0,
    };

    const result = calculateAnejoCreditRisk(input);

    expect(result.anejoSegment).toBe('CONSUMER');
    expect(result.grossExposure).toBe(30_000);
    expect(result.effectiveGuarantee).toBe(0);
    expect(result.netExposure).toBe(30_000);
    expect(result.coveragePct).toBeCloseTo(1.8, 2);
    expect(result.el12m).toBeCloseTo(540, 0);
    expect(result.creditCostAnnualPct).toBeCloseTo(1.8, 2);
  });

  it('public sector → 0% coverage → el12m = 0', () => {
    const input: CreditRiskInput = {
      productType: 'Government Bond',
      clientType: 'Gov',
      amount: 5_000_000,
      ltvPct: 0,
      collateralType: 'None',
      collateralValue: 0,
    };

    const result = calculateAnejoCreditRisk(input);

    expect(result.anejoSegment).toBe('PUBLIC_SECTOR');
    expect(result.grossExposure).toBe(5_000_000);
    expect(result.coveragePct).toBeCloseTo(0, 2);
    expect(result.el12m).toBe(0);
    expect(result.creditCostAnnualPct).toBeCloseTo(0, 2);
  });

  it('guards division by zero when amount is 0', () => {
    const input: CreditRiskInput = {
      productType: 'Term Loan',
      clientType: 'Corporate',
      amount: 0,
      ltvPct: 0,
      collateralType: 'None',
      collateralValue: 0,
    };

    const result = calculateAnejoCreditRisk(input);

    expect(result.grossExposure).toBe(0);
    expect(result.creditCostAnnualPct).toBe(0);
  });

  it('applies default haircut (40%) when collateral type is unknown', () => {
    const input: CreditRiskInput = {
      productType: 'Term Loan',
      clientType: 'SME',
      amount: 500_000,
      ltvPct: 0,
      collateralType: 'MACHINERY',
      collateralValue: 300_000,
    };

    const result = calculateAnejoCreditRisk(input);

    expect(result.anejoSegment).toBe('SME');
    // adjustedValue = 300,000 * (1 - 0.40) = 180,000
    expect(result.effectiveGuarantee).toBe(180_000);
    expect(result.netExposure).toBe(320_000);
    expect(result.el12m).toBeCloseTo(3_520, 0);
    expect(result.coveragePct).toBeCloseTo(1.1, 2);
  });
});

// ── Sprint 2: Differentiated guarantee treatment ────────────────────────────

describe('guarantee types (Sprint 2)', () => {
  it('FINANCIAL_PLEDGE: near-full deduction (2% haircut)', () => {
    const result = calculateAnejoCreditRisk({
      productType: 'Term Loan',
      clientType: 'Corporate',
      amount: 1_000_000,
      ltvPct: 0,
      collateralType: 'cash_deposit',
      collateralValue: 1_000_000,
      guaranteeType: 'FINANCIAL_PLEDGE',
    });

    // 1M × (1 - 0.02) = 980,000 guarantee
    expect(result.effectiveGuarantee).toBe(980_000);
    expect(result.netExposure).toBe(20_000);
    expect(result.el12m).toBeCloseTo(120, 0); // 20k × 0.6%
  });

  it('PUBLIC_GUARANTEE: nets at publicGuaranteePct', () => {
    const result = calculateAnejoCreditRisk({
      productType: 'Term Loan',
      clientType: 'SME',
      amount: 500_000,
      ltvPct: 0,
      collateralType: 'None',
      collateralValue: 0,
      guaranteeType: 'PUBLIC_GUARANTEE',
      publicGuaranteePct: 0.80, // ICO 80%
    });

    // 500k × 80% = 400k guaranteed
    expect(result.effectiveGuarantee).toBe(400_000);
    expect(result.netExposure).toBe(100_000);
    expect(result.el12m).toBeCloseTo(1_100, 0); // 100k × 1.1%
  });

  it('PERSONAL_GUARANTEE: 50% of collateral value', () => {
    const result = calculateAnejoCreditRisk({
      productType: 'Term Loan',
      clientType: 'SME',
      amount: 200_000,
      ltvPct: 0,
      collateralType: 'None',
      collateralValue: 200_000,
      guaranteeType: 'PERSONAL_GUARANTEE',
    });

    // 200k × 50% = 100k
    expect(result.effectiveGuarantee).toBe(100_000);
    expect(result.netExposure).toBe(100_000);
  });

  it('MORTGAGE with appraisal aging discount (2 years old)', () => {
    const result = calculateAnejoCreditRisk({
      productType: 'Mortgage',
      clientType: 'Retail',
      amount: 200_000,
      ltvPct: 0.70,
      collateralType: 'RESIDENTIAL_FINISHED',
      collateralValue: 285_714,
      guaranteeType: 'MORTGAGE',
      appraisalAgeMonths: 20, // 20 months → 95% factor
    });

    expect(result.anejoSegment).toBe('MORTGAGE_LOW_LTV');
    // adjusted = 285,714 × (1-0.25) × 0.95 = 285,714 × 0.75 × 0.95 = 203,571
    // LTV cap: 285,714 × 0.80 = 228,571
    // cappedGuarantee = min(203,571, 228,571, 200,000) = 200,000
    expect(result.effectiveGuarantee).toBe(200_000);
    expect(result.netExposure).toBe(0);
  });

  it('MORTGAGE with stale appraisal (> 3 years)', () => {
    const result = calculateAnejoCreditRisk({
      productType: 'Mortgage',
      clientType: 'Retail',
      amount: 200_000,
      ltvPct: 0.70,
      collateralType: 'RESIDENTIAL_FINISHED',
      collateralValue: 285_714,
      guaranteeType: 'MORTGAGE',
      appraisalAgeMonths: 48, // stale → 0.85 factor
    });

    // adjusted = 285,714 × 0.75 × 0.85 = 182,142
    // LTV cap: 285,714 × 0.80 = 228,571
    // cappedGuarantee = min(182,142, 228,571, 200,000) = 182,142
    expect(result.effectiveGuarantee).toBeCloseTo(182_142, -1);
    expect(result.netExposure).toBeCloseTo(17_858, -1);
  });

  it('MORTGAGE LTV cap limits guarantee to 80% of property value', () => {
    const result = calculateAnejoCreditRisk({
      productType: 'Mortgage',
      clientType: 'Retail',
      amount: 250_000,
      ltvPct: 0.95,
      collateralType: 'RESIDENTIAL_FINISHED',
      collateralValue: 263_158, // 250k / 0.95
      guaranteeType: 'MORTGAGE',
      appraisalAgeMonths: 6,
    });

    expect(result.anejoSegment).toBe('MORTGAGE_HIGH_LTV');
    // adjusted = 263,158 × 0.75 × 1.00 = 197,368
    // LTV cap: 263,158 × 0.80 = 210,526
    // cappedGuarantee = min(197,368, 210,526, 250,000) = 197,368
    expect(result.effectiveGuarantee).toBeCloseTo(197_368, -1);
    // netExposure = 250,000 - 197,368 = 52,632
    expect(result.netExposure).toBeCloseTo(52_632, -1);
  });

  it('infers PUBLIC_GUARANTEE from Sovereign collateralType', () => {
    const result = calculateAnejoCreditRisk({
      productType: 'Term Loan',
      clientType: 'SME',
      amount: 100_000,
      ltvPct: 0,
      collateralType: 'Sovereign',
      collateralValue: 0,
      // No guaranteeType specified — should infer PUBLIC_GUARANTEE
      publicGuaranteePct: 0.70,
    });

    // Inferred as PUBLIC: 100k × 70% = 70k
    expect(result.effectiveGuarantee).toBe(70_000);
    expect(result.netExposure).toBe(30_000);
  });
});

// ── Sprint 3: Forward-looking & migration ──────────────────────────────────

describe('forward-looking & migration (Sprint 3)', () => {
  it('scenario weighting increases coverage under default scenario mix', () => {
    // LARGE_CORPORATE base coverage = 0.6%
    // Weighted: 0.55×0.6×1.0 + 0.20×0.6×0.85 + 0.20×0.6×1.30 + 0.05×0.6×1.80
    // = 0.330 + 0.102 + 0.156 + 0.054 = 0.642
    const result = calculateScenarioWeightedCoverage(0.6, DEFAULT_MACRO_SCENARIOS);
    expect(result).toBeCloseTo(0.642, 3);
    // Weighted coverage > base because pessimistic + severe outweigh optimistic
    expect(result).toBeGreaterThan(0.6);
  });

  it('scenario weighting with pure optimistic returns lower coverage', () => {
    const optimisticOnly: MacroScenario[] = [
      { id: 'optimistic', label: 'Optimistic', weight: 1.0, coverageAdjustmentFactor: 0.85, migrationAdjustmentFactor: 0.75 },
    ];
    const result = calculateScenarioWeightedCoverage(1.1, optimisticOnly);
    // 1.1 × 0.85 = 0.935
    expect(result).toBeCloseTo(0.935, 3);
    expect(result).toBeLessThan(1.1);
  });

  it('calculates migration probabilities for corporate segment', () => {
    // P(S1→S2) for LARGE_CORPORATE base = 0.03
    const { pMigrateS2, pMigrateS3 } = calculateMigrationCost(
      'LARGE_CORPORATE',
      1_000_000,
      DEFAULT_MACRO_SCENARIOS,
    );
    expect(pMigrateS2).toBeCloseTo(0.03, 2);
    expect(pMigrateS3).toBeCloseTo(0.20, 2);
  });

  it('calculates migration cost as annual expected loss from stage transitions', () => {
    const { migrationCostAnnual } = calculateMigrationCost(
      'LARGE_CORPORATE',
      1_000_000,
      DEFAULT_MACRO_SCENARIOS,
    );
    // migrationCostAnnual should be > 0 for performing exposures
    expect(migrationCostAnnual).toBeGreaterThan(0);

    // With pure base scenario (factor=1.0):
    // P(S1→S2) = 0.03, coverageS2=15%, coverageS1=0.6%
    // costS1toS2 = 0.03 × (15-0.6)/100 × 1M = 0.03 × 0.144 × 1M = 4,320
    // P(S2→S3) = 0.20, avgS3=60%
    // costS1toS3 = 0.03 × 0.20 × (60-0.6)/100 × 1M = 0.006 × 0.594 × 1M = 3,564
    // total = 7,884
    const baseOnly: MacroScenario[] = [
      { id: 'base', label: 'Base', weight: 1.0, coverageAdjustmentFactor: 1.0, migrationAdjustmentFactor: 1.0 },
    ];
    const { migrationCostAnnual: baseMigCost } = calculateMigrationCost(
      'LARGE_CORPORATE',
      1_000_000,
      baseOnly,
    );
    expect(baseMigCost).toBeCloseTo(7_884, -1);
  });

  it('calculates EL lifetime as annual × duration', () => {
    // 6,000 annual × 5 years = 30,000
    const result = calculateELLifetime(6_000, 60);
    expect(result).toBeCloseTo(30_000, 0);
  });

  it('caps EL lifetime duration at 30 years', () => {
    const result = calculateELLifetime(1_000, 600); // 50 years
    // Capped at 30 years: 1,000 × 30 = 30,000
    expect(result).toBeCloseTo(30_000, 0);
  });

  it('calculateFullCreditRisk includes all Sprint 3 fields', () => {
    const result = calculateFullCreditRisk({
      productType: 'Term Loan',
      clientType: 'Corporate',
      amount: 1_000_000,
      ltvPct: 0,
      collateralType: 'None',
      collateralValue: 0,
      durationMonths: 60,
    });

    expect(result.anejoSegment).toBe('LARGE_CORPORATE');
    expect(result.stage).toBe(1);
    expect(result.grossExposure).toBe(1_000_000);
    expect(result.netExposure).toBe(1_000_000);

    // Sprint 3 fields
    expect(result.day1Provision).toBeGreaterThan(0);
    expect(result.day1Provision).toBeDefined();
    expect(result.elLifetime).toBeGreaterThan(result.el12m);
    expect(result.migrationCostAnnual).toBeGreaterThan(0);
    expect(result.pMigrateS2).toBeCloseTo(0.03, 2); // base probability for LARGE_CORPORATE
    expect(result.pMigrateS3).toBeCloseTo(0.20, 2);
    expect(result.scenarioWeightedCoveragePct).toBeDefined();
    expect(result.scenarioWeightedCoveragePct!).toBeGreaterThan(0);

    // creditCostAnnualPct should be higher than base 0.6% due to migration + scenario
    expect(result.creditCostAnnualPct).toBeGreaterThan(0.6);
  });

  it('severe scenario increases credit cost significantly', () => {
    const severeOnly: MacroScenario[] = [
      { id: 'severe', label: 'Severe', weight: 1.0, coverageAdjustmentFactor: 1.80, migrationAdjustmentFactor: 2.50 },
    ];

    const baseInput = {
      productType: 'Term Loan',
      clientType: 'Corporate',
      amount: 1_000_000,
      ltvPct: 0,
      collateralType: 'None',
      collateralValue: 0,
      durationMonths: 60,
    };

    const base = calculateFullCreditRisk(baseInput);
    const severe = calculateFullCreditRisk({ ...baseInput, scenarios: severeOnly });

    expect(severe.creditCostAnnualPct).toBeGreaterThan(base.creditCostAnnualPct);
    expect(severe.day1Provision!).toBeGreaterThan(base.day1Provision!);
    expect(severe.migrationCostAnnual!).toBeGreaterThan(base.migrationCostAnnual!);
    expect(severe.elLifetime!).toBeGreaterThan(base.elLifetime!);
  });

  it('zero-amount deal returns zero for all Sprint 3 fields', () => {
    const result = calculateFullCreditRisk({
      productType: 'Term Loan',
      clientType: 'Corporate',
      amount: 0,
      ltvPct: 0,
      collateralType: 'None',
      collateralValue: 0,
      durationMonths: 60,
    });

    expect(result.grossExposure).toBe(0);
    expect(result.creditCostAnnualPct).toBe(0);
    expect(result.day1Provision).toBe(0);
    expect(result.elLifetime).toBe(0);
    expect(result.migrationCostAnnual).toBe(0);
  });

  it('public sector has minimal migration cost due to low probabilities', () => {
    const result = calculateFullCreditRisk({
      productType: 'Government Bond',
      clientType: 'Gov',
      amount: 5_000_000,
      ltvPct: 0,
      collateralType: 'None',
      collateralValue: 0,
      durationMonths: 120,
    });

    expect(result.anejoSegment).toBe('PUBLIC_SECTOR');
    expect(result.pMigrateS2).toBeCloseTo(0.01, 2);
    // Stage 1 coverage is 0% for public sector, but migration still has a cost
    // because Stage 2 coverage (3%) > Stage 1 coverage (0%)
    expect(result.migrationCostAnnual).toBeGreaterThan(0);
  });
});

// ── Sprint 4: Mirror mode + capital params ──────────────────────────────────

describe('Sprint 4: mirror mode + capital params', () => {
  it('mirror mode uses external PD/LGD instead of Anejo IX coverage', () => {
    const result = calculateFullCreditRisk({
      productType: 'Term Loan',
      clientType: 'Corporate',
      amount: 1_000_000,
      ltvPct: 0,
      collateralType: 'None',
      collateralValue: 0,
      durationMonths: 60,
      mode: 'mirror',
      externalPd12m: 0.005, // 0.5%
      externalLgd: 0.45,    // 45%
    });

    expect(result.mode).toBe('mirror');
    // EL = PD × LGD × EAD = 0.005 × 0.45 × 1M = 2,250
    expect(result.el12m).toBeCloseTo(2_250, 0);
    expect(result.creditCostAnnualPct).toBeGreaterThan(0);
  });

  it('native mode is unchanged (default)', () => {
    const result = calculateFullCreditRisk({
      productType: 'Term Loan',
      clientType: 'Corporate',
      amount: 1_000_000,
      ltvPct: 0,
      collateralType: 'None',
      collateralValue: 0,
      durationMonths: 60,
    });
    expect(result.mode).toBe('native');
    // Should use Anejo IX coverage, not PD×LGD
    expect(result.anejoSegment).toBe('LARGE_CORPORATE');
    expect(result.el12m).toBeCloseTo(6_000, 0); // 0.6% of 1M
  });

  it('produces capitalParams with PD floor applied', () => {
    const result = calculateFullCreditRisk({
      productType: 'Term Loan',
      clientType: 'Corporate',
      amount: 1_000_000,
      ltvPct: 0,
      collateralType: 'None',
      collateralValue: 0,
      durationMonths: 60,
    });

    expect(result.capitalParams).toBeDefined();
    expect(result.capitalParams!.pd).toBeGreaterThanOrEqual(0.0003); // CRR3 floor
    expect(result.capitalParams!.lgd).toBeCloseTo(0.40, 2); // F-IRB unsecured
    expect(result.capitalParams!.ead).toBe(1_000_000);
    expect(result.capitalParams!.maturityYears).toBeCloseTo(5, 1);
    expect(result.capitalParams!.exposureClass).toBe('CORPORATE');
  });

  it('mortgage gets RETAIL_MORTGAGE exposure class and secured LGD', () => {
    const result = calculateFullCreditRisk({
      productType: 'Mortgage',
      clientType: 'Retail',
      amount: 200_000,
      ltvPct: 0.70,
      collateralType: 'RESIDENTIAL_FINISHED',
      collateralValue: 285_714,
      durationMonths: 240,
      guaranteeType: 'MORTGAGE',
    });

    expect(result.capitalParams!.exposureClass).toBe('RETAIL_MORTGAGE');
    expect(result.capitalParams!.lgd).toBeCloseTo(0.20, 2); // secured
    expect(result.capitalParams!.maturityYears).toBeCloseTo(20, 1);
  });

  it('credit cards get retail PD floor (5 bps) since exposure class is RETAIL_OTHER', () => {
    const result = calculateFullCreditRisk({
      productType: 'Credit Card',
      clientType: 'Retail',
      amount: 10_000,
      ltvPct: 0,
      collateralType: 'None',
      collateralValue: 0,
      durationMonths: 12,
    });

    expect(result.capitalParams!.exposureClass).toBe('RETAIL_OTHER');
    // CREDIT_CARDS segment gets QRRE PD floor of 10 bps (0.0010)
    // But Anejo IX coverage for CREDIT_CARDS is 1.0% = 0.01, which is above the floor
    expect(result.capitalParams!.pd).toBeGreaterThanOrEqual(0.0010); // QRRE floor
  });

  it('mirror mode with external EAD override', () => {
    const result = calculateFullCreditRisk({
      productType: 'Credit Line',
      clientType: 'Corporate',
      amount: 500_000, // drawn
      ltvPct: 0,
      collateralType: 'None',
      collateralValue: 0,
      durationMonths: 36,
      mode: 'mirror',
      externalPd12m: 0.01,
      externalLgd: 0.45,
      externalEad: 800_000, // drawn + CCF × undrawn
    });

    expect(result.capitalParams!.ead).toBe(800_000);
    // EL uses externalEad: 0.01 × 0.45 × 800,000 = 3,600
    expect(result.el12m).toBeCloseTo(3_600, 0);
  });

  it('capital params PD uses coverage proxy for native mode', () => {
    // LARGE_CORPORATE: stage1Coverage = 0.6%, so PD proxy = 0.006
    // CRR3 floor for corporate = 0.0003
    // max(0.006, 0.0003) = 0.006
    const result = calculateFullCreditRisk({
      productType: 'Term Loan',
      clientType: 'Corporate',
      amount: 1_000_000,
      ltvPct: 0,
      collateralType: 'None',
      collateralValue: 0,
      durationMonths: 60,
    });

    expect(result.capitalParams!.pd).toBeCloseTo(0.006, 4);
  });

  it('public sector gets SOVEREIGN exposure class with PD floor', () => {
    const result = calculateFullCreditRisk({
      productType: 'Government Bond',
      clientType: 'Gov',
      amount: 5_000_000,
      ltvPct: 0,
      collateralType: 'None',
      collateralValue: 0,
      durationMonths: 120,
    });

    expect(result.capitalParams!.exposureClass).toBe('SOVEREIGN');
    // PUBLIC_SECTOR coverage = 0%, so PD proxy = 0. Floor = 0.0003
    expect(result.capitalParams!.pd).toBeCloseTo(0.0003, 4);
    expect(result.capitalParams!.lgd).toBeCloseTo(0.40, 2); // unsecured sovereign
  });

  it('SME segment gets SME exposure class', () => {
    const result = calculateFullCreditRisk({
      productType: 'Working Capital',
      clientType: 'SME',
      amount: 300_000,
      ltvPct: 0,
      collateralType: 'None',
      collateralValue: 0,
      durationMonths: 24,
    });

    expect(result.capitalParams!.exposureClass).toBe('SME');
    expect(result.capitalParams!.maturityYears).toBeCloseTo(2, 1);
  });

  it('mirror mode with zero external PD/LGD returns zero EL', () => {
    const result = calculateFullCreditRisk({
      productType: 'Term Loan',
      clientType: 'Corporate',
      amount: 1_000_000,
      ltvPct: 0,
      collateralType: 'None',
      collateralValue: 0,
      durationMonths: 60,
      mode: 'mirror',
      externalPd12m: 0,
      externalLgd: 0,
    });

    expect(result.mode).toBe('mirror');
    expect(result.el12m).toBe(0);
    // Capital params PD still gets floored
    expect(result.capitalParams!.pd).toBeCloseTo(0.0003, 4);
  });

  it('mirror mode still classifies segment for reporting', () => {
    const result = calculateFullCreditRisk({
      productType: 'Mortgage',
      clientType: 'Retail',
      amount: 200_000,
      ltvPct: 0.70,
      collateralType: 'RESIDENTIAL_FINISHED',
      collateralValue: 285_714,
      durationMonths: 240,
      guaranteeType: 'MORTGAGE',
      mode: 'mirror',
      externalPd12m: 0.003,
      externalLgd: 0.20,
    });

    expect(result.mode).toBe('mirror');
    expect(result.anejoSegment).toBe('MORTGAGE_LOW_LTV');
    expect(result.capitalParams!.exposureClass).toBe('RETAIL_MORTGAGE');
    expect(result.capitalParams!.lgd).toBeCloseTo(0.20, 2); // uses external LGD
  });

  it('mirror mode still calculates guarantee netting', () => {
    const result = calculateFullCreditRisk({
      productType: 'Term Loan',
      clientType: 'Corporate',
      amount: 1_000_000,
      ltvPct: 0,
      collateralType: 'cash_deposit',
      collateralValue: 500_000,
      guaranteeType: 'FINANCIAL_PLEDGE',
      durationMonths: 60,
      mode: 'mirror',
      externalPd12m: 0.01,
      externalLgd: 0.45,
    });

    expect(result.mode).toBe('mirror');
    // Financial pledge: 500k × (1-0.02) = 490k guarantee
    expect(result.effectiveGuarantee).toBe(490_000);
    expect(result.netExposure).toBe(510_000);
  });

  it('backward compatibility: existing calls without mode work unchanged', () => {
    const result = calculateFullCreditRisk({
      productType: 'Consumer Loan',
      clientType: 'Retail',
      amount: 30_000,
      ltvPct: 0,
      collateralType: 'None',
      collateralValue: 0,
      durationMonths: 36,
    });

    expect(result.mode).toBe('native');
    expect(result.anejoSegment).toBe('CONSUMER');
    expect(result.el12m).toBeCloseTo(540, 0); // 1.8% of 30k
    expect(result.capitalParams).toBeDefined();
    expect(result.capitalParams!.exposureClass).toBe('RETAIL_OTHER');
    // All Sprint 3 fields still present
    expect(result.day1Provision).toBeDefined();
    expect(result.elLifetime).toBeDefined();
    expect(result.migrationCostAnnual).toBeDefined();
  });
});

// ── Sprint 5: CCF / EAD calculation ────────────────────────────────────────

describe('Sprint 5: calculateEAD', () => {
  const baseInput: ForwardLookingInput = {
    productType: 'Credit Line',
    clientType: 'Corporate',
    amount: 300_000, // drawn
    ltvPct: 0,
    collateralType: 'None',
    collateralValue: 0,
    durationMonths: 36,
  };

  it('returns drawn amount when no undrawn amount', () => {
    const result = calculateEAD(baseInput);
    expect(result).toBe(300_000);
  });

  it('returns drawn amount when undrawnAmount is 0', () => {
    const result = calculateEAD({ ...baseInput, undrawnAmount: 0 });
    expect(result).toBe(300_000);
  });

  it('applies OTHER_COMMITMENT CCF (40%) by default for undrawn', () => {
    const result = calculateEAD({ ...baseInput, undrawnAmount: 200_000 });
    // 300,000 + 0.40 × 200,000 = 380,000
    expect(result).toBeCloseTo(380_000, 0);
  });

  it('applies UCC CCF (10%) for unconditionally cancellable commitments', () => {
    const result = calculateEAD({ ...baseInput, undrawnAmount: 500_000, ccfType: 'UCC' });
    // 300,000 + 0.10 × 500,000 = 350,000
    expect(result).toBeCloseTo(350_000, 0);
  });

  it('applies TRADE_FINANCE CCF (20%)', () => {
    const result = calculateEAD({ ...baseInput, undrawnAmount: 400_000, ccfType: 'TRADE_FINANCE' });
    // 300,000 + 0.20 × 400,000 = 380,000
    expect(result).toBeCloseTo(380_000, 0);
  });

  it('applies NIF_RUF CCF (50%)', () => {
    const result = calculateEAD({ ...baseInput, undrawnAmount: 200_000, ccfType: 'NIF_RUF' });
    // 300,000 + 0.50 × 200,000 = 400,000
    expect(result).toBeCloseTo(400_000, 0);
  });

  it('applies DIRECT_SUBSTITUTE CCF (100%)', () => {
    const result = calculateEAD({ ...baseInput, undrawnAmount: 200_000, ccfType: 'DIRECT_SUBSTITUTE' });
    // 300,000 + 1.00 × 200,000 = 500,000
    expect(result).toBeCloseTo(500_000, 0);
  });

  it('applies PERFORMANCE_BOND CCF (50%)', () => {
    const result = calculateEAD({ ...baseInput, undrawnAmount: 100_000, ccfType: 'PERFORMANCE_BOND' });
    // 300,000 + 0.50 × 100,000 = 350,000
    expect(result).toBeCloseTo(350_000, 0);
  });

  it('falls back to 40% CCF for unknown ccfType', () => {
    const result = calculateEAD({ ...baseInput, undrawnAmount: 100_000, ccfType: 'UNKNOWN_TYPE' });
    // 300,000 + 0.40 × 100,000 = 340,000
    expect(result).toBeCloseTo(340_000, 0);
  });

  it('stresses CCF by 1.5x when utilization > 90%', () => {
    // OTHER_COMMITMENT CCF = 0.40, stressed = 0.60
    const result = calculateEAD({
      ...baseInput,
      undrawnAmount: 200_000,
      utilizationRate: 0.95,
    });
    // 300,000 + 0.60 × 200,000 = 420,000
    expect(result).toBeCloseTo(420_000, 0);
  });

  it('caps stressed CCF at 1.0', () => {
    // NIF_RUF CCF = 0.50, stressed = 0.75 (still < 1.0, no cap)
    const r1 = calculateEAD({
      ...baseInput,
      undrawnAmount: 200_000,
      ccfType: 'NIF_RUF',
      utilizationRate: 0.95,
    });
    // 0.50 × 1.5 = 0.75, 300,000 + 0.75 × 200,000 = 450,000
    expect(r1).toBeCloseTo(450_000, 0);

    // DIRECT_SUBSTITUTE CCF = 1.00, stressed = 1.50 → capped at 1.0
    const r2 = calculateEAD({
      ...baseInput,
      undrawnAmount: 200_000,
      ccfType: 'DIRECT_SUBSTITUTE',
      utilizationRate: 0.95,
    });
    // min(1.00 × 1.5, 1.0) = 1.0, 300,000 + 1.0 × 200,000 = 500,000
    expect(r2).toBeCloseTo(500_000, 0);
  });

  it('does NOT stress when utilization is exactly 90%', () => {
    const result = calculateEAD({
      ...baseInput,
      undrawnAmount: 200_000,
      utilizationRate: 0.90,
    });
    // No stress: 300,000 + 0.40 × 200,000 = 380,000
    expect(result).toBeCloseTo(380_000, 0);
  });

  it('does NOT stress when utilizationRate is undefined', () => {
    const result = calculateEAD({
      ...baseInput,
      undrawnAmount: 200_000,
    });
    // No stress: 300,000 + 0.40 × 200,000 = 380,000
    expect(result).toBeCloseTo(380_000, 0);
  });
});

// ── Sprint 5: EAD integration in full credit risk ──────────────────────────

describe('Sprint 5: EAD integration in calculateFullCreditRisk', () => {
  it('uses EAD as grossExposure when undrawnAmount > 0', () => {
    const result = calculateFullCreditRisk({
      productType: 'Credit Line',
      clientType: 'Corporate',
      amount: 300_000, // drawn
      undrawnAmount: 200_000,
      ltvPct: 0,
      collateralType: 'None',
      collateralValue: 0,
      durationMonths: 36,
    });

    // EAD = 300,000 + 0.40 × 200,000 = 380,000
    expect(result.grossExposure).toBeCloseTo(380_000, 0);
    expect(result.netExposure).toBeCloseTo(380_000, 0);
    // Coverage 0.6% on 380k → el12m = 2,280
    expect(result.el12m).toBeCloseTo(2_280, 0);
  });

  it('capitalParams.ead reflects calculated EAD with undrawn', () => {
    const result = calculateFullCreditRisk({
      productType: 'Credit Line',
      clientType: 'SME',
      amount: 400_000,
      undrawnAmount: 600_000,
      ccfType: 'OTHER_COMMITMENT',
      ltvPct: 0,
      collateralType: 'None',
      collateralValue: 0,
      durationMonths: 24,
    });

    // EAD = 400,000 + 0.40 × 600,000 = 640,000
    expect(result.capitalParams!.ead).toBeCloseTo(640_000, 0);
  });

  it('backward compatibility: no undrawnAmount works as before', () => {
    const result = calculateFullCreditRisk({
      productType: 'Term Loan',
      clientType: 'Corporate',
      amount: 1_000_000,
      ltvPct: 0,
      collateralType: 'None',
      collateralValue: 0,
      durationMonths: 60,
    });

    expect(result.grossExposure).toBe(1_000_000);
    expect(result.el12m).toBeCloseTo(6_000, 0);
    expect(result.mode).toBe('native');
  });

  it('high-utilization revolving increases grossExposure via stressed CCF', () => {
    const normal = calculateFullCreditRisk({
      productType: 'Credit Card',
      clientType: 'Retail',
      amount: 9_000, // drawn
      undrawnAmount: 1_000,
      utilizationRate: 0.80, // below threshold
      ltvPct: 0,
      collateralType: 'None',
      collateralValue: 0,
      durationMonths: 12,
    });

    const stressed = calculateFullCreditRisk({
      productType: 'Credit Card',
      clientType: 'Retail',
      amount: 9_000,
      undrawnAmount: 1_000,
      utilizationRate: 0.95, // above 90%
      ltvPct: 0,
      collateralType: 'None',
      collateralValue: 0,
      durationMonths: 12,
    });

    // Stressed CCF should give higher grossExposure
    expect(stressed.grossExposure).toBeGreaterThan(normal.grossExposure);
  });
});

// ── Sprint 5: Backtesting ──────────────────────────────────────────────────

describe('Sprint 5: backtestCreditRisk', () => {
  it('returns empty result for empty records', () => {
    const result = backtestCreditRisk([]);

    expect(result.totalDeals).toBe(0);
    expect(result.defaultedDeals).toBe(0);
    expect(result.observedDefaultRate).toBe(0);
    expect(result.predictedDefaultRate).toBe(0);
    expect(result.totalPredictedEL).toBe(0);
    expect(result.totalActualLoss).toBe(0);
    expect(result.elAccuracyRatio).toBe(0);
    expect(Object.keys(result.bySegment)).toHaveLength(0);
  });

  it('perfect prediction: ratio = 1.0', () => {
    const records: BacktestRecord[] = [
      { dealId: 'D1', originationDate: '2024-01-01', segment: 'LARGE_CORPORATE', predictedEL: 6_000, actualLoss: 6_000, predictedCoverage: 0.6, actualDefault: false },
      { dealId: 'D2', originationDate: '2024-01-01', segment: 'LARGE_CORPORATE', predictedEL: 6_000, actualLoss: 6_000, predictedCoverage: 0.6, actualDefault: false },
    ];

    const result = backtestCreditRisk(records);

    expect(result.totalDeals).toBe(2);
    expect(result.totalPredictedEL).toBeCloseTo(12_000, 0);
    expect(result.totalActualLoss).toBeCloseTo(12_000, 0);
    expect(result.elAccuracyRatio).toBeCloseTo(1.0, 4);
  });

  it('overprediction: ratio < 1.0 (conservative model)', () => {
    const records: BacktestRecord[] = [
      { dealId: 'D1', originationDate: '2024-01-01', segment: 'SME', predictedEL: 10_000, actualLoss: 5_000, predictedCoverage: 1.1, actualDefault: false },
      { dealId: 'D2', originationDate: '2024-01-01', segment: 'SME', predictedEL: 10_000, actualLoss: 3_000, predictedCoverage: 1.1, actualDefault: false },
    ];

    const result = backtestCreditRisk(records);

    expect(result.totalPredictedEL).toBe(20_000);
    expect(result.totalActualLoss).toBe(8_000);
    // 8,000 / 20,000 = 0.4
    expect(result.elAccuracyRatio).toBeCloseTo(0.4, 4);
    expect(result.elAccuracyRatio).toBeLessThan(1.0);
  });

  it('underprediction: ratio > 1.0 (aggressive model)', () => {
    const records: BacktestRecord[] = [
      { dealId: 'D1', originationDate: '2024-01-01', segment: 'CONSUMER', predictedEL: 500, actualLoss: 800, predictedCoverage: 1.8, actualDefault: true },
      { dealId: 'D2', originationDate: '2024-01-01', segment: 'CONSUMER', predictedEL: 500, actualLoss: 700, predictedCoverage: 1.8, actualDefault: false },
    ];

    const result = backtestCreditRisk(records);

    expect(result.totalPredictedEL).toBe(1_000);
    expect(result.totalActualLoss).toBe(1_500);
    // 1,500 / 1,000 = 1.5
    expect(result.elAccuracyRatio).toBeCloseTo(1.5, 4);
    expect(result.elAccuracyRatio).toBeGreaterThan(1.0);
  });

  it('calculates observed and predicted default rates', () => {
    const records: BacktestRecord[] = [
      { dealId: 'D1', originationDate: '2024-01-01', segment: 'SME', predictedEL: 5_500, actualLoss: 0, predictedCoverage: 1.1, actualDefault: false },
      { dealId: 'D2', originationDate: '2024-01-01', segment: 'SME', predictedEL: 5_500, actualLoss: 0, predictedCoverage: 1.1, actualDefault: false },
      { dealId: 'D3', originationDate: '2024-01-01', segment: 'SME', predictedEL: 5_500, actualLoss: 100_000, predictedCoverage: 1.1, actualDefault: true },
      { dealId: 'D4', originationDate: '2024-01-01', segment: 'SME', predictedEL: 5_500, actualLoss: 80_000, predictedCoverage: 1.1, actualDefault: true },
    ];

    const result = backtestCreditRisk(records);

    expect(result.totalDeals).toBe(4);
    expect(result.defaultedDeals).toBe(2);
    // Observed: 2/4 = 0.50
    expect(result.observedDefaultRate).toBeCloseTo(0.50, 4);
    // Predicted: avg(1.1, 1.1, 1.1, 1.1) / 100 = 0.011
    expect(result.predictedDefaultRate).toBeCloseTo(0.011, 4);
  });

  it('breaks down metrics by segment', () => {
    const records: BacktestRecord[] = [
      { dealId: 'D1', originationDate: '2024-01-01', segment: 'LARGE_CORPORATE', predictedEL: 6_000, actualLoss: 5_000, predictedCoverage: 0.6, actualDefault: false },
      { dealId: 'D2', originationDate: '2024-01-01', segment: 'LARGE_CORPORATE', predictedEL: 6_000, actualLoss: 8_000, predictedCoverage: 0.6, actualDefault: true },
      { dealId: 'D3', originationDate: '2024-01-01', segment: 'SME', predictedEL: 5_500, actualLoss: 5_500, predictedCoverage: 1.1, actualDefault: false },
      { dealId: 'D4', originationDate: '2024-01-01', segment: 'CONSUMER', predictedEL: 540, actualLoss: 1_000, predictedCoverage: 1.8, actualDefault: true },
    ];

    const result = backtestCreditRisk(records);

    expect(Object.keys(result.bySegment)).toHaveLength(3);

    // LARGE_CORPORATE: 2 deals, 1 default
    const corp = result.bySegment['LARGE_CORPORATE'];
    expect(corp.deals).toBe(2);
    expect(corp.defaults).toBe(1);
    expect(corp.observedRate).toBeCloseTo(0.5, 4);
    // accuracy: (5000 + 8000) / (6000 + 6000) = 13000 / 12000 = 1.0833
    expect(corp.accuracyRatio).toBeCloseTo(1.0833, 3);

    // SME: 1 deal, 0 defaults, perfect prediction
    const sme = result.bySegment['SME'];
    expect(sme.deals).toBe(1);
    expect(sme.defaults).toBe(0);
    expect(sme.accuracyRatio).toBeCloseTo(1.0, 4);

    // CONSUMER: 1 deal, 1 default
    const consumer = result.bySegment['CONSUMER'];
    expect(consumer.deals).toBe(1);
    expect(consumer.defaults).toBe(1);
    expect(consumer.observedRate).toBeCloseTo(1.0, 4);
    // accuracy: 1000 / 540 = 1.8519
    expect(consumer.accuracyRatio).toBeCloseTo(1.8519, 3);
  });

  it('handles zero predicted EL gracefully (ratio = 0)', () => {
    const records: BacktestRecord[] = [
      { dealId: 'D1', originationDate: '2024-01-01', segment: 'PUBLIC_SECTOR', predictedEL: 0, actualLoss: 0, predictedCoverage: 0, actualDefault: false },
    ];

    const result = backtestCreditRisk(records);

    expect(result.totalDeals).toBe(1);
    expect(result.totalPredictedEL).toBe(0);
    expect(result.totalActualLoss).toBe(0);
    expect(result.elAccuracyRatio).toBe(0); // guard: 0/0 → 0
  });

  it('handles single deal correctly', () => {
    const records: BacktestRecord[] = [
      { dealId: 'D1', originationDate: '2024-06-15', segment: 'MORTGAGE_LOW_LTV', predictedEL: 1_400, actualLoss: 1_200, predictedCoverage: 0.7, actualDefault: false },
    ];

    const result = backtestCreditRisk(records);

    expect(result.totalDeals).toBe(1);
    expect(result.defaultedDeals).toBe(0);
    expect(result.observedDefaultRate).toBe(0);
    expect(result.elAccuracyRatio).toBeCloseTo(1_200 / 1_400, 4);
    expect(result.bySegment['MORTGAGE_LOW_LTV']).toBeDefined();
    expect(result.bySegment['MORTGAGE_LOW_LTV'].deals).toBe(1);
  });
});

// ── Sprint 5: CCF_TABLE constants ──────────────────────────────────────────

describe('Sprint 5: CCF_TABLE constants', () => {
  it('has all expected commitment types', () => {
    expect(CCF_TABLE['UCC']).toBeCloseTo(0.10, 2);
    expect(CCF_TABLE['OTHER_COMMITMENT']).toBeCloseTo(0.40, 2);
    expect(CCF_TABLE['TRADE_FINANCE']).toBeCloseTo(0.20, 2);
    expect(CCF_TABLE['NIF_RUF']).toBeCloseTo(0.50, 2);
    expect(CCF_TABLE['DIRECT_SUBSTITUTE']).toBeCloseTo(1.00, 2);
    expect(CCF_TABLE['PERFORMANCE_BOND']).toBeCloseTo(0.50, 2);
  });
});
