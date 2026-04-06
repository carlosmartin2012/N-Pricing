import React, { useMemo, useState } from 'react';
import { Drawer } from '../../ui/Drawer';
import { GeneralRule, FtpRateCard, BusinessUnit } from '../../../types';
import { Search, Plus, FileSpreadsheet, Upload } from 'lucide-react';
import { useAudit } from '../../../hooks/useAudit';
import { useData } from '../../../contexts/DataContext';
import { supabaseService } from '../../../utils/supabaseService';
import { downloadTemplate, parseExcel } from '../../../utils/excelUtils';
import {
  buildApprovalTaskForMethodologyChange,
  buildBulkRuleImportChangeRequest,
  buildMethodologyChangeRequest,
  upsertApprovalTask,
  upsertMethodologyChangeRequest,
} from '../../../utils/governanceWorkflows';
import type { ConfigUser } from '../configTypes';
import GeneralRuleEditor from './GeneralRuleEditor';
import GeneralRulesTable from './GeneralRulesTable';
import {
  createDefaultRuleDraft,
  createImportedRules,
  matchesRuleSearch,
  normalizeRuleDraft,
} from './generalRulesUtils';

interface Props {
  rules: GeneralRule[];
  businessUnits: BusinessUnit[];
  ftpRateCards: FtpRateCard[];
  user: ConfigUser;
}

const GeneralRulesTab: React.FC<Props> = ({ rules, businessUnits, ftpRateCards, user }) => {
  const data = useData();
  const logAudit = useAudit(user);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<GeneralRule>>({});
  const [searchTerm, setSearchTerm] = useState('');

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingRule({});
  };

  const handleAddNewRule = () => {
    setEditingRule(createDefaultRuleDraft());
    setDrawerOpen(true);
  };

  const handleEditRule = (rule: GeneralRule) => {
    setEditingRule(rule);
    setDrawerOpen(true);
  };

  const handleSaveRule = async () => {
    if (editingRule.product) {
      const nextId = Math.max(...rules.map((r) => r.id), 0) + 1;
      const finalRule = normalizeRuleDraft(editingRule, nextId);
      const existingRule = rules.find((rule) => rule.id === finalRule.id);
      const changeRequest = buildMethodologyChangeRequest({
        action: existingRule ? 'UPDATE' : 'CREATE',
        reason: existingRule
          ? `Update methodology rule ${finalRule.id} (${finalRule.businessUnit} / ${finalRule.product})`
          : `Create methodology rule ${finalRule.businessUnit} / ${finalRule.product}`,
        userEmail: user?.email || 'unknown',
        userName: user?.name || 'Unknown User',
        currentRule: existingRule,
        proposedRule: finalRule,
      });
      const approvalTask = buildApprovalTaskForMethodologyChange(changeRequest);
      const nextRequests = upsertMethodologyChangeRequest(data.methodologyChangeRequests, changeRequest);
      const nextTasks = upsertApprovalTask(data.approvalTasks, approvalTask);

      data.setMethodologyChangeRequests(nextRequests);
      data.setApprovalTasks(nextTasks);
      await Promise.all([
        supabaseService.saveMethodologyChangeRequests(nextRequests),
        supabaseService.saveApprovalTasks(nextTasks),
      ]);

      logAudit({
        action: existingRule ? 'SUBMIT_RULE_UPDATE' : 'SUBMIT_RULE_CREATE',
        module: 'METHODOLOGY',
        description: `${existingRule ? 'Submitted update' : 'Submitted creation'} request for ${finalRule.businessUnit} - ${finalRule.product}`,
        details: {
          changeRequestId: changeRequest.id,
          approvalTaskId: approvalTask.id,
        },
      });

      closeDrawer();
    }
  };

  const handleDeleteRule = async (id: number) => {
    const rule = rules.find((r) => r.id === id);
    if (!rule) return;
    const changeRequest = buildMethodologyChangeRequest({
      action: 'DELETE',
      reason: `Delete methodology rule ${id} (${rule.product})`,
      userEmail: user?.email || 'unknown',
      userName: user?.name || 'Unknown User',
      currentRule: rule,
    });
    const approvalTask = buildApprovalTaskForMethodologyChange(changeRequest);
    const nextRequests = upsertMethodologyChangeRequest(data.methodologyChangeRequests, changeRequest);
    const nextTasks = upsertApprovalTask(data.approvalTasks, approvalTask);

    data.setMethodologyChangeRequests(nextRequests);
    data.setApprovalTasks(nextTasks);
    await Promise.all([
      supabaseService.saveMethodologyChangeRequests(nextRequests),
      supabaseService.saveApprovalTasks(nextTasks),
    ]);

    logAudit({
      action: 'SUBMIT_RULE_DELETE',
      module: 'METHODOLOGY',
      description: `Submitted delete request for methodology rule ${id} (${rule.product})`,
      details: {
        changeRequestId: changeRequest.id,
        approvalTaskId: approvalTask.id,
      },
    });
  };

  const handleDownloadRulesTemplate = async () => {
    const liveData = rules.map((r) => ({
      BusinessUnit: r.businessUnit,
      Product: r.product,
      Segment: r.segment,
      Tenor: r.tenor,
      BaseMethod: r.baseMethod,
      BaseReference: r.baseReference,
      SpreadMethod: r.spreadMethod,
      LiquidityReference: r.liquidityReference,
      StrategicSpread: r.strategicSpread,
    }));
    await downloadTemplate('METHODOLOGY', 'Methodology_Rules_Export', liveData);
  };

  const handleImportRules = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const importedRows = await parseExcel(file);
      const startingId = Math.max(...rules.map((r) => r.id), 0) + 1;
      const newRules = createImportedRules(importedRows, startingId);
      const changeRequest = buildBulkRuleImportChangeRequest({
        importedRules: newRules,
        userEmail: user?.email || 'unknown',
        userName: user?.name || 'Unknown User',
        reason: `Bulk import of ${newRules.length} methodology rules`,
      });
      const approvalTask = buildApprovalTaskForMethodologyChange(changeRequest, 'Admin');
      const nextRequests = upsertMethodologyChangeRequest(data.methodologyChangeRequests, changeRequest);
      const nextTasks = upsertApprovalTask(data.approvalTasks, approvalTask);

      data.setMethodologyChangeRequests(nextRequests);
      data.setApprovalTasks(nextTasks);
      await Promise.all([
        supabaseService.saveMethodologyChangeRequests(nextRequests),
        supabaseService.saveApprovalTasks(nextTasks),
      ]);

      logAudit({
        action: 'SUBMIT_RULE_IMPORT',
        module: 'METHODOLOGY',
        description: `Submitted import request for ${newRules.length} methodology rules from Excel`,
        details: {
          changeRequestId: changeRequest.id,
          approvalTaskId: approvalTask.id,
          importedRules: newRules.length,
        },
      });
      e.target.value = '';
    }
  };

  const filteredRules = useMemo(
    () => rules.filter((rule) => matchesRuleSearch(rule, searchTerm, ftpRateCards)),
    [rules, searchTerm, ftpRateCards]
  );
  const pendingRequests = useMemo(
    () =>
      data.methodologyChangeRequests.filter((request) => ['Pending_Review', 'Approved'].includes(request.status))
        .length,
    [data.methodologyChangeRequests]
  );

  return (
    <>
      {pendingRequests > 0 && (
        <div className="mx-4 mt-4 rounded-lg border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-xs text-amber-200">
          {pendingRequests} methodology request{pendingRequests === 1 ? '' : 's'} waiting in the governance queue.
        </div>
      )}

      {/* General Toolbar */}
      <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900">
        <div className="flex gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search rules..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 w-full sm:w-64"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadRulesTemplate}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 text-amber-400 rounded border border-slate-700 text-xs hover:bg-slate-700"
            title="Download Template"
          >
            <FileSpreadsheet size={12} /> Template
          </button>
          <label className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 text-cyan-400 rounded border border-slate-700 text-xs hover:bg-slate-700 cursor-pointer">
            <Upload size={12} /> Import
            <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleImportRules} />
          </label>
          <button
            onClick={handleAddNewRule}
            className="flex items-center gap-1 px-3 py-1.5 bg-cyan-900/40 text-cyan-400 rounded border border-cyan-800 text-xs hover:bg-cyan-900/60 font-bold"
          >
            <Plus size={12} /> Add Rule
          </button>
        </div>
      </div>

      <GeneralRulesTable rules={filteredRules} onEditRule={handleEditRule} onDeleteRule={handleDeleteRule} />

      {/* Edit Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        title={editingRule.id ? 'Edit Rule' : 'New Rule'}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={closeDrawer} className="px-4 py-2 text-xs text-slate-400 hover:text-white">
              Cancel
            </button>
            <button
              onClick={handleSaveRule}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded"
            >
              Submit Change
            </button>
          </div>
        }
      >
        <GeneralRuleEditor
          editingRule={editingRule}
          businessUnits={businessUnits}
          ftpRateCards={ftpRateCards}
          onChange={(updates) => setEditingRule((prev) => ({ ...prev, ...updates }))}
        />
      </Drawer>
    </>
  );
};

export default GeneralRulesTab;
