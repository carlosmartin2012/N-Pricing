import React from 'react';
import { RotateCcw } from 'lucide-react';
import type { ApprovalTask, MethodologyChangeRequest } from '../../../../types';
import { actionLabel, applyLabelForTarget, statusTone } from './governanceUtils';

export interface ChangeRequestCardProps {
  request: MethodologyChangeRequest;
  requestTask: ApprovalTask | undefined;
  reviewBlocked: boolean;
  canGovern: boolean;
  onReview: (request: MethodologyChangeRequest, decision: 'Approved' | 'Rejected') => void;
  onApply: (request: MethodologyChangeRequest) => void;
  onRollback: (request: MethodologyChangeRequest) => void;
}

const ChangeRequestCard: React.FC<ChangeRequestCardProps> = ({
  request,
  requestTask,
  reviewBlocked,
  canGovern,
  onReview,
  onApply,
  onRollback,
}) => {
  return (
    <div className={`rounded-[var(--nfq-radius-card)] border border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] p-4 ${statusTone[request.status]}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="nfq-label">
            {actionLabel(request.action)} • {request.target}
          </div>
          <h4 className="text-sm font-bold mt-2 text-[color:var(--nfq-text-primary)]">{request.title}</h4>
          <p className="mt-1 text-xs text-[color:var(--nfq-text-secondary)]">{request.reason}</p>
          <div className="mt-2 text-[11px] text-[color:var(--nfq-text-muted)]">
            Submitted by {request.submittedByName} •{' '}
            {new Date(request.submittedAt).toLocaleString('en-GB')}
          </div>
          {requestTask && (
            <div className="text-[11px] text-[color:var(--nfq-text-muted)]">Checker role: {requestTask.requiredRole}</div>
          )}
          {request.reviewedAt && (
            <div className="text-[11px] text-[color:var(--nfq-text-muted)]">
              Reviewed by {request.reviewedByName} •{' '}
              {new Date(request.reviewedAt).toLocaleString('en-GB')}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {request.status === 'Pending_Review' && (
            <>
              <button
                onClick={() => onReview(request, 'Approved')}
                disabled={reviewBlocked}
                className="nfq-button text-xs bg-[var(--nfq-success-subtle)] text-[color:var(--nfq-success)] border border-[var(--nfq-success)] disabled:opacity-40"
              >
                Approve
              </button>
              <button
                onClick={() => onReview(request, 'Rejected')}
                disabled={reviewBlocked}
                className="nfq-button text-xs bg-[var(--nfq-danger-subtle)] text-[color:var(--nfq-danger)] border border-[var(--nfq-danger)] disabled:opacity-40"
              >
                Reject
              </button>
            </>
          )}

          {request.status === 'Approved' && canGovern && (
            <button
              onClick={() => onApply(request)}
              className="nfq-button text-xs bg-[var(--nfq-accent-subtle)] text-[color:var(--nfq-accent)] border border-[var(--nfq-accent)]"
            >
              {applyLabelForTarget(request.target)}
            </button>
          )}

          {request.status === 'Applied' && canGovern && (
            <button
              onClick={() => onRollback(request)}
              className="nfq-button nfq-button-outline text-xs inline-flex items-center gap-1"
            >
              <RotateCcw size={12} />
              Rollback
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {request.operations.map((operation) => (
          <div
            key={`${request.id}-${operation.entityId}-${operation.summary}`}
            className="rounded-[var(--nfq-radius-md)] bg-[var(--nfq-bg-elevated)] px-3 py-2"
          >
            <div className="text-[11px] font-semibold text-[color:var(--nfq-text-secondary)]">{operation.summary}</div>
            <div className="text-[10px] text-[color:var(--nfq-text-muted)] font-mono">
              Entity {operation.entityId} • {actionLabel(operation.action)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChangeRequestCard;
