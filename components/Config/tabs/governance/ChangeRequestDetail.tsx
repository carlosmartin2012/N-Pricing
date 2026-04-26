import React from 'react';
import { History, ClipboardList } from 'lucide-react';
import type { ApprovalTask, MethodologyChangeRequest, MethodologyVersion } from '../../../../types';
import type { ConfigUser } from '../../configTypes';
import { canReviewMethodologyChangeRequest } from '../../../../utils/governanceWorkflows';
import { reviewRoleAllowed } from './governanceUtils';
import ChangeRequestCard from './ChangeRequestCard';

export interface ChangeRequestDetailProps {
  requests: MethodologyChangeRequest[];
  approvalTasks: ApprovalTask[];
  methodologyVersions: MethodologyVersion[];
  ruleCount: number;
  canGovern: boolean;
  user: ConfigUser;
  onReview: (request: MethodologyChangeRequest, decision: 'Approved' | 'Rejected') => void;
  onApply: (request: MethodologyChangeRequest) => void;
  onRollback: (request: MethodologyChangeRequest) => void;
}

const ChangeRequestDetail: React.FC<ChangeRequestDetailProps> = ({
  requests,
  approvalTasks,
  methodologyVersions,
  ruleCount,
  canGovern,
  user,
  onReview,
  onApply,
  onRollback,
}) => {
  const currentVersion = methodologyVersions[0];
  const openTasks = approvalTasks.filter((task) => task.status === 'Pending');

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h3 className="text-lg font-bold text-white">Methodology Governance Queue</h3>
            <p className="text-xs text-slate-400 mt-1">
              Submitters cannot self-approve. Admin and Risk Manager roles can review and apply queued changes.
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10px] tracking-normal text-slate-500">Active Ruleset</div>
            <div className="text-sm font-semibold text-cyan-400">
              {currentVersion?.label || 'Live governance baseline'}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              {currentVersion?.id || `LIVE-${ruleCount} rules`}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {requests.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-700 p-4 text-center text-sm text-slate-500">
              No methodology requests yet.
            </div>
          )}

          {requests.map((request) => {
            const requestTask = approvalTasks.find(
              (task) => task.scope === 'METHODOLOGY_CHANGE' && task.subject.id === request.id
            );
            const reviewBlocked =
              !canReviewMethodologyChangeRequest(request, user?.email, user?.role) ||
              !reviewRoleAllowed(requestTask?.requiredRole, user?.role);

            return (
              <ChangeRequestCard
                key={request.id}
                request={request}
                requestTask={requestTask}
                reviewBlocked={reviewBlocked}
                canGovern={canGovern}
                onReview={onReview}
                onApply={onApply}
                onRollback={onRollback}
              />
            );
          })}
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <History size={16} className="text-cyan-400" />
            <h3 className="text-base font-bold text-white">Methodology Version Log</h3>
          </div>

          <div className="space-y-3">
            {methodologyVersions.length === 0 && (
              <div className="rounded border border-dashed border-slate-700 p-4 text-xs text-slate-500">
                The live rule set is still on the baseline fingerprint. The first applied governance change will
                stamp version history here.
              </div>
            )}

            {methodologyVersions.slice(0, 5).map((version) => (
              <div key={version.id} className="rounded border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-cyan-300">{version.label}</div>
                    <div className="text-[10px] font-mono text-slate-500">{version.id}</div>
                  </div>
                  <div className="text-right text-[10px] text-slate-500">
                    <div>{version.ruleCount} active rules</div>
                    <div>{new Date(version.createdAt).toLocaleString('en-GB')}</div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-400">{version.summary.reason}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList size={16} className="text-amber-400" />
            <h3 className="text-base font-bold text-white">Open Approval Tasks</h3>
          </div>

          <div className="space-y-3">
            {openTasks.length === 0 && (
              <div className="rounded border border-dashed border-slate-700 p-4 text-xs text-slate-500">
                No open approval tasks right now.
              </div>
            )}

            {openTasks.slice(0, 8).map((task) => (
              <div key={task.id} className="rounded border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-100">{task.title}</div>
                    <div className="text-[10px] tracking-normal text-slate-500">
                      {task.scope} • {task.requiredRole}
                    </div>
                  </div>
                  <div className="text-[10px] text-amber-400">{task.status}</div>
                </div>
                <div className="mt-2 text-xs text-slate-400">{task.description}</div>
                <div className="mt-2 text-[10px] text-slate-500">
                  Submitted by {task.submittedByName} • {new Date(task.submittedAt).toLocaleString('en-GB')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChangeRequestDetail;
