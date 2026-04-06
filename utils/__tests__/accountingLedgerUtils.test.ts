import { describe, expect, it } from 'vitest';
import type { ApprovalMatrixConfig, Transaction } from '../../types';
import {
  MOCK_BEHAVIOURAL_MODELS,
  MOCK_BUSINESS_UNITS,
  MOCK_CLIENTS,
  MOCK_FTP_RATE_CARDS,
  MOCK_LIQUIDITY_CURVES,
  MOCK_PHYSICAL_GRID,
  MOCK_PRODUCT_DEFS,
  MOCK_TRANSITION_GRID,
  MOCK_YIELD_CURVE,
} from '../../constants';
import {
  buildLedgerEntries,
  summarizeLedgerEntries,
  type LedgerEntry,
} from '../../components/Accounting/accountingLedgerUtils';

const approvalMatrix: ApprovalMatrixConfig = {
  autoApprovalThreshold: 15,
  l1Threshold: 10,
  l2Threshold: 5,
};

const pricingContext = {
  yieldCurve: MOCK_YIELD_CURVE,
  liquidityCurves: MOCK_LIQUIDITY_CURVES,
  rules: [],
  rateCards: MOCK_FTP_RATE_CARDS,
  transitionGrid: MOCK_TRANSITION_GRID,
  physicalGrid: MOCK_PHYSICAL_GRID,
  behaviouralModels: MOCK_BEHAVIOURAL_MODELS,
  clients: MOCK_CLIENTS,
  products: MOCK_PRODUCT_DEFS,
  businessUnits: MOCK_BUSINESS_UNITS,
};

const baseDeal: Transaction = {
  id: 'TRD-1',
  status: 'Booked',
  clientId: 'CL-1001',
  clientType: 'Corporate',
  businessUnit: 'BU-001',
  fundingBusinessUnit: 'BU-900',
  businessLine: 'Corporate Finance',
  productType: 'LOAN_COMM',
  category: 'Asset',
  currency: 'USD',
  amount: 1_000_000,
  startDate: '2026-01-01',
  durationMonths: 24,
  amortization: 'Bullet',
  repricingFreq: 'Fixed',
  marginTarget: 2,
  riskWeight: 100,
  capitalRatio: 11.5,
  targetROE: 15,
  operationalCostBps: 45,
  lcrOutflowPct: 0,
  transitionRisk: 'Neutral',
  physicalRisk: 'Low',
};

describe('accountingLedgerUtils', () => {
  it('keeps currency summaries separated instead of merging into a fake consolidated amount', () => {
    const summary = summarizeLedgerEntries([
      {
        id: '1',
        timestamp: '2026-01-01',
        unit: 'Commercial Banking',
        type: 'LOAN',
        product: 'Commercial Loan',
        amount: 1_000_000,
        clientRate: 6,
        ftpRate: 4,
        margin: 2,
        currency: 'USD',
        status: 'POSTED',
        ftpComponents: { baseRate: 3, liquidityPrem: 0.5, strategicAdj: 0.5 },
      },
      {
        id: '2',
        timestamp: '2026-01-01',
        unit: 'Commercial Banking',
        type: 'LOAN',
        product: 'Commercial Loan',
        amount: 2_000_000,
        clientRate: 5,
        ftpRate: 3.5,
        margin: 1.5,
        currency: 'EUR',
        status: 'POSTED',
        ftpComponents: { baseRate: 2.5, liquidityPrem: 0.5, strategicAdj: 0.5 },
      },
    ] satisfies LedgerEntry[]);

    expect(summary.assets).toEqual([
      { currency: 'EUR', amount: 2_000_000 },
      { currency: 'USD', amount: 1_000_000 },
    ]);
  });

  it('classifies off-balance deals as commitments in the ledger', () => {
    const offBalanceDeal: Transaction = {
      ...baseDeal,
      id: 'TRD-2',
      productType: 'SWAP_IRS',
      category: 'Off-Balance',
      currency: 'EUR',
      marginTarget: 0.15,
    };

    const entries = buildLedgerEntries(
      [offBalanceDeal],
      approvalMatrix,
      pricingContext,
      MOCK_BUSINESS_UNITS,
      MOCK_PRODUCT_DEFS,
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('COMMITMENT');
  });
});
