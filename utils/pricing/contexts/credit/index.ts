/**
 * Credit bounded context — public surface (Ola C-5).
 *
 * The biggest context in the motor. Groups:
 *   - creditRiskEngine    — Anejo segmentation, EAD, backtest, migration cost,
 *                           scenario-weighted coverage, full lifetime EL.
 *   - creditLifecycle     — IFRS9 Stage/SICR detection, PD term structure,
 *                           lifetime EL computation, lifecycle assessment.
 *   - delegationEngine    — ApprovalTier resolution for commercial limits
 *                           (separate from the governance approval level).
 *
 * Strategy: re-export from the flat modules. The real split lands when each
 * of these grows past its comfort zone (creditRiskEngine is already 565
 * LOC — candidate for internal sub-contexts).
 */

// creditRiskEngine
export {
  classifyAnejoSegment,
  calculateAnejoCreditRisk,
  calculateEAD,
  backtestCreditRisk,
  calculateScenarioWeightedCoverage,
  calculateMigrationCost,
  calculateELLifetime,
  calculateFullCreditRisk,
} from '../../creditRiskEngine';

export type {
  CreditRiskInput,
  ForwardLookingInput,
  BacktestRecord,
  BacktestResult,
} from '../../creditRiskEngine';

// creditLifecycle (IFRS9)
export {
  detectSICR,
  buildPdTermStructure,
  calculateLifetimeEL,
  assessCreditLifecycle,
} from '../../creditLifecycle';

export type {
  IFRS9Stage,
  SICRInputs,
  SICRResult,
  LifetimeELInput,
  LifetimeELResult,
} from '../../creditLifecycle';

// delegationEngine
export {
  DEFAULT_DELEGATION_MATRIX,
  resolveDelegation,
  tierToLegacyApprovalLevel,
} from '../../delegationEngine';

export type {
  ApprovalTier,
  DelegationRule,
  DelegationInput,
  DelegationResult,
} from '../../delegationEngine';
