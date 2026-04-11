import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ApprovalMatrixConfig, FTPResult, Transaction } from '../../types';
import { MOCK_DEALS } from '../seedData';
import { calculatePricing } from '../pricingEngine';

interface RegressionCase {
  baseDealId: string;
  overrides: Partial<Transaction> & { id: string };
  expected: Pick<
    FTPResult,
    | 'baseRate'
    | 'liquiditySpread'
    | 'regulatoryCost'
    | 'capitalCharge'
    | 'floorPrice'
    | 'technicalPrice'
    | 'totalFTP'
    | 'finalClientRate'
    | 'raroc'
    | 'economicProfit'
    | 'approvalLevel'
    | 'matchedMethodology'
  >;
}

interface RegressionFixture {
  approvalMatrix: ApprovalMatrixConfig;
  cases: RegressionCase[];
}

const fixturePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures/pricing-regression.fixture.json',
);
const regressionFixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as RegressionFixture;
const baseDealCatalog = new Map(MOCK_DEALS.map((deal) => [deal.id, deal]));

function buildDeal(testCase: RegressionCase): Transaction {
  const baseDeal = baseDealCatalog.get(testCase.baseDealId);
  if (!baseDeal) {
    throw new Error(`Missing base deal for regression case: ${testCase.baseDealId}`);
  }
  return {
    ...baseDeal,
    ...testCase.overrides,
  };
}

describe('pricing regression fixture', () => {
  it('covers the expected 50 pricing scenarios', () => {
    expect(regressionFixture.cases).toHaveLength(50);
  });

  for (const testCase of regressionFixture.cases) {
    it(`matches numeric baseline for ${testCase.overrides.id}`, () => {
      const result = calculatePricing(buildDeal(testCase), regressionFixture.approvalMatrix);

      expect(result.baseRate).toBeCloseTo(testCase.expected.baseRate, 6);
      expect(result.liquiditySpread).toBeCloseTo(testCase.expected.liquiditySpread, 6);
      expect(result.regulatoryCost).toBeCloseTo(testCase.expected.regulatoryCost, 6);
      expect(result.capitalCharge).toBeCloseTo(testCase.expected.capitalCharge, 6);
      expect(result.floorPrice).toBeCloseTo(testCase.expected.floorPrice, 6);
      expect(result.technicalPrice).toBeCloseTo(testCase.expected.technicalPrice, 6);
      expect(result.totalFTP).toBeCloseTo(testCase.expected.totalFTP, 6);
      expect(result.finalClientRate).toBeCloseTo(testCase.expected.finalClientRate, 6);
      expect(result.raroc).toBeCloseTo(testCase.expected.raroc, 6);
      expect(result.economicProfit).toBeCloseTo(testCase.expected.economicProfit, 6);
      expect(result.approvalLevel).toBe(testCase.expected.approvalLevel);
      expect(result.matchedMethodology).toBe(testCase.expected.matchedMethodology);
    });
  }
});
