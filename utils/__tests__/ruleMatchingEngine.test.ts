import { describe, it, expect } from 'vitest';
import { matchDealToRule, interpolateRateCard } from '../ruleMatchingEngine';
import { Transaction, GeneralRule, BusinessUnit, ProductDefinition, FtpRateCard } from '../../types';

const testBUs: BusinessUnit[] = [
  { id: 'BU-001', name: 'Commercial Banking', code: 'CIB' },
  { id: 'BU-002', name: 'Retail Banking', code: 'RET' },
];

const testProducts: ProductDefinition[] = [
  { id: 'LOAN_COMM', name: 'Commercial Loan', category: 'Asset' },
  { id: 'DEP_TERM', name: 'Term Deposit', category: 'Liability' },
];

const baseDeal: Transaction = {
  clientId: 'CL-1001',
  clientType: 'Corporate',
  businessUnit: 'BU-001',
  fundingBusinessUnit: 'BU-900',
  businessLine: 'Corporate',
  productType: 'LOAN_COMM',
  category: 'Asset',
  currency: 'USD',
  amount: 5_000_000,
  startDate: '2024-01-01',
  durationMonths: 24,
  amortization: 'Bullet',
  repricingFreq: 'Fixed',
  marginTarget: 2.25,
  riskWeight: 100,
  capitalRatio: 11.5,
  targetROE: 15,
  operationalCostBps: 45,
  transitionRisk: 'Neutral',
  physicalRisk: 'Low',
};

function makeRule(overrides: Partial<GeneralRule> = {}): GeneralRule {
  return {
    id: 1,
    businessUnit: 'All',
    product: 'Any',
    segment: 'All',
    tenor: 'Any',
    baseMethod: 'Matched Maturity',
    spreadMethod: 'Standard',
    strategicSpread: 0,
    ...overrides,
  };
}

describe('matchDealToRule', () => {
  it('returns fallback when rules is empty array', () => {
    const result = matchDealToRule(baseDeal, [], testBUs, testProducts);
    expect(result.rule).toBeNull();
    expect(result.reason).toContain('Default');
  });

  it('returns "Matched Maturity" fallback for Fixed repricing with no rules', () => {
    const deal = { ...baseDeal, repricingFreq: 'Fixed' as const };
    const result = matchDealToRule(deal, [], testBUs, testProducts);
    expect(result.methodology).toBe('Matched Maturity');
  });

  it('returns "Moving Average" fallback for Monthly repricing with no rules', () => {
    const deal = { ...baseDeal, repricingFreq: 'Monthly' as const };
    const result = matchDealToRule(deal, [], testBUs, testProducts);
    expect(result.methodology).toBe('Moving Average');
  });

  it('exact BU + product match scores 20 and selects that rule', () => {
    const specificRule = makeRule({
      id: 10,
      businessUnit: 'Commercial',
      product: 'Loan',
      baseMethod: 'Specific Method',
      strategicSpread: 15,
    });
    const genericRule = makeRule({
      id: 11,
      businessUnit: 'All',
      product: 'Any',
      baseMethod: 'Generic Method',
    });
    const result = matchDealToRule(baseDeal, [genericRule, specificRule], testBUs, testProducts);
    expect(result.rule?.id).toBe(10);
    expect(result.methodology).toBe('Specific Method');
  });

  it('BU match only scores 10', () => {
    const buOnlyRule = makeRule({
      id: 20,
      businessUnit: 'Commercial',
      product: 'Any',
      baseMethod: 'BU Method',
      strategicSpread: 5,
    });
    const result = matchDealToRule(baseDeal, [buOnlyRule], testBUs, testProducts);
    expect(result.rule?.id).toBe(20);
    expect(result.methodology).toBe('BU Method');
  });

  it('product + segment match scores 15', () => {
    const prodSegRule = makeRule({
      id: 30,
      businessUnit: 'All',
      product: 'Loan',
      segment: 'Corporate',
      baseMethod: 'ProdSeg Method',
    });
    const result = matchDealToRule(baseDeal, [prodSegRule], testBUs, testProducts);
    expect(result.rule?.id).toBe(30);
    expect(result.methodology).toBe('ProdSeg Method');
  });

  it('most specific rule wins (higher score)', () => {
    const lessSpecific = makeRule({
      id: 40,
      businessUnit: 'Commercial',
      product: 'Any',
      baseMethod: 'Less Specific',
    });
    const moreSpecific = makeRule({
      id: 41,
      businessUnit: 'Commercial',
      product: 'Loan',
      segment: 'Corporate',
      baseMethod: 'More Specific',
    });
    const result = matchDealToRule(baseDeal, [lessSpecific, moreSpecific], testBUs, testProducts);
    expect(result.rule?.id).toBe(41);
    expect(result.methodology).toBe('More Specific');
  });

  it('tenor condition "<12M" matches 6-month deal, excludes 24-month deal', () => {
    const rule = makeRule({
      id: 50,
      tenor: '<12M',
      baseMethod: 'Short Tenor',
    });
    const shortDeal = { ...baseDeal, durationMonths: 6 };
    const longDeal = { ...baseDeal, durationMonths: 24 };

    const shortResult = matchDealToRule(shortDeal, [rule], testBUs, testProducts);
    expect(shortResult.rule?.id).toBe(50);

    const longResult = matchDealToRule(longDeal, [rule], testBUs, testProducts);
    expect(longResult.rule).toBeNull();
  });

  it('tenor condition ">36M" matches 48-month deal', () => {
    const rule = makeRule({
      id: 51,
      tenor: '>36M',
      baseMethod: 'Long Tenor',
    });
    const deal = { ...baseDeal, durationMonths: 48 };
    const result = matchDealToRule(deal, [rule], testBUs, testProducts);
    expect(result.rule?.id).toBe(51);
  });

  it('tenor range "12-36M" matches 24-month deal', () => {
    const rule = makeRule({
      id: 52,
      tenor: '12-36M',
      baseMethod: 'Mid Tenor',
    });
    const result = matchDealToRule(baseDeal, [rule], testBUs, testProducts);
    expect(result.rule?.id).toBe(52);
  });

  it('strategicSpreadBps comes from matched rule', () => {
    const rule = makeRule({
      id: 60,
      strategicSpread: 42,
    });
    const result = matchDealToRule(baseDeal, [rule], testBUs, testProducts);
    expect(result.strategicSpreadBps).toBe(42);
  });

  it('baseReference and liquidityReference come from matched rule', () => {
    const rule = makeRule({
      id: 70,
      baseReference: 'CURVE-BASE-01',
      liquidityReference: 'CURVE-LIQ-01',
    });
    const result = matchDealToRule(baseDeal, [rule], testBUs, testProducts);
    expect(result.baseReference).toBe('CURVE-BASE-01');
    expect(result.liquidityReference).toBe('CURVE-LIQ-01');
  });
});

describe('interpolateRateCard', () => {
  it('returns 0 for empty card points', () => {
    const card: FtpRateCard = {
      id: 'RC-1',
      name: 'Empty Card',
      type: 'Liquidity',
      currency: 'USD',
      points: [],
    };
    expect(interpolateRateCard(card, 12)).toBe(0);
  });

  it('returns exact rate for matching tenor', () => {
    const card: FtpRateCard = {
      id: 'RC-2',
      name: 'Test Card',
      type: 'Liquidity',
      currency: 'USD',
      points: [
        { tenor: '1Y', rate: 3.0 },
        { tenor: '2Y', rate: 4.0 },
        { tenor: '5Y', rate: 5.0 },
      ],
    };
    expect(interpolateRateCard(card, 12)).toBe(3.0);
    expect(interpolateRateCard(card, 24)).toBe(4.0);
  });

  it('interpolates between two tenors', () => {
    const card: FtpRateCard = {
      id: 'RC-3',
      name: 'Test Card',
      type: 'Liquidity',
      currency: 'USD',
      points: [
        { tenor: '1Y', rate: 3.0 },
        { tenor: '2Y', rate: 5.0 },
      ],
    };
    // 18 months is halfway between 12 and 24
    expect(interpolateRateCard(card, 18)).toBe(4.0);
  });

  it('clamps at boundaries (below first, above last)', () => {
    const card: FtpRateCard = {
      id: 'RC-4',
      name: 'Test Card',
      type: 'Liquidity',
      currency: 'USD',
      points: [
        { tenor: '1Y', rate: 3.0 },
        { tenor: '5Y', rate: 5.0 },
      ],
    };
    // Below first tenor
    expect(interpolateRateCard(card, 1)).toBe(3.0);
    // Above last tenor
    expect(interpolateRateCard(card, 120)).toBe(5.0);
  });
});
