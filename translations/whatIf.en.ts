/**
 * What-If (Ola 3) translation pack — English.
 *
 * Extracted from `translations.ts` on 2026-05-20 alongside Pricing
 * Discipline. Covers sandbox methodology workflow, elasticity calibration,
 * backtesting and benchmark comparison.
 *
 * Consumers: `getTranslations(lang)` merges this pack so legacy callers
 * continue working unchanged. Namespace-aware callers can use
 * `whatIfTranslations(lang)` from the translations barrel.
 */
export const whatIfEn = {
  whatIf: 'What-If Analysis',
  whatIfDesc: 'Simulate methodology changes, calibrate elasticity, and backtest against history',
  sandboxMethodology: 'Sandbox Methodology',
  createSandbox: 'Create Sandbox',
  publishToGovernance: 'Publish to Governance',
  computeImpact: 'Compute Impact',
  impactReport: 'Impact Report',
  niiDelta: 'NII Delta',
  rarocDelta: 'RAROC Delta',
  volumeAtRisk: 'Volume at Risk',
  cellsAffected: 'Cells Affected',
  elasticityModels: 'Elasticity Models',
  calibrateFromHistory: 'Calibrate from History',
  addExpertModel: 'Add Expert Model',
  slope: 'Slope',
  rSquared: 'R²',
  backtesting: 'Backtesting',
  runBacktest: 'Run Backtest',
  simulatedPnl: 'Simulated P&L',
  actualPnl: 'Actual P&L',
  pnlDelta: 'P&L Delta',
  benchmarkComparison: 'Benchmark Comparison',
  marketRate: 'Market Rate',
  gapVsMarket: 'Gap vs Market',
  budgetConsistency: 'Budget Consistency',
  budgetNii: 'Budget NII',
  gridImpliedNii: 'Grid-Implied NII',
};

export type WhatIfTranslationKeys = typeof whatIfEn;
