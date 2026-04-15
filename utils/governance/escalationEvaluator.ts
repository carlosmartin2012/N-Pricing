import type {
  ApprovalEscalation,
  ApprovalEscalationConfig,
  EscalationAction,
  EscalationLevel,
} from '../../types/governance';

/**
 * Pure evaluator for the approval escalation workflow.
 *
 * No DB, no clock, no network. The worker adapter in
 * `server/workers/escalationSweeper.ts` plugs real dependencies in.
 *
 * Rules:
 *   - `open` row whose `dueAt` is still in the future:
 *       - if `now >= dueAt - notifyBeforeHours` and we haven't notified yet
 *         → emit `notify` (the adapter stamps `notified_at`).
 *       - otherwise → `none`.
 *   - `open` row whose `dueAt` has passed:
 *       - if a next level exists → emit `escalate` with newDueAt computed
 *         from the *target* level's config (fallback to the current config
 *         when the target level has no config defined).
 *       - if no next level (Committee) → emit `expire`. The Committee is the
 *         last stop; once it lapses there is nothing above it.
 *   - `resolved` / `escalated` / `expired` rows are terminal → `none`.
 */

const LEVEL_ORDER: EscalationLevel[] = ['L1', 'L2', 'Committee'];

export function promoteLevel(level: EscalationLevel): EscalationLevel | null {
  const idx = LEVEL_ORDER.indexOf(level);
  if (idx < 0 || idx === LEVEL_ORDER.length - 1) return null;
  return LEVEL_ORDER[idx + 1];
}

export function computeDueAt(now: Date, timeoutHours: number): string {
  const due = new Date(now.getTime() + timeoutHours * 3_600_000);
  return due.toISOString();
}

export interface EvaluateInput {
  escalation: ApprovalEscalation;
  /** Configs for this entity, keyed by level. Missing levels are tolerated. */
  configs: Partial<Record<EscalationLevel, ApprovalEscalationConfig>>;
  now: Date;
}

export function evaluateEscalation(input: EvaluateInput): EscalationAction {
  const { escalation, configs, now } = input;

  if (escalation.status !== 'open') return { kind: 'none' };

  const dueAt = new Date(escalation.dueAt);

  if (now < dueAt) {
    const currentConfig = configs[escalation.level];
    if (!currentConfig || currentConfig.notifyBeforeHours <= 0) {
      return { kind: 'none' };
    }
    const notifyThreshold = new Date(
      dueAt.getTime() - currentConfig.notifyBeforeHours * 3_600_000,
    );
    if (now >= notifyThreshold && !escalation.notifiedAt) {
      return { kind: 'notify', reason: 'approaching_due' };
    }
    return { kind: 'none' };
  }

  // Past due → escalate or expire.
  const nextLevel = promoteLevel(escalation.level);
  if (!nextLevel) {
    return { kind: 'expire', reason: 'no_next_level' };
  }

  const targetConfig = configs[nextLevel] ?? configs[escalation.level];
  const timeoutHours = targetConfig?.timeoutHours ?? 24;

  return {
    kind: 'escalate',
    fromLevel: escalation.level,
    toLevel: nextLevel,
    newDueAt: computeDueAt(now, timeoutHours),
  };
}

/**
 * Batch variant for the sweeper: evaluates a list of escalations against a
 * shared config map and returns pairs of (escalation, action). Pure — the
 * adapter decides what to do with each action.
 */
export function sweepEscalations(
  escalations: ApprovalEscalation[],
  configsByEntity: Record<string, Partial<Record<EscalationLevel, ApprovalEscalationConfig>>>,
  now: Date,
): Array<{ escalation: ApprovalEscalation; action: EscalationAction }> {
  return escalations.map((escalation) => ({
    escalation,
    action: evaluateEscalation({
      escalation,
      configs: configsByEntity[escalation.entityId] ?? {},
      now,
    }),
  }));
}
