/**
 * Governance bounded context — public surface.
 *
 * Consumers:
 *   - utils/pricingEngine.ts (orchestrator)
 *   - utils/governanceWorkflows.ts (workflow layer)
 *   - server/routes/deals.ts (approval handler)
 *
 * Internals (approvalLevel.ts, governanceMode.ts) are never imported
 * directly — always via this barrel.
 */

export {
  resolveApprovalLevel,
  DEFAULT_EVA_BANDS,
  computeEvaBp,
} from './approvalLevel';

export type { ApprovalLevel } from './approvalLevel';

export { getGovernanceMode } from './governanceMode';
export type { GovernanceMode } from './governanceMode';
