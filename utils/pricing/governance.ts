/**
 * Backward-compatibility shim — governance bounded context (Ola C-1).
 *
 * @deprecated Import from `utils/pricing/contexts/governance` directly.
 *
 * The real implementation lives in `./contexts/governance/`. This file
 * re-exports the public surface so any remaining external consumer
 * (e.g. code the bank's IT team hasn't updated yet) keeps compiling.
 *
 * Migration status (2026-04-21):
 *   ✅ utils/pricingEngine.ts
 *   ✅ utils/__tests__/governance.test.ts
 *   ✅ components/Calculator/CalculatorRecommendationPanel.tsx
 *   0 internal consumers remaining — this shim can be deleted in a
 *   follow-up PR once we give downstream banks a deprecation window.
 *
 * Find stragglers with:
 *   grep -R "from '.*utils/pricing/governance'" --include '*.ts*'
 */

export {
  resolveApprovalLevel,
  DEFAULT_EVA_BANDS,
  computeEvaBp,
  getGovernanceMode,
} from './contexts/governance';

export type { ApprovalLevel, GovernanceMode } from './contexts/governance';
