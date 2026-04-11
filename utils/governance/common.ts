import type {
  ApprovalTask,
  AuditCorrelation,
  FtpRateCard,
  GeneralRule,
  MethodologyChangeOperation,
  PhysicalRateCard,
  TransitionRateCard,
} from '../../types';

export type ConfigEntity = FtpRateCard | TransitionRateCard | PhysicalRateCard;

export const nowIso = () => new Date().toISOString();

export function createGovernanceId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }

  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

function stableStringify(value: unknown): string {
  if (value == null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right)
  );
  return `{${entries
    .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableStringify(nestedValue)}`)
    .join(',')}}`;
}

function hashValue(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0').toUpperCase();
}

export function buildFingerprint(value: unknown): string {
  return hashValue(stableStringify(value));
}

export function cloneRule(rule: GeneralRule): GeneralRule {
  return JSON.parse(JSON.stringify(rule)) as GeneralRule;
}

export function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function normalizeRuleSnapshot(snapshot?: Record<string, unknown> | null): GeneralRule | null {
  if (!snapshot) return null;
  return snapshot as unknown as GeneralRule;
}

export function sortRules(rules: GeneralRule[]): GeneralRule[] {
  return [...rules].sort((left, right) => left.id - right.id);
}

export function buildCorrelation(seed: Partial<AuditCorrelation> = {}): AuditCorrelation {
  return {
    correlationId: seed.correlationId || createGovernanceId('CORR'),
    dealId: seed.dealId,
    changeRequestId: seed.changeRequestId,
    approvalTaskId: seed.approvalTaskId,
    dossierId: seed.dossierId,
  };
}

export function normalizeCollectionSnapshot<T extends ConfigEntity>(
  snapshot?: Record<string, unknown> | null
): T | null {
  if (!snapshot) return null;
  return snapshot as unknown as T;
}

export function sortConfigItems<T extends ConfigEntity>(items: T[]): T[] {
  return [...items].sort((left, right) => String(left.id).localeCompare(String(right.id)));
}

export function buildTaskDecisionFields(
  actorEmail: string,
  actorName: string
): Pick<ApprovalTask, 'decidedByEmail' | 'decidedByName' | 'decidedAt'> {
  return {
    decidedByEmail: actorEmail,
    decidedByName: actorName,
    decidedAt: nowIso(),
  };
}

export function buildDefaultRuleOperation(
  action: MethodologyChangeOperation['action'],
  currentRule?: GeneralRule,
  proposedRule?: GeneralRule
): MethodologyChangeOperation {
  const effectiveRule = proposedRule || currentRule;
  return {
    entityType: 'RULE',
    entityId: String(effectiveRule?.id || createGovernanceId('RULE')),
    action,
    summary: `${action} rule ${effectiveRule?.businessUnit || 'Unknown BU'} / ${effectiveRule?.product || 'Unknown Product'}`,
    currentValue: currentRule || null,
    proposedValue: proposedRule || null,
    currentSnapshot: currentRule ? (cloneRule(currentRule) as unknown as Record<string, unknown>) : null,
    proposedSnapshot: proposedRule ? (cloneRule(proposedRule) as unknown as Record<string, unknown>) : null,
  };
}
