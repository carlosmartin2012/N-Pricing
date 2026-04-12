import type { DealStatus, UserRole, WorkflowAction } from './dealWorkflow';

export interface WorkflowStageConfig {
  status: DealStatus;
  label: string;
  color: string;
  isFinal?: boolean;
}

export interface WorkflowConfig {
  id: string;
  name: string;
  stages: WorkflowStageConfig[];
  transitions: WorkflowAction[];
  sla?: Record<DealStatus, number>;
  escalation?: {
    afterHours: number;
    escalateTo: UserRole;
  };
}

/** Default workflow — mirrors the current hardcoded WORKFLOW_TRANSITIONS */
export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  id: 'default',
  name: 'Standard FTP Workflow',
  stages: [
    { status: 'Draft', label: 'Draft', color: '#64748b' },
    { status: 'Pending_Approval', label: 'Pending Approval', color: '#f59e0b' },
    { status: 'Approved', label: 'Approved', color: '#10b981' },
    { status: 'Booked', label: 'Booked', color: '#06b6d4', isFinal: true },
    { status: 'Rejected', label: 'Rejected', color: '#f43f5e' },
    { status: 'Review', label: 'Under Review', color: '#8b5cf6' },
  ],
  transitions: [
    { from: 'Draft', to: 'Pending_Approval', label: 'Submit for Approval', requiredRoles: ['Trader', 'Admin', 'Risk_Manager'], requiresPricingSnapshot: true },
    { from: 'Pending', to: 'Pending_Approval', label: 'Submit for Approval', requiredRoles: ['Trader', 'Admin', 'Risk_Manager'], requiresPricingSnapshot: true },
    { from: 'Pending_Approval', to: 'Approved', label: 'Approve', requiredRoles: ['Risk_Manager', 'Admin'] },
    { from: 'Pending_Approval', to: 'Rejected', label: 'Reject', requiredRoles: ['Risk_Manager', 'Admin'] },
    { from: 'Approved', to: 'Booked', label: 'Book Deal', requiredRoles: ['Trader', 'Admin', 'Risk_Manager'] },
    { from: 'Rejected', to: 'Draft', label: 'Rework', requiredRoles: ['Trader', 'Admin'] },
    { from: 'Review', to: 'Pending_Approval', label: 'Re-submit', requiredRoles: ['Trader', 'Admin', 'Risk_Manager'], requiresPricingSnapshot: true },
  ],
  sla: {
    Draft: 0,
    Pending: 24,
    Pending_Approval: 48,
    Approved: 72,
    Booked: 0,
    Rejected: 0,
    Review: 24,
  },
  escalation: {
    afterHours: 48,
    escalateTo: 'Admin',
  },
};

/** Fast-track workflow — fewer approval gates */
export const FAST_TRACK_WORKFLOW_CONFIG: WorkflowConfig = {
  id: 'fast-track',
  name: 'Fast Track (Auto-Approve under threshold)',
  stages: [
    { status: 'Draft', label: 'Draft', color: '#64748b' },
    { status: 'Approved', label: 'Auto-Approved', color: '#10b981' },
    { status: 'Booked', label: 'Booked', color: '#06b6d4', isFinal: true },
    { status: 'Rejected', label: 'Rejected', color: '#f43f5e' },
  ],
  transitions: [
    { from: 'Draft', to: 'Approved', label: 'Auto-Approve', requiredRoles: ['Trader', 'Admin', 'Risk_Manager'] },
    { from: 'Approved', to: 'Booked', label: 'Book Deal', requiredRoles: ['Trader', 'Admin', 'Risk_Manager'] },
    { from: 'Approved', to: 'Rejected', label: 'Reject', requiredRoles: ['Risk_Manager', 'Admin'] },
    { from: 'Rejected', to: 'Draft', label: 'Rework', requiredRoles: ['Trader', 'Admin'] },
  ],
  sla: { Draft: 0, Pending: 0, Pending_Approval: 0, Approved: 24, Booked: 0, Rejected: 0, Review: 0 },
};

/** Committee workflow — double approval */
export const COMMITTEE_WORKFLOW_CONFIG: WorkflowConfig = {
  id: 'committee',
  name: 'Committee Review (L1 + L2)',
  stages: [
    { status: 'Draft', label: 'Draft', color: '#64748b' },
    { status: 'Pending_Approval', label: 'L1 Review', color: '#f59e0b' },
    { status: 'Review', label: 'Committee Review', color: '#8b5cf6' },
    { status: 'Approved', label: 'Approved', color: '#10b981' },
    { status: 'Booked', label: 'Booked', color: '#06b6d4', isFinal: true },
    { status: 'Rejected', label: 'Rejected', color: '#f43f5e' },
  ],
  transitions: [
    { from: 'Draft', to: 'Pending_Approval', label: 'Submit to L1', requiredRoles: ['Trader', 'Admin'], requiresPricingSnapshot: true },
    { from: 'Pending_Approval', to: 'Review', label: 'Escalate to Committee', requiredRoles: ['Risk_Manager', 'Admin'] },
    { from: 'Pending_Approval', to: 'Rejected', label: 'Reject', requiredRoles: ['Risk_Manager', 'Admin'] },
    { from: 'Review', to: 'Approved', label: 'Committee Approve', requiredRoles: ['Admin'] },
    { from: 'Review', to: 'Rejected', label: 'Committee Reject', requiredRoles: ['Admin'] },
    { from: 'Approved', to: 'Booked', label: 'Book Deal', requiredRoles: ['Trader', 'Admin', 'Risk_Manager'] },
    { from: 'Rejected', to: 'Draft', label: 'Rework', requiredRoles: ['Trader', 'Admin'] },
  ],
  sla: { Draft: 0, Pending: 0, Pending_Approval: 24, Approved: 48, Booked: 0, Rejected: 0, Review: 72 },
  escalation: { afterHours: 72, escalateTo: 'Admin' },
};

export const WORKFLOW_PRESETS: WorkflowConfig[] = [
  DEFAULT_WORKFLOW_CONFIG,
  FAST_TRACK_WORKFLOW_CONFIG,
  COMMITTEE_WORKFLOW_CONFIG,
];
