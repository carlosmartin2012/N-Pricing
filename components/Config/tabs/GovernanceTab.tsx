import React from 'react';
import { TextInput, InputGroup } from '../../ui/LayoutComponents';
import { ApprovalMatrixConfig } from '../../../types';
import { ShieldCheck, CheckCircle2, AlertTriangle, TrendingUp, XCircle } from 'lucide-react';
import { useAudit } from '../../../hooks/useAudit';

interface Props {
   approvalMatrix?: ApprovalMatrixConfig;
   setApprovalMatrix?: (config: ApprovalMatrixConfig) => void;
   user: any;
}

const GovernanceTab: React.FC<Props> = ({ approvalMatrix, setApprovalMatrix, user }) => {
   const logAudit = useAudit(user);

   const handleGovernanceChange = (key: keyof ApprovalMatrixConfig, value: string) => {
      if (setApprovalMatrix && approvalMatrix) {
         const numVal = parseFloat(value);
         setApprovalMatrix({
            ...approvalMatrix,
            [key]: numVal
         });

         logAudit({
            action: 'UPDATE_GOVERNANCE',
            module: 'CONFIG',
            description: `Updated governance threshold ${key} to ${numVal}%`
         });
      }
   };

   return (
      <div className="flex-1 p-6 overflow-auto">
         <div className="max-w-2xl mx-auto space-y-8">

            <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                  <ShieldCheck size={120} className="text-amber-500" />
               </div>

               <h3 className="text-lg font-bold text-white mb-2">Approval Matrix Configuration</h3>
               <p className="text-xs text-slate-400 mb-6">
                  Define the RAROC (Risk Adjusted Return on Capital) hurdles that trigger different levels of approval workflows.
                  Calculated as <span className="font-mono text-cyan-400">Net Income / Economic Capital</span>.
               </p>

               <div className="space-y-6">
                  {/* Thresholds Input */}
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
                              value={approvalMatrix?.autoApprovalThreshold}
                              onChange={(e) => handleGovernanceChange('autoApprovalThreshold', e.target.value)}
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
                              value={approvalMatrix?.l1Threshold}
                              onChange={(e) => handleGovernanceChange('l1Threshold', e.target.value)}
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
                              value={approvalMatrix?.l2Threshold}
                              onChange={(e) => handleGovernanceChange('l2Threshold', e.target.value)}
                              className="text-right font-bold text-red-400"
                           />
                        </InputGroup>
                     </div>
                  </div>

                  <div className="text-center p-4 border border-dashed border-slate-700 rounded text-slate-500 text-xs">
                     <XCircle size={16} className="mx-auto mb-1 text-slate-600" />
                     Deals below L2 threshold are automatically rejected.
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
};

export default GovernanceTab;
