import { describe, expect, it } from 'vitest';
import type {
  AIResponseTrace,
  MarketDataSource,
  MethodologyVersion,
  PortfolioSnapshot,
  PricingDossier,
} from '../../types';
import {
  appendAITraceToPricingDossier,
  buildAIResponseTrace,
  buildDossierGroundedContext,
  buildGroundingSummary,
  findLatestPortfolioSnapshotForDeal,
  resolveChatGrounding,
  resolveRelevantMarketDataSources,
} from '../aiGrounding';

const methodologyVersions: MethodologyVersion[] = [
  {
    id: 'LIVE-2026-04-02',
    label: 'Live Methodology 2026-04-02',
    fingerprint: 'ABCD1234',
    ruleCount: 24,
    createdAt: '2026-04-02T10:00:00.000Z',
    createdByEmail: 'risk@nfq.es',
    createdByName: 'Risk User',
    summary: {
      activeRules: 24,
      appliedRequests: 0,
      reason: 'Live configuration',
    },
  },
];

const marketDataSources: MarketDataSource[] = [
  {
    id: 'MDS-USD',
    name: 'Bloomberg USD Curve',
    provider: 'Bloomberg',
    sourceType: 'YieldCurve',
    status: 'Active',
    currencies: ['USD'],
    lastSyncAt: '2026-04-02T09:00:00.000Z',
  },
  {
    id: 'MDS-EUR',
    name: 'ECB EUR Curve',
    provider: 'ECB',
    sourceType: 'YieldCurve',
    status: 'Active',
    currencies: ['EUR'],
  },
];

const portfolioSnapshots: PortfolioSnapshot[] = [
  {
    id: 'PORT-001',
    name: 'Morning Snapshot',
    scenario: {
      id: 'SCN-001',
      name: 'Base',
      shocks: { interestRate: 0, liquiditySpread: 0 },
      createdAt: '2026-04-02T08:00:00.000Z',
      createdByEmail: 'risk@nfq.es',
      createdByName: 'Risk User',
    },
    createdAt: '2026-04-02T08:00:00.000Z',
    createdByEmail: 'risk@nfq.es',
    createdByName: 'Risk User',
    dealIds: ['TRD-100'],
    totals: {
      exposure: 5_000_000,
      averageRaroc: 11.2,
      averageFinalRate: 5.75,
      approved: 0,
      pendingApproval: 1,
      rejected: 0,
    },
    results: [],
  },
];

const dossier: PricingDossier = {
  id: 'DOS-001',
  dealId: 'TRD-100',
  status: 'Pending_Approval',
  title: 'Pricing dossier TRD-100',
  clientId: 'CL-1001',
  createdAt: '2026-04-02T10:00:00.000Z',
  updatedAt: '2026-04-02T10:00:00.000Z',
  createdByEmail: 'trader@nfq.es',
  createdByName: 'Trader User',
  methodologyVersionId: 'LIVE-2026-04-02',
  approvalLevel: 'L1_Manager',
  dealSnapshot: {
    id: 'TRD-100',
    clientId: 'CL-1001',
    clientType: 'Corporate',
    businessUnit: 'BU-001',
    fundingBusinessUnit: 'BU-900',
    businessLine: 'Corporate',
    productType: 'LOAN_COMM',
    category: 'Asset',
    currency: 'USD',
    amount: 5_000_000,
    startDate: '2026-04-02',
    durationMonths: 24,
    amortization: 'Bullet',
    repricingFreq: 'Fixed',
    marginTarget: 2.1,
    behaviouralModelId: '',
    riskWeight: 100,
    capitalRatio: 11,
    targetROE: 15,
    operationalCostBps: 35,
    lcrOutflowPct: 0,
    transitionRisk: 'Neutral',
    physicalRisk: 'Low',
  },
  pricingResult: {
    baseRate: 3,
    liquiditySpread: 0.5,
    _liquidityPremiumDetails: 0.3,
    _clcChargeDetails: 0.1,
    strategicSpread: 0.2,
    optionCost: 0,
    regulatoryCost: 0.1,
    operationalCost: 0.3,
    capitalCharge: 0.8,
    esgTransitionCharge: 0,
    esgPhysicalCharge: 0,
    floorPrice: 4.4,
    technicalPrice: 5,
    targetPrice: 5.2,
    totalFTP: 4.1,
    finalClientRate: 6.2,
    raroc: 9.7,
    economicProfit: 150_000,
    approvalLevel: 'L1_Manager',
    accountingEntry: {
      source: 'FTP',
      dest: 'Pool',
      amountDebit: 5_000_000,
      amountCredit: 5_000_000,
    },
    matchedMethodology: 'MatchedMaturity',
    matchReason: 'Rule match',
    formulaUsed: 'Base + LP + capital',
  },
  runContext: {
    methodologyVersionId: 'LIVE-2026-04-02',
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
      yield: 1,
      liquidity: 1,
    },
    ruleCount: 1,
  },
  evidence: [
    {
      id: 'EVD-1',
      type: 'PRICING_RECEIPT',
      label: 'Pricing receipt',
      format: 'pdf',
      createdAt: '2026-04-02T10:00:00.000Z',
      createdByEmail: 'trader@nfq.es',
      createdByName: 'Trader User',
      status: 'Generated',
    },
  ],
  correlation: {
    correlationId: 'CORR-001',
    dealId: 'TRD-100',
    dossierId: 'DOS-001',
  },
};

describe('aiGrounding', () => {
  it('resolves market data sources and latest portfolio snapshot for a dossier', () => {
    expect(
      resolveRelevantMarketDataSources(dossier.dealSnapshot, marketDataSources).map((source) => source.id)
    ).toEqual(['MDS-USD']);
    expect(findLatestPortfolioSnapshotForDeal('TRD-100', portfolioSnapshots)?.id).toBe('PORT-001');
  });

  it('builds grounded context and a readable grounding summary', () => {
    const groundedContext = buildDossierGroundedContext({
      dossier,
      methodologyVersions,
      marketDataSources,
      portfolioSnapshots,
    });
    const summary = buildGroundingSummary({
      groundedContext,
      dossier,
      methodologyVersions,
      marketDataSources,
      portfolioSnapshots,
    });

    expect(groundedContext.dossierId).toBe('DOS-001');
    expect(groundedContext.portfolioSnapshotId).toBe('PORT-001');
    expect(groundedContext.marketDataSourceIds).toEqual(['MDS-USD']);
    expect(summary).toContain('Pricing Dossier: DOS-001');
    expect(summary).toContain('Portfolio Snapshot: Morning Snapshot');
  });

  it('appends AI traces as dossier evidence', () => {
    const groundedContext = buildDossierGroundedContext({
      dossier,
      methodologyVersions,
      marketDataSources,
      portfolioSnapshots,
    });
    const trace: AIResponseTrace = buildAIResponseTrace({
      model: 'gemini-2.0-flash',
      groundedContext,
      sources: groundedContext.subjectRefs,
      prompt: 'Explain TRD-100 pricing',
      response: 'RAROC is below auto-approval due to capital charge.',
      dossier,
      portfolioSnapshots,
    });
    const updated = appendAITraceToPricingDossier(
      {
        ...dossier,
        groundedContext,
        aiResponseTraces: [],
      },
      trace,
      'analyst@nfq.es',
      'Analyst User'
    );

    expect(updated.aiResponseTraces).toHaveLength(1);
    expect(updated.evidence.some((evidence) => evidence.type === 'AI_TRACE')).toBe(true);
    expect(updated.groundedContext?.dossierId).toBe('DOS-001');
  });

  it('does not attach a generic prompt to an unrelated dossier', () => {
    const grounding = resolveChatGrounding({
      input: 'Explain the current funding environment',
      deals: [dossier.dealSnapshot],
      pricingDossiers: [dossier],
      methodologyVersions,
      marketDataSources,
      portfolioSnapshots,
    });

    expect(grounding.dossier).toBeUndefined();
    expect(grounding.groundedContext.dossierId).toBeUndefined();
    expect(grounding.summary).toContain('Pricing Dossier: none resolved');
  });
});
