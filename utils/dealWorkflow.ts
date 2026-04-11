import { Transaction, FTPResult } from '../types';

// ─── Deal Status Types ──────────────────────────────────────────────────────

export type DealStatus = 'Draft' | 'Pending' | 'Pending_Approval' | 'Approved' | 'Booked' | 'Rejected' | 'Review';
export type UserRole = 'Admin' | 'Trader' | 'Risk_Manager' | 'Auditor';

export interface WorkflowAction {
  from: DealStatus;
  to: DealStatus;
  label: string;
  requiredRoles: UserRole[];
  requiresPricingSnapshot?: boolean;
}

export interface WorkflowResult {
  success: boolean;
  newStatus?: DealStatus;
  error?: string;
  pricingSnapshot?: FTPResult;
}

// ─── Allowed Transitions ────────────────────────────────────────────────────

const WORKFLOW_TRANSITIONS: WorkflowAction[] = [
  // Draft → Pending_Approval (any trader/admin can submit)
  {
    from: 'Draft',
    to: 'Pending_Approval',
    label: 'Submit for Approval',
    requiredRoles: ['Trader', 'Admin', 'Risk_Manager'],
    requiresPricingSnapshot: true,
  },
  // Pending → Pending_Approval (legacy status migration)
  {
    from: 'Pending',
    to: 'Pending_Approval',
    label: 'Submit for Approval',
    requiredRoles: ['Trader', 'Admin', 'Risk_Manager'],
    requiresPricingSnapshot: true,
  },
  // Pending_Approval → Approved (manager or risk only)
  {
    from: 'Pending_Approval',
    to: 'Approved',
    label: 'Approve',
    requiredRoles: ['Risk_Manager', 'Admin'],
  },
  // Pending_Approval → Rejected
  {
    from: 'Pending_Approval',
    to: 'Rejected',
    label: 'Reject',
    requiredRoles: ['Risk_Manager', 'Admin'],
  },
  // Approved → Booked (finalize)
  {
    from: 'Approved',
    to: 'Booked',
    label: 'Book Deal',
    requiredRoles: ['Trader', 'Admin', 'Risk_Manager'],
  },
  // Rejected → Draft (allow rework)
  {
    from: 'Rejected',
    to: 'Draft',
    label: 'Rework',
    requiredRoles: ['Trader', 'Admin'],
  },
  // Review → Pending_Approval (re-submit after review)
  {
    from: 'Review',
    to: 'Pending_Approval',
    label: 'Re-submit',
    requiredRoles: ['Trader', 'Admin', 'Risk_Manager'],
    requiresPricingSnapshot: true,
  },
];

// ─── Workflow Functions ─────────────────────────────────────────────────────

/**
 * Get available transitions for a deal given the user's role.
 */
export function getAvailableActions(
  currentStatus: DealStatus | string | undefined,
  userRole: UserRole,
): WorkflowAction[] {
  if (!currentStatus) return [];
  return WORKFLOW_TRANSITIONS.filter(
    t => t.from === currentStatus && t.requiredRoles.includes(userRole),
  );
}

/**
 * Check if a deal can be edited (not locked/booked).
 */
export function isDealEditable(deal: Transaction): boolean {
  const lockedStatuses: DealStatus[] = ['Booked', 'Approved', 'Pending_Approval'];
  return !lockedStatuses.includes(deal.status as DealStatus);
}

export function canCreateOrCloneDeals(userRole: UserRole): boolean {
  return userRole !== 'Auditor';
}

export function canEditDeal(deal: Transaction, userRole: UserRole): boolean {
  if (userRole === 'Auditor') return false;
  return isDealEditable(deal) || userRole === 'Admin';
}

export function canDeleteDeal(userRole: UserRole): boolean {
  return userRole !== 'Auditor';
}

export function canBatchRepriceDeals(userRole: UserRole): boolean {
  return userRole !== 'Auditor';
}

/**
 * Check if a specific transition is allowed.
 */
export function canTransition(
  currentStatus: DealStatus | string | undefined,
  targetStatus: DealStatus,
  userRole: UserRole,
): boolean {
  return WORKFLOW_TRANSITIONS.some(
    t => t.from === currentStatus && t.to === targetStatus && t.requiredRoles.includes(userRole),
  );
}

/**
 * Execute a workflow transition. Returns the updated deal fields.
 */
export function executeTransition(
  deal: Transaction,
  targetStatus: DealStatus,
  userRole: UserRole,
  userEmail: string,
  pricingResult?: FTPResult,
): WorkflowResult {
  const currentStatus = deal.status || 'Draft';

  // Find matching transition
  const transition = WORKFLOW_TRANSITIONS.find(
    t => t.from === currentStatus && t.to === targetStatus && t.requiredRoles.includes(userRole),
  );

  if (!transition) {
    return {
      success: false,
      error: `Transition from ${currentStatus} to ${targetStatus} not allowed for role ${userRole}`,
    };
  }

  // Require pricing snapshot on submit
  if (transition.requiresPricingSnapshot && !pricingResult) {
    return {
      success: false,
      error: 'Pricing calculation required before submission',
    };
  }

  return {
    success: true,
    newStatus: targetStatus,
    pricingSnapshot: transition.requiresPricingSnapshot ? pricingResult : undefined,
  };
}

/**
 * Get status badge color for UI.
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'Draft': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    case 'Pending':
    case 'Pending_Approval': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'Review': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'Approved': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'Booked': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    case 'Rejected': return 'bg-red-500/20 text-red-400 border-red-500/30';
    default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
}

/**
 * Format status for display (replace underscores).
 */
export function formatStatus(status: string): string {
  return status.replace(/_/g, ' ');
}
