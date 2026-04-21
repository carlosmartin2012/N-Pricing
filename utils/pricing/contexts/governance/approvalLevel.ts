/**
 * Approval level resolver — governance bounded context.
 *
 * Historically N-Pricing routed deals using absolute RAROC thresholds
 * (raroc >= 15% → auto). That is inconsistent because the hurdle rate
 * (targetROE) varies by segment and client: a Retail deal clearing 12% RAROC
 * against a 8% hurdle is economic-positive; a Corporate deal clearing 12%
 * against an 18% hurdle is economic-negative.
 *
 * This module wraps both modes behind a flag so the switch is reversible
 * (VITE_GOVERNANCE_MODE = 'RAROC' | 'EVA'). Default EVA with sane bands;
 * fall back to RAROC when the flag explicitly says so.
 */

import type { ApprovalMatrixConfig } from '../../../../types';
import { getGovernanceMode, type GovernanceMode } from './governanceMode';

export type ApprovalLevel = 'Auto' | 'L1_Manager' | 'L2_Committee' | 'Rejected';

export const DEFAULT_EVA_BANDS = {
  autoApprovalEvaBp: 200,
  l1EvaBp: 0,
  l2EvaBp: -100,
};

/**
 * Resolve approval level from either RAROC (legacy) or EVA (new).
 * Returns the level that applies given the configured governance mode.
 *
 * Params:
 *  - raroc: as percent (e.g., 12 for 12%)
 *  - hurdleRate: as percent (e.g., 15 for 15%)
 *  - matrix: ApprovalMatrixConfig, holds both sets of thresholds
 *  - mode: optional override, defaults to VITE_GOVERNANCE_MODE
 */
export const resolveApprovalLevel = (
  raroc: number,
  hurdleRate: number,
  matrix: ApprovalMatrixConfig,
  mode?: GovernanceMode,
): ApprovalLevel => {
  const resolvedMode = mode ?? getGovernanceMode();

  if (resolvedMode === 'EVA') {
    const evaBp = (raroc - hurdleRate) * 100;
    const autoBp = matrix.autoApprovalEvaBp ?? DEFAULT_EVA_BANDS.autoApprovalEvaBp;
    const l1Bp   = matrix.l1EvaBp           ?? DEFAULT_EVA_BANDS.l1EvaBp;
    const l2Bp   = matrix.l2EvaBp           ?? DEFAULT_EVA_BANDS.l2EvaBp;

    if (evaBp >= autoBp) return 'Auto';
    if (evaBp >= l1Bp)   return 'L1_Manager';
    if (evaBp >= l2Bp)   return 'L2_Committee';
    return 'Rejected';
  }

  // Legacy RAROC mode — preserved for rollback during pilot rollout.
  if (raroc >= matrix.autoApprovalThreshold) return 'Auto';
  if (raroc >= matrix.l1Threshold)           return 'L1_Manager';
  if (raroc >= matrix.l2Threshold)           return 'L2_Committee';
  return 'Rejected';
};

/**
 * EVA in basis points (utility for display).
 */
export const computeEvaBp = (raroc: number, hurdleRate: number): number =>
  Math.round((raroc - hurdleRate) * 100);
