import React from 'react';
import { TextInput, InputGroup } from '../../../ui/LayoutComponents';
import type { ApprovalMatrixConfig } from '../../../../types';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  XCircle,
} from 'lucide-react';

export interface ApprovalMatrixEditorProps {
  approvalMatrix?: ApprovalMatrixConfig;
  approvalMatrixDraft: ApprovalMatrixConfig | null;
  onDraftChange: (key: keyof ApprovalMatrixConfig, value: string) => void;
  onResetDraft: () => void;
  onSubmit: () => void;
  canGovern: boolean;
}

const ApprovalMatrixEditor: React.FC<ApprovalMatrixEditorProps> = ({
  approvalMatrix,
  approvalMatrixDraft,
  onDraftChange,
  onResetDraft,
  onSubmit,
}) => {
  const isDirty =
    approvalMatrixDraft && JSON.stringify(approvalMatrixDraft) !== JSON.stringify(approvalMatrix);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <ShieldCheck size={120} className="text-amber-500" />
      </div>

      <h3 className="text-lg font-bold text-white mb-2">Approval Matrix Configuration</h3>
      <p className="text-xs text-slate-400 mb-6">
        Define the RAROC hurdles that trigger each approval route. Governance actions now go through a maker-checker
        queue before they hit the live ruleset.
      </p>

      <div className="space-y-6">
        <div className="flex items-center gap-4 p-4 bg-emerald-950/20 border border-emerald-900/50 rounded-md">
          <div className="p-2 bg-emerald-900/50 rounded-full">
            <CheckCircle2 size={24} className="text-emerald-400" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-emerald-400 uppercase">Auto Approval</h4>
            <p className="text-[10px] text-slate-500">Deals exceeding this RAROC are automatically approved.</p>
          </div>
          <div className="w-32">
            <InputGroup label="Min RAROC (%)">
              <TextInput
                type="number"
                value={approvalMatrixDraft?.autoApprovalThreshold}
                onChange={(e) => onDraftChange('autoApprovalThreshold', e.target.value)}
                className="text-right font-bold text-emerald-400"
              />
            </InputGroup>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4 bg-amber-950/20 border border-amber-900/50 rounded-md">
          <div className="p-2 bg-amber-900/50 rounded-full">
            <AlertTriangle size={24} className="text-amber-400" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-amber-400 uppercase">L1 Manager Review</h4>
            <p className="text-[10px] text-slate-500">Requires desk head sign-off.</p>
          </div>
          <div className="w-32">
            <InputGroup label="Min RAROC (%)">
              <TextInput
                type="number"
                value={approvalMatrixDraft?.l1Threshold}
                onChange={(e) => onDraftChange('l1Threshold', e.target.value)}
                className="text-right font-bold text-amber-400"
              />
            </InputGroup>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4 bg-red-950/20 border border-red-900/50 rounded-md">
          <div className="p-2 bg-red-900/50 rounded-full">
            <TrendingUp size={24} className="text-red-400" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-red-400 uppercase">Pricing Committee (L2)</h4>
            <p className="text-[10px] text-slate-500">Mandatory escalation to ALCO/Pricing Committee.</p>
          </div>
          <div className="w-32">
            <InputGroup label="Min RAROC (%)">
              <TextInput
                type="number"
                value={approvalMatrixDraft?.l2Threshold}
                onChange={(e) => onDraftChange('l2Threshold', e.target.value)}
                className="text-right font-bold text-red-400"
              />
            </InputGroup>
          </div>
        </div>

        <div className="text-center p-4 border border-dashed border-slate-700 rounded text-slate-500 text-xs">
          <XCircle size={16} className="mx-auto mb-1 text-slate-600" />
          Deals below L2 threshold are automatically rejected.
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onResetDraft}
            className="px-4 py-2 text-xs text-slate-400 hover:text-white"
          >
            Reset Draft
          </button>
          <button
            onClick={onSubmit}
            disabled={!isDirty}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded disabled:opacity-50"
          >
            Submit Threshold Change
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApprovalMatrixEditor;
