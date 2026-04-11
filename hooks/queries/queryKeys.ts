/**
 * Centralized query key factory for React Query.
 *
 * Every query key used across the app should be defined here so that
 * invalidation, prefetching and cache reads stay consistent.
 *
 * Pattern:
 *   queryKeys.<domain>.all        — list queries
 *   queryKeys.<domain>.detail(id) — single-entity queries
 */

export const queryKeys = {
  // --- Deals ---
  deals: {
    all: ['deals'] as const,
    detail: (id: string) => ['deals', id] as const,
    versions: (dealId: string) => ['deals', dealId, 'versions'] as const,
    paginated: (page: number, pageSize: number) =>
      ['deals', 'paginated', page, pageSize] as const,
  },

  // --- Market Data ---
  marketData: {
    yieldCurves: ['marketData', 'yieldCurves'] as const,
    liquidityCurves: ['marketData', 'liquidityCurves'] as const,
    behaviouralModels: ['marketData', 'behaviouralModels'] as const,
    curveHistory: (curveId: string, months?: number) =>
      ['marketData', 'curveHistory', curveId, months] as const,
  },

  // --- Config / Master Data ---
  config: {
    rules: ['config', 'rules'] as const,
    clients: ['config', 'clients'] as const,
    products: ['config', 'products'] as const,
    businessUnits: ['config', 'businessUnits'] as const,
    users: ['config', 'users'] as const,
    shocks: ['config', 'shocks'] as const,
    rateCards: ['config', 'rateCards'] as const,
    esgGrid: (type: 'transition' | 'physical' | 'greenium') =>
      ['config', 'esgGrid', type] as const,
    rarocInputs: ['config', 'rarocInputs'] as const,
    approvalMatrix: ['config', 'approvalMatrix'] as const,
    marketDataSources: ['config', 'marketDataSources'] as const,
  },

  // --- Governance ---
  governance: {
    methodologyChangeRequests: ['governance', 'methodologyChangeRequests'] as const,
    methodologyVersions: ['governance', 'methodologyVersions'] as const,
    approvalTasks: ['governance', 'approvalTasks'] as const,
    pricingDossiers: ['governance', 'pricingDossiers'] as const,
    portfolioSnapshots: ['governance', 'portfolioSnapshots'] as const,
  },

  // --- Audit ---
  audit: {
    log: ['audit', 'log'] as const,
    paginated: (page: number, pageSize: number) =>
      ['audit', 'log', 'paginated', page, pageSize] as const,
  },
} as const;
