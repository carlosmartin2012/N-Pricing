import React, { useEffect, useMemo, useState } from 'react';
import type { ApprovalMatrixConfig } from '../../../types';
import { useData } from '../../../contexts/DataContext';
import type { ConfigUser } from '../configTypes';
import ApprovalMatrixEditor from './governance/ApprovalMatrixEditor';
import ChangeRequestDetail from './governance/ChangeRequestDetail';
import { sortRequests } from './governance/governanceUtils';
import { useGovernanceActions } from './governance/useGovernanceActions';

interface Props {
  approvalMatrix?: ApprovalMatrixConfig;
  setApprovalMatrix?: (config: ApprovalMatrixConfig) => void;
  user: ConfigUser;
}

const GovernanceTab: React.FC<Props> = ({ approvalMatrix, setApprovalMatrix, user }) => {
  const data = useData();
  const canGovern = user?.role === 'Admin' || user?.role === 'Risk_Manager';
  const [approvalMatrixDraft, setApprovalMatrixDraft] = useState<ApprovalMatrixConfig | null>(approvalMatrix || null);

  useEffect(() => {
    setApprovalMatrixDraft(approvalMatrix || null);
  }, [approvalMatrix]);

  const handleGovernanceDraftChange = (key: keyof ApprovalMatrixConfig, value: string) => {
    if (!approvalMatrixDraft) return;
    const numVal = parseFloat(value);
    setApprovalMatrixDraft({
      ...approvalMatrixDraft,
      [key]: Number.isFinite(numVal) ? numVal : 0,
    });
  };

  const { handleSubmitApprovalMatrixChange, handleReview, handleApply, handleRollback } = useGovernanceActions({
    approvalMatrix,
    approvalMatrixDraft,
    setApprovalMatrixDraft,
    setApprovalMatrix,
    user,
    canGovern,
  });

  const requests = useMemo(() => sortRequests(data.methodologyChangeRequests), [data.methodologyChangeRequests]);

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="max-w-5xl mx-auto space-y-8">
        <ApprovalMatrixEditor
          approvalMatrix={approvalMatrix}
          approvalMatrixDraft={approvalMatrixDraft}
          onDraftChange={handleGovernanceDraftChange}
          onResetDraft={() => setApprovalMatrixDraft(approvalMatrix || null)}
          onSubmit={() => void handleSubmitApprovalMatrixChange()}
          canGovern={canGovern}
        />

        <ChangeRequestDetail
          requests={requests}
          approvalTasks={data.approvalTasks}
          methodologyVersions={data.methodologyVersions}
          ruleCount={data.rules.length}
          canGovern={canGovern}
          user={user}
          onReview={(req, decision) => void handleReview(req, decision)}
          onApply={(req) => void handleApply(req)}
          onRollback={(req) => void handleRollback(req)}
        />
      </div>
    </div>
  );
};

export default GovernanceTab;
