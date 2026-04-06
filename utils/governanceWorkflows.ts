import type {
  ApprovalMatrixConfig,
  ApprovalTask,
  ApprovalTaskRole,
  ApprovalTaskStatus,
  AuditCorrelation,
  FTPResult,
  FtpRateCard,
  GeneralRule,
  MarketDataSource,
  MethodologyChangeAction,
  MethodologyChangeOperation,
  MethodologyChangeRequest,
  MethodologyVersion,
  PhysicalRateCard,
  PortfolioScenario,
  PortfolioSnapshot,
  PortfolioSnapshotResult,
  PricingDossier,
  PricingDossierStatus,
  PricingRunContext,
  Transaction,
  TransitionRateCard,
} from '../types';
import { buildDossierGroundedContext } from './aiGrounding';
import { batchReprice, DEFAULT_PRICING_SHOCKS, type PricingContext, type PricingShocks } from './pricingEngine';

const nowIso = () => new Date().toISOString();

function createGovernanceId(prefix: string): string {
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

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableStringify(nestedValue)}`).join(',')}}`;
}

function hashValue(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0').toUpperCase();
}

function cloneRule(rule: GeneralRule): GeneralRule {
  return JSON.parse(JSON.stringify(rule)) as GeneralRule;
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeRuleSnapshot(snapshot?: Record<string, unknown> | null): GeneralRule | null {
  if (!snapshot) return null;
  return snapshot as unknown as GeneralRule;
}

function sortRules(rules: GeneralRule[]): GeneralRule[] {
  return [...rules].sort((left, right) => left.id - right.id);
}

function buildCorrelation(seed: Partial<AuditCorrelation> = {}): AuditCorrelation {
  return {
    correlationId: seed.correlationId || createGovernanceId('CORR'),
    dealId: seed.dealId,
    changeRequestId: seed.changeRequestId,
    approvalTaskId: seed.approvalTaskId,
    dossierId: seed.dossierId,
  };
}

function buildDefaultRuleOperation(
  action: MethodologyChangeAction,
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

export function buildMethodologyFingerprint(rules: GeneralRule[], configSeed?: unknown): string {
  const signature = stableStringify({
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

  return hashValue(signature);
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
      `${action} ${derivedOperations.length > 1 ? `${derivedOperations.length} methodology items` : derivedOperations[0]?.summary || 'methodology change'}`,
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
  entityType: 'RATE_CARD' | 'TRANSITION_GRID' | 'PHYSICAL_GRID',
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

function applyRuleOperation(rules: GeneralRule[], operation: MethodologyChangeOperation): GeneralRule[] {
  const currentSnapshot = normalizeRuleSnapshot(operation.currentSnapshot);
  const proposedSnapshot = normalizeRuleSnapshot(operation.proposedSnapshot);

  if (operation.action === 'CREATE' || operation.action === 'IMPORT') {
    if (!proposedSnapshot) return rules;
    const withoutExisting = rules.filter((rule) => rule.id !== proposedSnapshot.id);
    return sortRules([...withoutExisting, proposedSnapshot]);
  }

  if (operation.action === 'UPDATE') {
    if (!proposedSnapshot) return rules;
    return sortRules(rules.map((rule) => (rule.id === proposedSnapshot.id ? proposedSnapshot : rule)));
  }

  if (operation.action === 'DELETE') {
    if (!currentSnapshot) return rules;
    return sortRules(rules.filter((rule) => rule.id !== currentSnapshot.id));
  }

  return rules;
}

function rollbackRuleOperation(rules: GeneralRule[], operation: MethodologyChangeOperation): GeneralRule[] {
  const currentSnapshot = normalizeRuleSnapshot(operation.currentSnapshot);
  const proposedSnapshot = normalizeRuleSnapshot(operation.proposedSnapshot);

  if (operation.action === 'CREATE' || operation.action === 'IMPORT') {
    if (!proposedSnapshot) return rules;
    return sortRules(rules.filter((rule) => rule.id !== proposedSnapshot.id));
  }

  if (operation.action === 'UPDATE') {
    if (!currentSnapshot) return rules;
    return sortRules(rules.map((rule) => (rule.id === currentSnapshot.id ? currentSnapshot : rule)));
  }

  if (operation.action === 'DELETE') {
    if (!currentSnapshot) return rules;
    const withoutExisting = rules.filter((rule) => rule.id !== currentSnapshot.id);
    return sortRules([...withoutExisting, currentSnapshot]);
  }

  return rules;
}

type ConfigEntity = FtpRateCard | TransitionRateCard | PhysicalRateCard;

function normalizeCollectionSnapshot<T extends ConfigEntity>(snapshot?: Record<string, unknown> | null): T | null {
  if (!snapshot) return null;
  return snapshot as unknown as T;
}

function sortConfigItems<T extends ConfigEntity>(items: T[]): T[] {
  return [...items].sort((left, right) => String(left.id).localeCompare(String(right.id)));
}

function applyCollectionOperation<T extends ConfigEntity>(items: T[], operation: MethodologyChangeOperation): T[] {
  const currentSnapshot = normalizeCollectionSnapshot<T>(operation.currentSnapshot);
  const proposedSnapshot = normalizeCollectionSnapshot<T>(operation.proposedSnapshot);

  if (operation.action === 'CREATE' || operation.action === 'IMPORT') {
    if (!proposedSnapshot) return items;
    const withoutExisting = items.filter((item) => String(item.id) !== String(proposedSnapshot.id));
    return sortConfigItems([...withoutExisting, proposedSnapshot]);
  }

  if (operation.action === 'UPDATE') {
    if (!proposedSnapshot) return items;
    return sortConfigItems(
      items.map((item) => (String(item.id) === String(proposedSnapshot.id) ? proposedSnapshot : item))
    );
  }

  if (operation.action === 'DELETE') {
    if (!currentSnapshot) return items;
    return sortConfigItems(items.filter((item) => String(item.id) !== String(currentSnapshot.id)));
  }

  return items;
}

function rollbackCollectionOperation<T extends ConfigEntity>(items: T[], operation: MethodologyChangeOperation): T[] {
  const currentSnapshot = normalizeCollectionSnapshot<T>(operation.currentSnapshot);
  const proposedSnapshot = normalizeCollectionSnapshot<T>(operation.proposedSnapshot);

  if (operation.action === 'CREATE' || operation.action === 'IMPORT') {
    if (!proposedSnapshot) return items;
    return sortConfigItems(items.filter((item) => String(item.id) !== String(proposedSnapshot.id)));
  }

  if (operation.action === 'UPDATE') {
    if (!currentSnapshot) return items;
    return sortConfigItems(
      items.map((item) => (String(item.id) === String(currentSnapshot.id) ? currentSnapshot : item))
    );
  }

  if (operation.action === 'DELETE') {
    if (!currentSnapshot) return items;
    const withoutExisting = items.filter((item) => String(item.id) !== String(currentSnapshot.id));
    return sortConfigItems([...withoutExisting, currentSnapshot]);
  }

  return items;
}

export function applyMethodologyChangeRequestToRules(
  request: MethodologyChangeRequest,
  activeRules: GeneralRule[],
  {
    actorEmail,
    actorName,
  }: {
    actorEmail: string;
    actorName: string;
  }
): { request: MethodologyChangeRequest; rules: GeneralRule[] } {
  const nextRules = request.operations.reduce(applyRuleOperation, [...activeRules]);

  return {
    request: {
      ...request,
      status: 'Applied',
      appliedByEmail: actorEmail,
      appliedByName: actorName,
      appliedAt: nowIso(),
    },
    rules: nextRules,
  };
}

export function rollbackMethodologyChangeRequestToRules(
  request: MethodologyChangeRequest,
  activeRules: GeneralRule[],
  {
    actorEmail,
    actorName,
  }: {
    actorEmail: string;
    actorName: string;
  }
): { request: MethodologyChangeRequest; rules: GeneralRule[] } {
  const nextRules = request.operations.reduce(rollbackRuleOperation, [...activeRules]);

  return {
    request: {
      ...request,
      status: 'Rolled_Back',
      rolledBackByEmail: actorEmail,
      rolledBackByName: actorName,
      rolledBackAt: nowIso(),
    },
    rules: nextRules,
  };
}

export function applyMethodologyChangeRequestToCollection<T extends ConfigEntity>(
  request: MethodologyChangeRequest,
  activeItems: T[],
  {
    actorEmail,
    actorName,
  }: {
    actorEmail: string;
    actorName: string;
  }
): { request: MethodologyChangeRequest; items: T[] } {
  const nextItems = request.operations.reduce(
    (collection, operation) => applyCollectionOperation(collection, operation),
    [...activeItems]
  );

  return {
    request: {
      ...request,
      status: 'Applied',
      appliedByEmail: actorEmail,
      appliedByName: actorName,
      appliedAt: nowIso(),
    },
    items: nextItems,
  };
}

export function rollbackMethodologyChangeRequestToCollection<T extends ConfigEntity>(
  request: MethodologyChangeRequest,
  activeItems: T[],
  {
    actorEmail,
    actorName,
  }: {
    actorEmail: string;
    actorName: string;
  }
): { request: MethodologyChangeRequest; items: T[] } {
  const nextItems = request.operations.reduce(
    (collection, operation) => rollbackCollectionOperation(collection, operation),
    [...activeItems]
  );

  return {
    request: {
      ...request,
      status: 'Rolled_Back',
      rolledBackByEmail: actorEmail,
      rolledBackByName: actorName,
      rolledBackAt: nowIso(),
    },
    items: nextItems,
  };
}

function buildTaskDecisionFields(
  actorEmail: string,
  actorName: string
): Pick<ApprovalTask, 'decidedByEmail' | 'decidedByName' | 'decidedAt'> {
  return {
    decidedByEmail: actorEmail,
    decidedByName: actorName,
    decidedAt: nowIso(),
  };
}

export function updateMethodologyApprovalTasks(
  tasks: ApprovalTask[],
  requestId: string,
  status: ApprovalTaskStatus,
  actorEmail: string,
  actorName: string
): ApprovalTask[] {
  return tasks.map((task) => {
    if (task.scope !== 'METHODOLOGY_CHANGE' || task.subject.id !== requestId) {
      return task;
    }

    return {
      ...task,
      status,
      ...buildTaskDecisionFields(actorEmail, actorName),
    };
  });
}

export function buildPricingRunContext({
  rules,
  methodologyVersions,
  result,
  approvalMatrix,
  shocks = DEFAULT_PRICING_SHOCKS,
  yieldCurveCount,
  liquidityCurveCount,
}: {
  rules: GeneralRule[];
  methodologyVersions: MethodologyVersion[];
  result: FTPResult;
  approvalMatrix: ApprovalMatrixConfig;
  shocks?: PricingShocks;
  yieldCurveCount: number;
  liquidityCurveCount: number;
}): PricingRunContext {
  return {
    methodologyVersionId: methodologyVersions[0]?.id || getLiveMethodologyVersionId(rules),
    matchedMethodology: result.matchedMethodology,
    marketDataAsOf: nowIso().split('T')[0],
    approvalMatrix,
    shocksApplied: {
      interestRate: shocks.interestRate,
      liquiditySpread: shocks.liquiditySpread,
    },
    curveCounts: {
      yield: yieldCurveCount,
      liquidity: liquidityCurveCount,
    },
    ruleCount: rules.length,
  };
}

function buildPricingEvidence(
  deal: Transaction,
  result: FTPResult,
  actorEmail: string,
  actorName: string
): PricingDossier['evidence'] {
  const createdAt = nowIso();
  return [
    {
      id: createGovernanceId('EVD'),
      type: 'PRICING_RECEIPT',
      label: `Pricing receipt for ${deal.id || 'new deal'}`,
      format: 'pdf',
      createdAt,
      createdByEmail: actorEmail,
      createdByName: actorName,
      status: 'Pending_Generation',
      metadata: {
        approvalLevel: result.approvalLevel,
      },
    },
    {
      id: createGovernanceId('EVD'),
      type: 'AUDIT_TRACE',
      label: `Pricing trace ${deal.id || 'new deal'}`,
      format: 'json',
      createdAt,
      createdByEmail: actorEmail,
      createdByName: actorName,
      status: 'Generated',
      metadata: {
        matchedMethodology: result.matchedMethodology,
        formulaUsed: result.formulaUsed || null,
      },
    },
  ];
}

export function buildPricingDossier({
  deal,
  result,
  approvalMatrix,
  shocks,
  rules,
  methodologyVersions,
  currentUser,
  yieldCurveCount,
  liquidityCurveCount,
  marketDataSources = [],
  portfolioSnapshots = [],
  status,
}: {
  deal: Transaction;
  result: FTPResult;
  approvalMatrix: ApprovalMatrixConfig;
  shocks?: PricingShocks;
  rules: GeneralRule[];
  methodologyVersions: MethodologyVersion[];
  currentUser: {
    email: string;
    name: string;
  };
  yieldCurveCount: number;
  liquidityCurveCount: number;
  marketDataSources?: MarketDataSource[];
  portfolioSnapshots?: PortfolioSnapshot[];
  status?: PricingDossierStatus;
}): PricingDossier {
  const id = createGovernanceId('DOS');
  const correlation = buildCorrelation({
    dealId: deal.id,
    dossierId: id,
  });
  const runContext = buildPricingRunContext({
    rules,
    methodologyVersions,
    result,
    approvalMatrix,
    shocks,
    yieldCurveCount,
    liquidityCurveCount,
  });
  const dossierStatus = status || (result.approvalLevel === 'Auto' ? 'Approved' : 'Pending_Approval');
  const timestamp = nowIso();
  const evidence = buildPricingEvidence(deal, result, currentUser.email, currentUser.name);
  const draftDossier: PricingDossier = {
    id,
    dealId: deal.id || createGovernanceId('DEAL'),
    status: dossierStatus,
    title: `Pricing dossier ${deal.id || 'NEW'}`,
    clientId: deal.clientId,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdByEmail: currentUser.email,
    createdByName: currentUser.name,
    methodologyVersionId: runContext.methodologyVersionId,
    approvalLevel: result.approvalLevel,
    dealSnapshot: JSON.parse(JSON.stringify(deal)) as Transaction,
    pricingResult: JSON.parse(JSON.stringify(result)) as FTPResult,
    runContext,
    evidence,
    correlation,
  };
  const groundedContext = buildDossierGroundedContext({
    dossier: draftDossier,
    methodologyVersions,
    marketDataSources,
    portfolioSnapshots,
  });

  return {
    ...draftDossier,
    groundedContext,
    aiResponseTraces: [],
  };
}

export function upsertPricingDossier(dossiers: PricingDossier[], dossier: PricingDossier): PricingDossier[] {
  const exists = dossiers.some((item) => item.dealId === dossier.dealId);
  if (exists) {
    return dossiers.map((item) => (item.dealId === dossier.dealId ? dossier : item));
  }

  return [dossier, ...dossiers];
}

export function mergePricingDossier(existing: PricingDossier | undefined, next: PricingDossier): PricingDossier {
  if (!existing) return next;

  return {
    ...next,
    id: existing.id,
    createdAt: existing.createdAt,
    createdByEmail: existing.createdByEmail,
    createdByName: existing.createdByName,
    correlation: existing.correlation,
    groundedContext: next.groundedContext || existing.groundedContext,
    aiResponseTraces: next.aiResponseTraces?.length ? next.aiResponseTraces : existing.aiResponseTraces,
  };
}

export function buildApprovalTaskForPricingDossier(dossier: PricingDossier): ApprovalTask | null {
  if (dossier.status !== 'Pending_Approval') return null;

  const id = createGovernanceId('ATK');
  const requiredRole: ApprovalTaskRole = dossier.approvalLevel === 'L2_Committee' ? 'Admin' : 'Risk_Manager';

  return {
    id,
    scope: 'DEAL_PRICING',
    status: 'Pending',
    title: `Review ${dossier.dealId}`,
    description: `${dossier.title} requires ${dossier.approvalLevel} review`,
    requiredRole,
    submittedByEmail: dossier.createdByEmail,
    submittedByName: dossier.createdByName,
    submittedAt: dossier.createdAt,
    subject: {
      type: 'DEAL',
      id: dossier.dealId,
      label: dossier.title,
    },
    correlation: buildCorrelation({
      ...dossier.correlation,
      approvalTaskId: id,
    }),
  };
}

export function mergeApprovalTask(existing: ApprovalTask | undefined, next: ApprovalTask | null): ApprovalTask | null {
  if (!next) return null;
  if (!existing) return next;
  if (existing.status !== 'Pending') return next;

  return {
    ...next,
    id: existing.id,
    submittedAt: existing.submittedAt,
    correlation: {
      ...next.correlation,
      approvalTaskId: existing.id,
    },
  };
}

export function updatePricingDossierStatus(
  dossiers: PricingDossier[],
  dealId: string,
  status: PricingDossierStatus
): PricingDossier[] {
  return dossiers.map((dossier) =>
    dossier.dealId === dealId
      ? {
          ...dossier,
          status,
          updatedAt: nowIso(),
        }
      : dossier
  );
}

export function updateDealApprovalTasks(
  tasks: ApprovalTask[],
  dealId: string,
  status: PricingDossierStatus,
  actorEmail: string,
  actorName: string
): ApprovalTask[] {
  return tasks.map((task) => {
    if (task.scope !== 'DEAL_PRICING' || task.subject.id !== dealId) {
      return task;
    }

    let nextStatus: ApprovalTaskStatus = task.status;
    if (status === 'Approved') nextStatus = 'Approved';
    if (status === 'Rejected') nextStatus = 'Rejected';
    if (status === 'Booked') nextStatus = 'Completed';
    if (status === 'Draft') nextStatus = 'Cancelled';

    return {
      ...task,
      status: nextStatus,
      ...(status === 'Draft'
        ? {
            decidedByEmail: undefined,
            decidedByName: undefined,
            decidedAt: undefined,
          }
        : buildTaskDecisionFields(actorEmail, actorName)),
    };
  });
}

function buildPortfolioResult(deal: Transaction, result: FTPResult): PortfolioSnapshotResult {
  return {
    dealId: deal.id || createGovernanceId('DEAL'),
    currency: deal.currency,
    amount: deal.amount,
    raroc: result.raroc,
    finalClientRate: result.finalClientRate,
    approvalLevel: result.approvalLevel,
  };
}

export function buildPortfolioSnapshot({
  name,
  scenario,
  deals,
  approvalMatrix,
  pricingContext,
  createdByEmail,
  createdByName,
}: {
  name: string;
  scenario: PortfolioScenario;
  deals: Transaction[];
  approvalMatrix: ApprovalMatrixConfig;
  pricingContext: PricingContext;
  createdByEmail: string;
  createdByName: string;
}): PortfolioSnapshot {
  const repriced = batchReprice(deals, approvalMatrix, pricingContext, scenario.shocks);
  const results = deals
    .filter((deal) => deal.id && repriced.has(deal.id))
    .map((deal) => buildPortfolioResult(deal, repriced.get(deal.id!) as FTPResult));
  const exposure = results.reduce((total, item) => total + item.amount, 0);
  const averageRaroc = results.length ? results.reduce((total, item) => total + item.raroc, 0) / results.length : 0;
  const averageFinalRate = results.length
    ? results.reduce((total, item) => total + item.finalClientRate, 0) / results.length
    : 0;

  return {
    id: createGovernanceId('PORT'),
    name,
    scenario,
    createdAt: nowIso(),
    createdByEmail,
    createdByName,
    dealIds: results.map((item) => item.dealId),
    totals: {
      exposure,
      averageRaroc,
      averageFinalRate,
      approved: results.filter((item) => item.approvalLevel === 'Auto').length,
      pendingApproval: results.filter((item) => ['L1_Manager', 'L2_Committee'].includes(item.approvalLevel)).length,
      rejected: results.filter((item) => item.approvalLevel === 'Rejected').length,
    },
    results,
  };
}
