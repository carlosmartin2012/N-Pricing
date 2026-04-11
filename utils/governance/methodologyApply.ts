import type {
  ApprovalTask,
  ApprovalTaskStatus,
  GeneralRule,
  MethodologyChangeOperation,
  MethodologyChangeRequest,
} from '../../types';
import {
  buildTaskDecisionFields,
  type ConfigEntity,
  normalizeCollectionSnapshot,
  normalizeRuleSnapshot,
  nowIso,
  sortConfigItems,
  sortRules,
} from './common';

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
