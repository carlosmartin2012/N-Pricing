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

  // --- CLV + 360 (Phase 6) ---
  clv: {
    timeline: (clientId: string) => ['clv', 'timeline', clientId] as const,
    ltvHistory: (clientId: string) => ['clv', 'ltv', clientId] as const,
    nba: (clientId: string, onlyOpen: boolean) => ['clv', 'nba', clientId, onlyOpen] as const,
    pipelineNba: (status: string) => ['clv', 'pipeline', 'nba', status] as const,
    previewImpact: (clientId: string, fingerprint: string) =>
      ['clv', 'preview-impact', clientId, fingerprint] as const,
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

  // --- Target Grid (Ola 1) ---
  targetGrid: {
    snapshots: ['targetGrid', 'snapshots'] as const,
    snapshot: (id: string) => ['targetGrid', 'snapshots', id] as const,
    cells: (snapshotId: string) => ['targetGrid', 'cells', snapshotId] as const,
    diff: (fromId: string, toId: string) => ['targetGrid', 'diff', fromId, toId] as const,
    templates: ['targetGrid', 'templates'] as const,
  },

  // --- Pricing Discipline (Ola 2) ---
  discipline: {
    kpis: (entityId?: string) => ['discipline', 'kpis', entityId] as const,
    variances: ['discipline', 'variances'] as const,
    bands: ['discipline', 'bands'] as const,
    exceptions: ['discipline', 'exceptions'] as const,
    scorecards: (originatorId: string) => ['discipline', 'scorecards', originatorId] as const,
    cohortBreakdown: (product: string, segment: string) =>
      ['discipline', 'cohort', product, segment] as const,
  },

  // --- What-If (Ola 3) ---
  whatIf: {
    sandboxes: ['whatIf', 'sandboxes'] as const,
    sandbox: (id: string) => ['whatIf', 'sandboxes', id] as const,
    impact: (sandboxId: string) => ['whatIf', 'impact', sandboxId] as const,
    elasticity: ['whatIf', 'elasticity'] as const,
    backtests: ['whatIf', 'backtests'] as const,
    backtestResult: (runId: string) => ['whatIf', 'backtests', runId, 'result'] as const,
    benchmarks: ['whatIf', 'benchmarks'] as const,
    benchmarkComparison: (snapshotId: string) =>
      ['whatIf', 'benchmarks', 'compare', snapshotId] as const,
    budget: ['whatIf', 'budget'] as const,
    budgetConsistency: (snapshotId: string) =>
      ['whatIf', 'budget', 'consistency', snapshotId] as const,
  },
} as const;
