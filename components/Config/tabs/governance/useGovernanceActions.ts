import { useCallback } from 'react';
import * as configApi from '../../../../api/config';
import type { ApprovalMatrixConfig, GreeniumRateCard, MethodologyChangeRequest } from '../../../../types';
import { useAudit } from '../../../../hooks/useAudit';
import { useData } from '../../../../contexts/DataContext';
import { ruleService } from '../../../../utils/supabase/rules';
import { saveSystemConfigValue } from '../../../../utils/supabase/systemConfig';
import {
  applyMethodologyChangeRequestToCollection,
  applyMethodologyChangeRequestToRules,
  buildApprovalTaskForMethodologyChange,
  buildMethodologyChangeRequest,
  canReviewMethodologyChangeRequest,
  createMethodologyVersionSnapshot,
  reviewMethodologyChangeRequest,
  rollbackMethodologyChangeRequestToCollection,
  rollbackMethodologyChangeRequestToRules,
  updateMethodologyApprovalTasks,
  upsertApprovalTask,
  upsertMethodologyChangeRequest,
} from '../../../../utils/governanceWorkflows';
import type { ConfigUser } from '../../configTypes';
import { operationSnapshotToRule, reviewRoleAllowed } from './governanceUtils';

interface UseGovernanceActionsParams {
  approvalMatrix?: ApprovalMatrixConfig;
  approvalMatrixDraft: ApprovalMatrixConfig | null;
  setApprovalMatrixDraft: (draft: ApprovalMatrixConfig | null) => void;
  setApprovalMatrix?: (config: ApprovalMatrixConfig) => void;
  user: ConfigUser;
  canGovern: boolean;
}

export function useGovernanceActions({
  approvalMatrix,
  approvalMatrixDraft,
  setApprovalMatrixDraft,
  setApprovalMatrix,
  user,
  canGovern,
}: UseGovernanceActionsParams) {
  const data = useData();
  const logAudit = useAudit(user);
  const persistGreeniumGrid = useCallback(
    (grid: GreeniumRateCard[]) => saveSystemConfigValue('greenium_grid', grid, 'saveEsgGrid:greenium'),
    []
  );

  const persistRuleOperations = useCallback(
    async (request: MethodologyChangeRequest, mode: 'apply' | 'rollback', actorEmail: string) => {
      const versionReason = `${mode === 'apply' ? 'Applied' : 'Rolled back'} change request ${request.id}: ${request.reason}`;

      await Promise.all(
        request.operations.map(async (operation) => {
          if (operation.entityType !== 'RULE') return;

          const currentRule = operationSnapshotToRule(operation, 'currentSnapshot');
          const proposedRule = operationSnapshotToRule(operation, 'proposedSnapshot');

          if (mode === 'apply') {
            if ((operation.action === 'CREATE' || operation.action === 'IMPORT') && proposedRule) {
              await ruleService.saveRule(proposedRule);
              await ruleService.createRuleVersion(proposedRule.id, proposedRule, actorEmail, versionReason);
            }
            if (operation.action === 'UPDATE' && proposedRule) {
              await ruleService.saveRule(proposedRule);
              await ruleService.createRuleVersion(proposedRule.id, proposedRule, actorEmail, versionReason);
            }
            if (operation.action === 'DELETE' && currentRule) {
              await ruleService.createRuleVersion(currentRule.id, currentRule, actorEmail, versionReason);
              await ruleService.deleteRule(currentRule.id);
            }
            return;
          }

          if ((operation.action === 'CREATE' || operation.action === 'IMPORT') && proposedRule) {
            await ruleService.createRuleVersion(proposedRule.id, proposedRule, actorEmail, versionReason);
            await ruleService.deleteRule(proposedRule.id);
          }
          if (operation.action === 'UPDATE' && currentRule) {
            await ruleService.saveRule(currentRule);
            await ruleService.createRuleVersion(currentRule.id, currentRule, actorEmail, versionReason);
          }
          if (operation.action === 'DELETE' && currentRule) {
            await ruleService.saveRule(currentRule);
            await ruleService.createRuleVersion(currentRule.id, currentRule, actorEmail, versionReason);
          }
        })
      );
    },
    []
  );

  const buildVersionConfigSeed = useCallback(
    (
      overrides?: Partial<
        Pick<typeof data, 'ftpRateCards' | 'transitionGrid' | 'physicalGrid' | 'greeniumGrid'> & {
          approvalMatrix: ApprovalMatrixConfig;
        }
      >
    ) => ({
      ftpRateCards: overrides?.ftpRateCards ?? data.ftpRateCards,
      transitionGrid: overrides?.transitionGrid ?? data.transitionGrid,
      physicalGrid: overrides?.physicalGrid ?? data.physicalGrid,
      greeniumGrid: overrides?.greeniumGrid ?? data.greeniumGrid,
      approvalMatrix: overrides?.approvalMatrix ?? approvalMatrixDraft ?? approvalMatrix ?? null,
    }),
    [approvalMatrix, approvalMatrixDraft, data.ftpRateCards, data.transitionGrid, data.physicalGrid, data.greeniumGrid]
  );

  const handleSubmitApprovalMatrixChange = useCallback(async () => {
    if (!approvalMatrix || !approvalMatrixDraft || !user?.email || !user?.name) return;
    if (JSON.stringify(approvalMatrix) === JSON.stringify(approvalMatrixDraft)) return;

    const request = buildMethodologyChangeRequest({
      title: 'Update approval matrix thresholds',
      reason: `Auto ${approvalMatrix.autoApprovalThreshold}% -> ${approvalMatrixDraft.autoApprovalThreshold}%, L1 ${approvalMatrix.l1Threshold}% -> ${approvalMatrixDraft.l1Threshold}%, L2 ${approvalMatrix.l2Threshold}% -> ${approvalMatrixDraft.l2Threshold}%`,
      action: 'UPDATE',
      userEmail: user.email,
      userName: user.name,
      operations: [
        {
          entityType: 'APPROVAL_MATRIX',
          entityId: 'approval_matrix',
          action: 'UPDATE',
          summary: 'UPDATE approval matrix thresholds',
          currentValue: approvalMatrix,
          proposedValue: approvalMatrixDraft,
          currentSnapshot: approvalMatrix as unknown as Record<string, unknown>,
          proposedSnapshot: approvalMatrixDraft as unknown as Record<string, unknown>,
        },
      ],
    });
    const approvalTask = buildApprovalTaskForMethodologyChange(request, 'Admin');
    const nextRequests = upsertMethodologyChangeRequest(data.methodologyChangeRequests, request);
    const persistedTasks = upsertApprovalTask(data.approvalTasks, approvalTask);

    data.setMethodologyChangeRequests(nextRequests);
    data.setApprovalTasks(persistedTasks);
    await Promise.all([
      configApi.saveMethodologyChangeRequests(nextRequests),
      configApi.saveApprovalTasks(persistedTasks),
    ]);

    logAudit({
      action: 'SUBMIT_APPROVAL_MATRIX_UPDATE',
      module: 'SYS_CONFIG',
      description: 'Submitted approval matrix threshold update for governance review',
      details: { changeRequestId: request.id, approvalTaskId: approvalTask.id },
    });
  }, [approvalMatrix, approvalMatrixDraft, data, logAudit, user]);

  const handleReview = useCallback(
    async (request: MethodologyChangeRequest, decision: 'Approved' | 'Rejected') => {
      if (!user?.email || !user?.name || !user.role) return;
      const task = data.approvalTasks.find(
        (candidate) => candidate.scope === 'METHODOLOGY_CHANGE' && candidate.subject.id === request.id
      );
      if (!canReviewMethodologyChangeRequest(request, user.email, user.role)) return;
      if (!reviewRoleAllowed(task?.requiredRole, user.role)) return;

      const reviewedRequest = reviewMethodologyChangeRequest(request, {
        actorEmail: user.email,
        actorName: user.name,
        decision,
      });
      const nextRequests = upsertMethodologyChangeRequest(data.methodologyChangeRequests, reviewedRequest);
      const nextTasks = updateMethodologyApprovalTasks(data.approvalTasks, request.id, decision, user.email, user.name);

      data.setMethodologyChangeRequests(nextRequests);
      data.setApprovalTasks(nextTasks);
      await Promise.all([
        configApi.saveMethodologyChangeRequests(nextRequests),
        configApi.saveApprovalTasks(nextTasks),
      ]);

      logAudit({
        action: decision === 'Approved' ? 'APPROVE_METHOD_CHANGE' : 'REJECT_METHOD_CHANGE',
        module: 'METHODOLOGY',
        description: `${decision} methodology request ${request.id} (${request.title})`,
        details: { changeRequestId: request.id, correlationId: request.correlation.correlationId },
      });
    },
    [data, logAudit, user]
  );

  const finalizeGovernanceChange = useCallback(
    async (
      resultRequest: MethodologyChangeRequest,
      originalRequestId: string,
      taskDecision: 'Completed' | 'Rolled_Back',
      auditAction: string,
      auditDescription: string,
      nextState: {
        rules: typeof data.rules;
        rateCards: typeof data.ftpRateCards;
        transitionGrid: typeof data.transitionGrid;
        physicalGrid: typeof data.physicalGrid;
        greeniumGrid: typeof data.greeniumGrid;
        approvalMatrix: ApprovalMatrixConfig | null;
      }
    ) => {
      if (!user?.email || !user?.name) return;

      const nextRequests = upsertMethodologyChangeRequest(data.methodologyChangeRequests, resultRequest);
      const nextTasks = updateMethodologyApprovalTasks(
        data.approvalTasks,
        originalRequestId,
        taskDecision,
        user.email,
        user.name
      );
      const nextVersion = createMethodologyVersionSnapshot({
        rules: nextState.rules,
        previousVersions: data.methodologyVersions,
        actorEmail: user.email,
        actorName: user.name,
        reason: auditDescription,
        sourceChangeRequestId: originalRequestId,
        configSeed: buildVersionConfigSeed({
          ftpRateCards: nextState.rateCards,
          transitionGrid: nextState.transitionGrid,
          physicalGrid: nextState.physicalGrid,
          greeniumGrid: nextState.greeniumGrid,
          approvalMatrix: nextState.approvalMatrix || approvalMatrixDraft || approvalMatrix || undefined,
        }),
      });
      const nextVersions = [nextVersion, ...data.methodologyVersions];

      data.setRules(nextState.rules);
      data.setFtpRateCards(nextState.rateCards);
      data.setTransitionGrid(nextState.transitionGrid);
      data.setPhysicalGrid(nextState.physicalGrid);
      data.setGreeniumGrid(nextState.greeniumGrid);
      if (nextState.approvalMatrix) {
        setApprovalMatrixDraft(nextState.approvalMatrix);
      }
      data.setMethodologyChangeRequests(nextRequests);
      data.setApprovalTasks(nextTasks);
      data.setMethodologyVersions(nextVersions);

      await Promise.all([
        configApi.saveMethodologyChangeRequests(nextRequests),
        configApi.saveApprovalTasks(nextTasks),
        configApi.saveMethodologyVersions(nextVersions),
      ]);

      logAudit({
        action: auditAction,
        module: 'METHODOLOGY',
        description: `${auditDescription} and created ${nextVersion.label}`,
        details: {
          changeRequestId: originalRequestId,
          methodologyVersionId: nextVersion.id,
          correlationId: resultRequest.correlation.correlationId,
        },
      });
    },
    [approvalMatrix, approvalMatrixDraft, buildVersionConfigSeed, data, logAudit, setApprovalMatrixDraft, user]
  );

  const handleApply = useCallback(
    async (request: MethodologyChangeRequest) => {
      if (!canGovern || !user?.email || !user?.name) return;
      if (request.status !== 'Approved') return;
      if (!window.confirm(`Apply ${request.title}?`)) return;

      let nextRules = data.rules;
      let nextRateCards = data.ftpRateCards;
      let nextTransitionGrid = data.transitionGrid;
      let nextPhysicalGrid = data.physicalGrid;
      let nextGreeniumGrid = data.greeniumGrid;
      let nextApprovalMatrix = approvalMatrixDraft ?? approvalMatrix ?? null;
      let appliedRequest: MethodologyChangeRequest;

      if (request.target === 'RULE') {
        const applied = applyMethodologyChangeRequestToRules(request, data.rules, { actorEmail: user.email, actorName: user.name });
        await persistRuleOperations(request, 'apply', user.email);
        nextRules = applied.rules;
        appliedRequest = applied.request;
      } else if (request.target === 'RATE_CARD') {
        const applied = applyMethodologyChangeRequestToCollection(request, data.ftpRateCards, { actorEmail: user.email, actorName: user.name });
        nextRateCards = applied.items;
        await configApi.saveRateCards(nextRateCards);
        appliedRequest = applied.request;
      } else if (request.target === 'TRANSITION_GRID') {
        const applied = applyMethodologyChangeRequestToCollection(request, data.transitionGrid, { actorEmail: user.email, actorName: user.name });
        nextTransitionGrid = applied.items;
        await configApi.saveEsgGrid('transition', nextTransitionGrid);
        appliedRequest = applied.request;
      } else if (request.target === 'PHYSICAL_GRID') {
        const applied = applyMethodologyChangeRequestToCollection(request, data.physicalGrid, { actorEmail: user.email, actorName: user.name });
        nextPhysicalGrid = applied.items;
        await configApi.saveEsgGrid('physical', nextPhysicalGrid);
        appliedRequest = applied.request;
      } else if (request.target === 'GREENIUM_GRID') {
        const applied = applyMethodologyChangeRequestToCollection(request, data.greeniumGrid as unknown as Parameters<typeof applyMethodologyChangeRequestToCollection>[1], { actorEmail: user.email, actorName: user.name });
        nextGreeniumGrid = applied.items as unknown as typeof data.greeniumGrid;
        await persistGreeniumGrid(nextGreeniumGrid);
        appliedRequest = applied.request;
      } else if (request.target === 'APPROVAL_MATRIX') {
        const proposedApprovalMatrix = request.operations[0]?.proposedSnapshot as ApprovalMatrixConfig | undefined;
        if (!proposedApprovalMatrix || !setApprovalMatrix) return;
        setApprovalMatrix(proposedApprovalMatrix);
        setApprovalMatrixDraft(proposedApprovalMatrix);
        await configApi.saveApprovalMatrix(proposedApprovalMatrix);
        nextApprovalMatrix = proposedApprovalMatrix;
        appliedRequest = { ...request, status: 'Applied', appliedByEmail: user.email, appliedByName: user.name, appliedAt: new Date().toISOString() };
      } else {
        return;
      }

      await finalizeGovernanceChange(appliedRequest, request.id, 'Completed', 'APPLY_METHOD_CHANGE', `Applied ${request.id}: ${request.reason}`, {
        rules: nextRules, rateCards: nextRateCards, transitionGrid: nextTransitionGrid, physicalGrid: nextPhysicalGrid, greeniumGrid: nextGreeniumGrid, approvalMatrix: nextApprovalMatrix,
      });
    },
    [approvalMatrix, approvalMatrixDraft, canGovern, data, finalizeGovernanceChange, persistGreeniumGrid, persistRuleOperations, setApprovalMatrix, setApprovalMatrixDraft, user]
  );

  const handleRollback = useCallback(
    async (request: MethodologyChangeRequest) => {
      if (!canGovern || !user?.email || !user?.name) return;
      if (request.status !== 'Applied') return;
      if (!window.confirm(`Rollback ${request.title} and restore the previous live configuration?`)) return;

      let nextRules = data.rules;
      let nextRateCards = data.ftpRateCards;
      let nextTransitionGrid = data.transitionGrid;
      let nextPhysicalGrid = data.physicalGrid;
      let nextGreeniumGrid = data.greeniumGrid;
      let nextApprovalMatrix = approvalMatrixDraft ?? approvalMatrix ?? null;
      let rolledBackRequest: MethodologyChangeRequest;

      if (request.target === 'RULE') {
        const rolledBack = rollbackMethodologyChangeRequestToRules(request, data.rules, { actorEmail: user.email, actorName: user.name });
        await persistRuleOperations(request, 'rollback', user.email);
        nextRules = rolledBack.rules;
        rolledBackRequest = rolledBack.request;
      } else if (request.target === 'RATE_CARD') {
        const rolledBack = rollbackMethodologyChangeRequestToCollection(request, data.ftpRateCards, { actorEmail: user.email, actorName: user.name });
        nextRateCards = rolledBack.items;
        await configApi.saveRateCards(nextRateCards);
        rolledBackRequest = rolledBack.request;
      } else if (request.target === 'TRANSITION_GRID') {
        const rolledBack = rollbackMethodologyChangeRequestToCollection(request, data.transitionGrid, { actorEmail: user.email, actorName: user.name });
        nextTransitionGrid = rolledBack.items;
        await configApi.saveEsgGrid('transition', nextTransitionGrid);
        rolledBackRequest = rolledBack.request;
      } else if (request.target === 'PHYSICAL_GRID') {
        const rolledBack = rollbackMethodologyChangeRequestToCollection(request, data.physicalGrid, { actorEmail: user.email, actorName: user.name });
        nextPhysicalGrid = rolledBack.items;
        await configApi.saveEsgGrid('physical', nextPhysicalGrid);
        rolledBackRequest = rolledBack.request;
      } else if (request.target === 'GREENIUM_GRID') {
        const rolledBack = rollbackMethodologyChangeRequestToCollection(request, data.greeniumGrid as unknown as Parameters<typeof rollbackMethodologyChangeRequestToCollection>[1], { actorEmail: user.email, actorName: user.name });
        nextGreeniumGrid = rolledBack.items as unknown as typeof data.greeniumGrid;
        await persistGreeniumGrid(nextGreeniumGrid);
        rolledBackRequest = rolledBack.request;
      } else if (request.target === 'APPROVAL_MATRIX') {
        const currentApprovalMatrix = request.operations[0]?.currentSnapshot as ApprovalMatrixConfig | undefined;
        if (!currentApprovalMatrix || !setApprovalMatrix) return;
        setApprovalMatrix(currentApprovalMatrix);
        setApprovalMatrixDraft(currentApprovalMatrix);
        await configApi.saveApprovalMatrix(currentApprovalMatrix);
        nextApprovalMatrix = currentApprovalMatrix;
        rolledBackRequest = { ...request, status: 'Rolled_Back', rolledBackByEmail: user.email, rolledBackByName: user.name, rolledBackAt: new Date().toISOString() };
      } else {
        return;
      }

      await finalizeGovernanceChange(rolledBackRequest, request.id, 'Rolled_Back', 'ROLLBACK_METHOD_CHANGE', `Rollback ${request.id}: ${request.reason}`, {
        rules: nextRules, rateCards: nextRateCards, transitionGrid: nextTransitionGrid, physicalGrid: nextPhysicalGrid, greeniumGrid: nextGreeniumGrid, approvalMatrix: nextApprovalMatrix,
      });
    },
    [approvalMatrix, approvalMatrixDraft, canGovern, data, finalizeGovernanceChange, persistGreeniumGrid, persistRuleOperations, setApprovalMatrix, setApprovalMatrixDraft, user]
  );

  return { handleSubmitApprovalMatrixChange, handleReview, handleApply, handleRollback };
}
