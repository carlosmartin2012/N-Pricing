import { describe, expect, it } from 'vitest';
import type { FTPResult, RAROCInputs, Transaction } from '../../types';
import {
  applyRarocInputsPatch,
  dealToRarocInputsPatch,
} from '../raroc/dealToRarocInputs';
import { INITIAL_RAROC_INPUTS } from '../../components/RAROC/rarocCalculatorUtils';

function makeDeal(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'DEAL-001',
    clientId: 'CLIENT-1',
    clientType: 'Corporate',
    businessUnit: 'Wholesale',
    fundingBusinessUnit: 'Treasury',
    businessLine: 'Lending',
    productType: 'Term_Loan',
    category: 'Asset',
    currency: 'EUR',
    amount: 2_500_000,
    startDate: '2026-01-01',
    durationMonths: 60,
    amortization: 'Bullet',
    repricingFreq: 'Fixed',
    marginTarget: 2.0,
    riskWeight: 0.5,
    capitalRatio: 0.08,
    targetROE: 12,
    operationalCostBps: 25,
    transitionRisk: 'Neutral',
    physicalRisk: 'Low',
    ...overrides,
  };
}

function makeResult(overrides: Partial<FTPResult> = {}): FTPResult {
  return {
    baseRate: 3,
    liquiditySpread: 0.4,
    _liquidityPremiumDetails: 0,
    _clcChargeDetails: 0,
    strategicSpread: 0,
    optionCost: 0,
    regulatoryCost: 0.1,
    operationalCost: 0.2,
    capitalCharge: 0.5,
    esgTransitionCharge: 0,
    esgPhysicalCharge: 0,
    floorPrice: 4,
    technicalPrice: 4.5,
    targetPrice: 6.5,
    totalFTP: 3.8,
    finalClientRate: 6.5,
    raroc: 14.2,
    economicProfit: 1234,
    approvalLevel: 'Auto',
    accountingEntry: { source: 'A', dest: 'B', amountDebit: 0, amountCredit: 0 },
    matchedMethodology: 'Matched Maturity',
    matchReason: 'test',
    ...overrides,
  };
}

describe('dealToRarocInputsPatch', () => {
  it('mirrors rate, FTP and spread from the pricing result', () => {
    const patch = dealToRarocInputsPatch(makeDeal(), makeResult());

    expect(patch.interestRate).toBe(6.5);
    expect(patch.cofRate).toBe(3.8);
    expect(patch.interestSpread).toBeCloseTo(6.5 - 3.8, 8);
  });

  it('uses the deal amount for loan/os/ead when no overrides exist', () => {
    const patch = dealToRarocInputsPatch(makeDeal(), makeResult());

    expect(patch.loanAmt).toBe(2_500_000);
    expect(patch.osAmt).toBe(2_500_000);
    expect(patch.ead).toBe(2_500_000);
    expect(patch.transactionId).toBe('DEAL-001');
  });

  it('prefers drawnAmount for outstanding and the explicit ead field for EAD', () => {
    const patch = dealToRarocInputsPatch(
      makeDeal({ drawnAmount: 1_800_000, ead: 2_100_000 }),
      makeResult(),
    );

    expect(patch.loanAmt).toBe(2_500_000);
    expect(patch.osAmt).toBe(1_800_000);
    expect(patch.ead).toBe(2_100_000);
  });

  it('uses effectiveRwa from the result when available', () => {
    const patch = dealToRarocInputsPatch(makeDeal(), makeResult({ effectiveRwa: 1_400_000 }));

    expect(patch.rwa).toBe(1_400_000);
  });

  it('falls back to amount × riskWeight when no RWA is available', () => {
    const patch = dealToRarocInputsPatch(makeDeal({ riskWeight: 0.75 }), null);

    expect(patch.rwa).toBe(2_500_000 * 0.75);
  });

  it('propagates deal.feeIncome when set', () => {
    const patch = dealToRarocInputsPatch(makeDeal({ feeIncome: 18_500 }), null);

    expect(patch.feeIncome).toBe(18_500);
  });

  it('skips rate/spread fields when no pricing result is given', () => {
    const patch = dealToRarocInputsPatch(makeDeal(), null);

    expect(patch.interestRate).toBeUndefined();
    expect(patch.cofRate).toBeUndefined();
    expect(patch.interestSpread).toBeUndefined();
  });

  it('leaves RAROC-only levers untouched (hurdleRate, opRisk, pillar2, etc.)', () => {
    const patch = dealToRarocInputsPatch(makeDeal(), makeResult());

    expect(patch.hurdleRate).toBeUndefined();
    expect(patch.opRiskCapitalCharge).toBeUndefined();
    expect(patch.pillar2CapitalCharge).toBeUndefined();
    expect(patch.riskFreeRate).toBeUndefined();
    expect(patch.operatingCostPct).toBeUndefined();
    expect(patch.minRegCapitalReq).toBeUndefined();
    expect(patch.ecl).toBeUndefined();
  });

  it('ignores zero / NaN amounts (avoids stomping defaults with bogus data)', () => {
    const patch = dealToRarocInputsPatch(makeDeal({ amount: 0 }), null);

    expect(patch.loanAmt).toBeUndefined();
    expect(patch.osAmt).toBeUndefined();
    expect(patch.ead).toBeUndefined();
  });
});

describe('applyRarocInputsPatch', () => {
  it('merges patch over the base inputs without mutating', () => {
    const base: RAROCInputs = { ...INITIAL_RAROC_INPUTS };
    const next = applyRarocInputsPatch(base, { interestRate: 7.5, cofRate: 4.0 });

    expect(next.interestRate).toBe(7.5);
    expect(next.cofRate).toBe(4.0);
    expect(next.hurdleRate).toBe(INITIAL_RAROC_INPUTS.hurdleRate);
    expect(base.interestRate).toBe(INITIAL_RAROC_INPUTS.interestRate);
  });
});
