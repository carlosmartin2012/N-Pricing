import type {
  GeneralRule,
  MethodologyChangeAction,
  MethodologyChangeOperation,
  MethodologyChangeRequest,
  MethodologyChangeStatus,
} from '../../../../types';

export const statusTone: Record<MethodologyChangeStatus, string> = {
  Pending_Review: 'border-amber-900/50 bg-amber-950/20 text-amber-200',
  Approved: 'border-emerald-900/50 bg-emerald-950/20 text-emerald-200',
  Applied: 'border-cyan-900/50 bg-cyan-950/20 text-cyan-200',
  Rejected: 'border-rose-900/50 bg-rose-950/20 text-rose-200',
  Rolled_Back: 'border-slate-700 bg-slate-900 text-slate-300',
};

export function operationSnapshotToRule(
  operation: MethodologyChangeOperation,
  key: 'currentSnapshot' | 'proposedSnapshot'
) {
  return operation[key] as unknown as GeneralRule | null;
}

export function actionLabel(action: MethodologyChangeAction) {
  if (action === 'CREATE') return 'Create';
  if (action === 'UPDATE') return 'Update';
  if (action === 'DELETE') return 'Delete';
  if (action === 'IMPORT') return 'Import';
  return 'Rollback';
}

export function applyLabelForTarget(target: MethodologyChangeRequest['target']) {
  if (target === 'RULE') return 'Apply to Live Rules';
  if (target === 'RATE_CARD') return 'Apply to Rate Cards';
  if (target === 'TRANSITION_GRID') return 'Apply to Transition Grid';
  if (target === 'PHYSICAL_GRID') return 'Apply to Physical Grid';
  return 'Apply Change';
}

export function reviewRoleAllowed(
  requiredRole: 'Admin' | 'Trader' | 'Risk_Manager' | 'Auditor' | undefined,
  actorRole?: 'Admin' | 'Trader' | 'Risk_Manager' | 'Auditor'
) {
  if (!requiredRole) return true;
  if (requiredRole === 'Admin') return actorRole === 'Admin';
  return actorRole === requiredRole || actorRole === 'Admin';
}

export const sortRequests = (requests: MethodologyChangeRequest[]) =>
  [...requests].sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
