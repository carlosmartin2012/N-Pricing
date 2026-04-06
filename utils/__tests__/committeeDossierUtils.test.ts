import { describe, expect, it } from 'vitest';
import type {
  ApprovalTask,
  MarketDataSource,
  MethodologyVersion,
  PortfolioSnapshot,
  PricingDossier,
  Transaction,
} from '../../types';
import { buildCommitteePackage, summarizeCommitteeQueue } from '../../components/Blotter/committeeDossierUtils';

const deal: Transaction = {
  id: 'TRD-200',
  clientId: 'CL-200',
  clientType: 'Corporate',
  businessUnit: 'Corporate',
  fundingBusinessUnit: 'Treasury',
  businessLine: 'Lending',
  productType: 'LOAN_COMM',
  category: 'Asset',
  currency: 'EUR',
  amount: 10_000_000,
  startDate: '2026-04-02',
  durationMonths: 36,
  amortization: 'Bullet',
  repricingFreq: 'Fixed',
  marginTarget: 2.35,
  behaviouralModelId: '',
  riskWeight: 100,
  capitalRatio: 11,
  targetROE: 15,
  operationalCostBps: 35,
  lcrOutflowPct: 0,
  transitionRisk: 'Neutral',
  physicalRisk: 'Low',
  status: 'Pending_Approval',
};

const dossier: PricingDossier = {
  id: 'DOS-200',
  dealId: 'TRD-200',
  status: 'Pending_Approval',
  title: 'Pricing dossier TRD-200',
  clientId: 'CL-200',
  createdAt: '2026-04-02T09:00:00.000Z',
  updatedAt: '2026-04-02T09:00:00.000Z',
  createdByEmail: 'trader@nfq.es',
  createdByName: 'Trader User',
  methodologyVersionId: 'METH-200',
  approvalLevel: 'L2_Committee',
  dealSnapshot: deal,
  pricingResult: {
    baseRate: 2.7,
    liquiditySpread: 0.5,
    _liquidityPremiumDetails: 0.35,
    _clcChargeDetails: 0.1,
    strategicSpread: 0.2,
    optionCost: 0.05,
    regulatoryCost: 0.12,
    operationalCost: 0.35,
    capitalCharge: 0.95,
    esgTransitionCharge: 0,
    esgPhysicalCharge: 0,
    floorPrice: 4.2,
    technicalPrice: 4.7,
    targetPrice: 5.05,
    totalFTP: 3.8,
    finalClientRate: 6.15,
    raroc: 8.4,
    economicProfit: 180_000,
    approvalLevel: 'L2_Committee',
    accountingEntry: {
      source: 'FTP',
      dest: 'Pool',
      amountDebit: 10_000_000,
      amountCredit: 10_000_000,
    },
    matchedMethodology: 'MatchedMaturity',
    matchReason: 'Committee threshold triggered',
    formulaUsed: 'Base + LP + Capital + Spread',
  },
  runContext: {
    methodologyVersionId: 'METH-200',
    matchedMethodology: 'MatchedMaturity',
    marketDataAsOf: '2026-04-02',
    approvalMatrix: {
      autoApprovalThreshold: 15,
      l1Threshold: 10,
      l2Threshold: 5,
    },
    shocksApplied: {
      interestRate: 0,
      liquiditySpread: 0,
    },
    curveCounts: {
      yield: 3,
      liquidity: 2,
    },
    ruleCount: 7,
  },
  approvalTaskId: 'APT-200',
  evidence: [
    {
      id: 'EVD-200',
      type: 'PRICING_RECEIPT',
      label: 'Pricing receipt',
      format: 'pdf',
      createdAt: '2026-04-02T09:00:00.000Z',
      createdByEmail: 'trader@nfq.es',
      createdByName: 'Trader User',
      status: 'Generated',
    },
  ],
  correlation: {
    correlationId: 'CORR-200',
    dealId: 'TRD-200',
    dossierId: 'DOS-200',
    approvalTaskId: 'APT-200',
  },
  groundedContext: {
    subjectRefs: [],
    methodologyVersionId: 'METH-200',
    dossierId: 'DOS-200',
    dealId: 'TRD-200',
    portfolioSnapshotId: 'PORT-200',
    evidenceIds: ['EVD-200'],
    marketDataSourceIds: ['SRC-ECB'],
  },
  aiResponseTraces: [],
};

const approvalTask: ApprovalTask = {
  id: 'APT-200',
  scope: 'DEAL_PRICING',
  status: 'Pending',
  title: 'Approve TRD-200',
  description: 'Committee review required',
  requiredRole: 'Risk_Manager',
  submittedByEmail: 'trader@nfq.es',
  submittedByName: 'Trader User',
  submittedAt: '2026-04-02T09:00:00.000Z',
  subject: {
    type: 'DEAL',
    id: 'TRD-200',
    label: 'TRD-200',
  },
  correlation: {
    correlationId: 'CORR-200',
    dealId: 'TRD-200',
    dossierId: 'DOS-200',
    approvalTaskId: 'APT-200',
  },
};

const methodologyVersion: MethodologyVersion = {
  id: 'METH-200',
  label: 'Methodology 0200',
  fingerprint: 'ABCD2000',
  ruleCount: 7,
  createdAt: '2026-04-02T08:00:00.000Z',
  createdByEmail: 'risk@nfq.es',
  createdByName: 'Risk User',
  summary: {
    activeRules: 7,
    appliedRequests: 2,
    reason: 'Quarterly refresh',
  },
};

const portfolioSnapshot: PortfolioSnapshot = {
  id: 'PORT-200',
  name: 'Committee Snapshot',
  scenario: {
    id: 'SCN-200',
    name: 'Base',
    shocks: { interestRate: 0, liquiditySpread: 0 },
    createdAt: '2026-04-02T08:30:00.000Z',
    createdByEmail: 'risk@nfq.es',
    createdByName: 'Risk User',
  },
  createdAt: '2026-04-02T08:30:00.000Z',
  createdByEmail: 'risk@nfq.es',
  createdByName: 'Risk User',
  dealIds: ['TRD-200'],
  totals: {
    exposure: 10_000_000,
    averageRaroc: 8.4,
    averageFinalRate: 6.15,
    approved: 0,
    pendingApproval: 1,
    rejected: 0,
  },
  results: [],
};

const marketDataSources: MarketDataSource[] = [
  {
    id: 'SRC-ECB',
    name: 'ECB EUR Curve',
    provider: 'ECB',
    sourceType: 'YieldCurve',
    status: 'Active',
    currencies: ['EUR'],
    lastSyncAt: '2026-04-02T08:00:00.000Z',
  },
];

describe('committeeDossierUtils', () => {
  it('builds a committee package with the governed artifacts attached', () => {
    const committeePackage = buildCommitteePackage({
      deal,
      dossier,
      approvalTask,
      methodologyVersion,
      portfolioSnapshot,
      marketDataSources,
    });

    expect(committeePackage.packageType).toBe('COMMITTEE_REVIEW');
    expect(committeePackage.deal.id).toBe('TRD-200');
    expect(committeePackage.dossier.id).toBe('DOS-200');
    expect(committeePackage.approvalTask?.id).toBe('APT-200');
    expect(committeePackage.methodologyVersion?.id).toBe('METH-200');
    expect(committeePackage.portfolioSnapshot?.id).toBe('PORT-200');
    expect(committeePackage.marketDataSources.map((source) => source.id)).toEqual(['SRC-ECB']);
  });

  it('summarizes the committee queue for blotter monitoring', () => {
    const summary = summarizeCommitteeQueue({
      deals: [
        deal,
        {
          ...deal,
          id: 'TRD-201',
          status: 'Approved',
        },
      ],
      dossiers: [
        dossier,
        {
          ...dossier,
          id: 'DOS-201',
          dealId: 'TRD-201',
          status: 'Approved',
          aiResponseTraces: [
            {
              id: 'AIT-201',
              generatedAt: '2026-04-02T09:30:00.000Z',
              model: 'gemini-2.0-flash',
              groundedContext: {
                subjectRefs: [],
                methodologyVersionId: 'METH-200',
                dossierId: 'DOS-201',
                dealId: 'TRD-201',
                evidenceIds: [],
              },
              sources: [],
              suggestedActions: [],
              responsePreview: 'Committee summary',
            },
          ],
        },
      ],
      approvalTasks: [
        approvalTask,
        {
          ...approvalTask,
          id: 'APT-201',
          status: 'Completed',
          subject: {
            type: 'DEAL',
            id: 'TRD-201',
            label: 'TRD-201',
          },
        },
      ],
    });

    expect(summary).toEqual({
      pendingReview: 1,
      readyToBook: 1,
      aiSupported: 1,
      openTasks: 1,
    });
  });
});
