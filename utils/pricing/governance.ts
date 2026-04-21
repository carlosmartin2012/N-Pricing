/**
 * Backward-compatibility shim — governance bounded context (Ola C-1).
 *
 * The real implementation lives in `./contexts/governance/`. This file
 * re-exports the public surface so existing imports
 * `from 'utils/pricing/governance'` keep working without modification.
 *
 * New code should import from the bounded context directly:
 *
 *   import { resolveApprovalLevel } from 'utils/pricing/contexts/governance';
 *
 * This shim is scheduled for removal once all callers are migrated; run
 *   `grep -R "from '.*utils/pricing/governance'" --include '*.ts*'`
 * to find remaining legacy imports.
 */

export {
  resolveApprovalLevel,
  DEFAULT_EVA_BANDS,
  computeEvaBp,
  getGovernanceMode,
} from './contexts/governance';

export type { ApprovalLevel, GovernanceMode } from './contexts/governance';
