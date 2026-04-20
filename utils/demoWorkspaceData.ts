import type {
  ApprovalMatrixConfig,
  ApprovalTask,
  MarketDataSource,
  MethodologyVersion,
  PortfolioSnapshot,
  PricingDossier,
} from '../types';
import {
  MOCK_BEHAVIOURAL_MODELS,
  MOCK_BUSINESS_UNITS,
  MOCK_CLIENTS,
  MOCK_DEALS,
  MOCK_FTP_RATE_CARDS,
  MOCK_GREENIUM_GRID,
  MOCK_LIQUIDITY_CURVES,
  MOCK_PHYSICAL_GRID,
  MOCK_PRODUCT_DEFS,
  MOCK_RULES,
  MOCK_TRANSITION_GRID,
  MOCK_YIELD_CURVE,
} from '../constants';
import { createMethodologyVersionSnapshot } from './governance/methodologyRequests';
import {
  buildApprovalTaskForPricingDossier,
  buildPortfolioSnapshot,
  buildPricingDossier,
} from './governance/pricing';
import { buildPricingContext } from './pricingContext';
import { calculatePricing } from './pricingEngine';

export interface DemoWorkspaceData {
  methodologyVersions: MethodologyVersion[];
  approvalTasks: ApprovalTask[];
  pricingDossiers: PricingDossier[];
  portfolioSnapshots: PortfolioSnapshot[];
  marketDataSources: MarketDataSource[];
}

export function buildDemoWorkspaceData({
  approvalMatrix,
}: {
  approvalMatrix: ApprovalMatrixConfig;
}): DemoWorkspaceData {
  const pricingContext = buildPricingContext(
    {
      yieldCurves: MOCK_YIELD_CURVE,
      liquidityCurves: MOCK_LIQUIDITY_CURVES,
      rules: MOCK_RULES,
      ftpRateCards: MOCK_FTP_RATE_CARDS,
      transitionGrid: MOCK_TRANSITION_GRID,
      physicalGrid: MOCK_PHYSICAL_GRID,
      greeniumGrid: MOCK_GREENIUM_GRID,
      behaviouralModels: MOCK_BEHAVIOURAL_MODELS,
    },
    {
      clients: MOCK_CLIENTS,
      products: MOCK_PRODUCT_DEFS,
      businessUnits: MOCK_BUSINESS_UNITS,
    },
  );

  const actor = {
    email: 'demo@nfq.es',
    name: 'Demo User',
  };

  const methodologyVersions = [
    createMethodologyVersionSnapshot({
      rules: MOCK_RULES,
      previousVersions: [],
      actorEmail: actor.email,
      actorName: actor.name,
      reason: 'Seeded demo methodology baseline',
    }),
  ];

  const marketDataSources: MarketDataSource[] = [
    {
      id: 'MDS-YIELD-DEMO',
      name: 'Demo Yield Curves',
      provider: 'NFQ Seed',
      sourceType: 'YieldCurve',
      status: 'Active',
      currencies: ['USD', 'EUR'],
      lastSyncAt: new Date().toISOString(),
      notes: 'Seeded demo source for coherent walkthroughs.',
    },
    {
      id: 'MDS-LIQ-DEMO',
      name: 'Demo Liquidity Curves',
      provider: 'NFQ Seed',
      sourceType: 'LiquidityCurve',
      status: 'Active',
      currencies: ['USD', 'EUR'],
      lastSyncAt: new Date().toISOString(),
      notes: 'Seeded liquidity source for demo mode.',
    },
  ];

  const dealCandidates = MOCK_DEALS.filter((deal) => Boolean(deal.id) && deal.amount > 0);
  const dealsForSnapshot = dealCandidates.length > 0 ? dealCandidates : MOCK_DEALS.slice(0, 2);
  const featuredDeal =
    dealCandidates.find((deal) => deal.status === 'Pending_Approval') ??
    dealCandidates[0] ??
    MOCK_DEALS[0];

  const portfolioSnapshot = buildPortfolioSnapshot({
    name: 'Demo Portfolio Snapshot',
    scenario: {
      id: 'SCN-DEMO-BASE',
      name: 'Demo Base',
      description: 'Baseline snapshot for demo mode.',
      shocks: { interestRate: 0, liquiditySpread: 0 },
      createdAt: new Date().toISOString(),
      createdByEmail: actor.email,
      createdByName: actor.name,
    },
    deals: dealsForSnapshot,
    approvalMatrix,
    pricingContext,
    createdByEmail: actor.email,
    createdByName: actor.name,
  });

  const featuredResult = calculatePricing(featuredDeal, approvalMatrix, pricingContext);
  const featuredDossier = buildPricingDossier({
    deal: featuredDeal,
    result: featuredResult,
    approvalMatrix,
    rules: MOCK_RULES,
    methodologyVersions,
    currentUser: actor,
    yieldCurveCount: MOCK_YIELD_CURVE.length,
    liquidityCurveCount: MOCK_LIQUIDITY_CURVES.length,
    marketDataSources,
    portfolioSnapshots: [portfolioSnapshot],
    status: 'Pending_Approval',
  });
  const featuredApprovalTask = buildApprovalTaskForPricingDossier(featuredDossier);

  return {
    methodologyVersions,
    approvalTasks: featuredApprovalTask ? [featuredApprovalTask] : [],
    pricingDossiers: [featuredDossier],
    portfolioSnapshots: [portfolioSnapshot],
    marketDataSources,
  };
}
