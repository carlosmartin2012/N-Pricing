import type {
  ApprovalTask,
  ApprovalTaskRole,
  GeneralRule,
  MethodologyChangeAction,
  MethodologyChangeOperation,
  MethodologyChangeRequest,
  MethodologyVersion,
} from '../../types';
import {
  buildCorrelation,
  buildDefaultRuleOperation,
  buildFingerprint,
  cloneRule,
  cloneValue,
  createGovernanceId,
  nowIso,
  sortRules,
} from './common';

export function buildMethodologyFingerprint(rules: GeneralRule[], configSeed?: unknown): string {
  return buildFingerprint({
    rules: sortRules(rules).map((rule) => ({
      id: rule.id,
      businessUnit: rule.businessUnit,
      product: rule.product,
      segment: rule.segment,
      tenor: rule.tenor,
      baseMethod: rule.baseMethod,
      baseReference: rule.baseReference || '',
      spreadMethod: rule.spreadMethod,
      liquidityReference: rule.liquidityReference || '',
      strategicSpread: rule.strategicSpread,
      formulaSpec: rule.formulaSpec || null,
    })),
    configSeed: configSeed || null,
  });
}

export function getLiveMethodologyVersionId(rules: GeneralRule[]): string {
  return `LIVE-${buildMethodologyFingerprint(rules)}`;
}

export function createMethodologyVersionSnapshot({
  rules,
  previousVersions,
  actorEmail,
  actorName,
  reason,
  sourceChangeRequestId,
  configSeed,
}: {
  rules: GeneralRule[];
  previousVersions: MethodologyVersion[];
  actorEmail: string;
  actorName: string;
  reason: string;
  sourceChangeRequestId?: string;
  configSeed?: unknown;
}): MethodologyVersion {
  const nextSequence = previousVersions.length + 1;
  const fingerprint = buildMethodologyFingerprint(rules, configSeed);

  return {
    id: `METH-${String(nextSequence).padStart(4, '0')}-${fingerprint}`,
    label: `Methodology ${String(nextSequence).padStart(4, '0')}`,
    fingerprint,
    ruleCount: rules.length,
    createdAt: nowIso(),
    createdByEmail: actorEmail,
    createdByName: actorName,
    sourceChangeRequestId,
    summary: {
      activeRules: rules.length,
      appliedRequests: previousVersions.length + (sourceChangeRequestId ? 1 : 0),
      reason,
    },
  };
}

export function buildMethodologyChangeRequest({
  title,
  reason,
  action,
  userEmail,
  userName,
  currentRule,
  proposedRule,
  operations,
}: {
  title?: string;
  reason: string;
  action: MethodologyChangeAction;
  userEmail: string;
  userName: string;
  currentRule?: GeneralRule;
  proposedRule?: GeneralRule;
  operations?: MethodologyChangeOperation[];
}): MethodologyChangeRequest {
  const id = createGovernanceId('MCR');
  const derivedOperations = operations?.length
    ? operations
    : [buildDefaultRuleOperation(action, currentRule, proposedRule)];

  return {
    id,
    title:
      title ||
      `${action} ${
        derivedOperations.length > 1
          ? `${derivedOperations.length} methodology items`
          : derivedOperations[0]?.summary || 'methodology change'
      }`,
    reason,
    target: derivedOperations[0]?.entityType || 'RULE',
    action,
    status: 'Pending_Review',
    submittedByEmail: userEmail,
    submittedByName: userName,
    submittedAt: nowIso(),
    correlation: buildCorrelation({ changeRequestId: id }),
    operations: derivedOperations,
  };
}

export function buildBulkRuleImportChangeRequest({
  importedRules,
  userEmail,
  userName,
  reason,
}: {
  importedRules: GeneralRule[];
  userEmail: string;
  userName: string;
  reason: string;
}): MethodologyChangeRequest {
  const operations = importedRules.map((rule) => ({
    entityType: 'RULE' as const,
    entityId: String(rule.id),
    action: 'CREATE' as const,
    summary: `CREATE rule ${rule.businessUnit} / ${rule.product}`,
    currentValue: null,
    proposedValue: rule,
    currentSnapshot: null,
    proposedSnapshot: cloneRule(rule) as unknown as Record<string, unknown>,
  }));

  return buildMethodologyChangeRequest({
    title: `Import ${importedRules.length} methodology rules`,
    reason,
    action: 'IMPORT',
    userEmail,
    userName,
    operations,
  });
}

export function buildConfigChangeOperation<T extends { id: string | number }>(
  entityType: 'RATE_CARD' | 'TRANSITION_GRID' | 'PHYSICAL_GRID' | 'GREENIUM_GRID',
  action: MethodologyChangeAction,
  {
    currentItem,
    proposedItem,
    summary,
  }: {
    currentItem?: T;
    proposedItem?: T;
    summary: string;
  }
): MethodologyChangeOperation {
  const effectiveItem = proposedItem || currentItem;

  return {
    entityType,
    entityId: String(effectiveItem?.id || createGovernanceId(entityType)),
    action,
    summary,
    currentValue: currentItem || null,
    proposedValue: proposedItem || null,
    currentSnapshot: currentItem ? (cloneValue(currentItem) as Record<string, unknown>) : null,
    proposedSnapshot: proposedItem ? (cloneValue(proposedItem) as Record<string, unknown>) : null,
  };
}

export function buildApprovalTaskForMethodologyChange(
  request: MethodologyChangeRequest,
  requiredRole: ApprovalTaskRole = 'Risk_Manager'
): ApprovalTask {
  const id = createGovernanceId('ATK');
  return {
    id,
    scope: 'METHODOLOGY_CHANGE',
    status: 'Pending',
    title: request.title,
    description: request.reason,
    requiredRole,
    submittedByEmail: request.submittedByEmail,
    submittedByName: request.submittedByName,
    submittedAt: request.submittedAt,
    subject: {
      type: 'METHOD_CHANGE',
      id: request.id,
      label: request.title,
    },
    correlation: buildCorrelation({
      ...request.correlation,
      approvalTaskId: id,
    }),
  };
}

export function upsertMethodologyChangeRequest(
  requests: MethodologyChangeRequest[],
  request: MethodologyChangeRequest
): MethodologyChangeRequest[] {
  const exists = requests.some((item) => item.id === request.id);
  if (exists) {
    return requests.map((item) => (item.id === request.id ? request : item));
  }

  return [request, ...requests];
}

export function upsertApprovalTask(tasks: ApprovalTask[], task: ApprovalTask): ApprovalTask[] {
  const exists = tasks.some((item) => item.id === task.id);
  if (exists) {
    return tasks.map((item) => (item.id === task.id ? task : item));
  }

  return [task, ...tasks];
}

export function canReviewMethodologyChangeRequest(
  request: MethodologyChangeRequest,
  actorEmail?: string,
  actorRole?: ApprovalTaskRole
): boolean {
  if (!actorEmail || !actorRole) return false;
  if (!['Admin', 'Risk_Manager'].includes(actorRole)) return false;
  if (request.submittedByEmail === actorEmail) return false;
  return request.status === 'Pending_Review';
}

export function reviewMethodologyChangeRequest(
  request: MethodologyChangeRequest,
  {
    actorEmail,
    actorName,
    decision,
    comment,
  }: {
    actorEmail: string;
    actorName: string;
    decision: 'Approved' | 'Rejected';
    comment?: string;
  }
): MethodologyChangeRequest {
  return {
    ...request,
    status: decision,
    reviewedByEmail: actorEmail,
    reviewedByName: actorName,
    reviewedAt: nowIso(),
    reviewComment: comment,
  };
}
