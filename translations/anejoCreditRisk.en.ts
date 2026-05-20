/**
 * Anejo IX Credit Risk (Circular 6/2021 BdE) translation pack — English.
 *
 * Covers credit provision per Anejo IX, IFRS 9 stage transitions, model
 * backtest reporting. Extracted from `translations.ts` on 2026-05-20.
 */
export const anejoCreditRiskEn = {
  tooltip_formula_anejoCreditCost: 'Expected Loss per Anejo IX (Circular 6/2021). Stage 1 coverage % applied to net exposure after guarantee haircuts.',
  anejo_creditProvision: 'Credit Provision (Anejo IX)',
  anejo_segment: 'Segment',
  creditRiskDetail: 'Credit Risk Detail (Anejo IX)',
  creditMode: 'Mode',
  creditModeNative: 'Native (BdE Soluciones Alt.)',
  creditModeMirror: 'Mirror (External IFRS 9)',
  creditCoverage: 'Coverage (Stage 1)',
  creditScenarioWeighted: 'Scenario-Weighted',
  creditDay1Provision: 'Day 1 Provision',
  creditMigrationCost: 'Migration Cost / yr',
  creditProbS2: 'P(→ Stage 2)',
  creditProbS3: 'P(S2 → Stage 3)',
  creditELLifetime: 'EL Lifetime',
  creditCapitalParams: 'Capital Params',
  modelBacktest: 'Model Backtest',
  backtestDeals: 'Deals Tested',
  observedDefaultRate: 'Observed Default Rate',
  predictedDefaultRate: 'Predicted Default Rate',
  elAccuracyRatio: 'EL Accuracy Ratio',
  backtestBySegment: 'Accuracy by Segment',
  backtestNote: 'Backtest uses simulated losses for demonstration. Connect to loss history API for production back-testing.',
};

export type AnejoCreditRiskTranslationKeys = typeof anejoCreditRiskEn;
