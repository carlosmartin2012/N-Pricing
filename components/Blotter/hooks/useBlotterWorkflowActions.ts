import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as auditApi from '../../../api/audit';
import * as configApi from '../../../api/config';
import * as dealsApi from '../../../api/deals';
import * as pricingDiscipline from '../../../api/pricingDiscipline';
import { useData } from '../../../contexts/DataContext';
import { canPersistRemotely } from '../../../utils/dataModeUtils';
import { isSupabaseConfigured } from '../../../utils/supabaseClient';
import type {
  BusinessUnit,
  ClientEntity,
  ProductDefinition,
  Transaction,
  UserProfile,
} from '../../../types';
import { batchReprice, calculatePricing, type PricingContext } from '../../../utils/pricingEngine';
import { buildPricingContext } from '../../../utils/pricingContext';
import {
  buildApprovalTaskForPricingDossier,
  buildPricingDossier,
  mergeApprovalTask,
  mergePricingDossier,
  updateDealApprovalTasks,
  updatePricingDossierStatus,
  upsertApprovalTask,
  upsertPricingDossier,
} from '../../../utils/governanceWorkflows';
import {
  canBatchRepriceDeals,
  canCreateOrCloneDeals,
  executeTransition,
  type UserRole,
  type WorkflowAction,
} from '../../../utils/dealWorkflow';
import { exportDealsToExcel } from '../../../utils/excelUtils';
import { mapWorkflowStatusToDossierStatus } from '../blotterReferenceUtils';

interface UseBlotterWorkflowActionsOptions {
  deals: Transaction[];
  setDeals: React.Dispatch<React.SetStateAction<Transaction[]>>;
  products: ProductDefinition[];
  clients: ClientEntity[];
  businessUnits: BusinessUnit[];
  user: UserProfile | null;
  userRole: UserRole;
}

export function useBlotterWorkflowActions({
  deals,
  setDeals,
  products,
  clients,
  businessUnits,
  user,
  userRole,
}: UseBlotterWorkflowActionsOptions) {
  const data = useData();
  const canWriteRemotely = canPersistRemotely({
    dataMode: data.dataMode,
    isSupabaseConfigured,
  });
  const { behaviouralModels } = data;
  const [isRepricing, setIsRepricing] = useState(false);
  const [repriceCount, setRepriceCount] = useState(0);
  const repriceResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (repriceResetTimerRef.current) {
        clearTimeout(repriceResetTimerRef.current);
        repriceResetTimerRef.current = null;
      }
    };
  }, []);

  const pricingContext = useMemo<PricingContext>(
    () =>
      buildPricingContext(
        {
          yieldCurves: data.yieldCurves,
          liquidityCurves: data.liquidityCurves,
          rules: data.rules,
          ftpRateCards: data.ftpRateCards,
          transitionGrid: data.transitionGrid,
          physicalGrid: data.physicalGrid,
          greeniumGrid: data.greeniumGrid,
          behaviouralModels: data.behaviouralModels,
        },
        {
          clients,
          products,
          businessUnits,
        }
      ),
    [
      businessUnits,
      clients,
      data.behaviouralModels,
      data.ftpRateCards,
      data.greeniumGrid,
      data.liquidityCurves,
      data.physicalGrid,
      data.rules,
      data.transitionGrid,
      data.yieldCurves,
      products,
    ]
  );

  const handleCloneDeal = useCallback(
    async (deal: Transaction) => {
      if (!canCreateOrCloneDeals(userRole)) return;
      const clonedDeal: Transaction = {
        ...deal,
        id: `TRD-${Date.now().toString(36).toUpperCase()}`,
        status: 'Draft',
        startDate: new Date().toISOString().split('T')[0],
        description: `Clone of ${deal.id}`,
      };
      if (canWriteRemotely) {
        await dealsApi.upsertDeal(clonedDeal);
      }
      setDeals((previous) => [clonedDeal, ...previous]);
      await auditApi.createAuditEntry({
        userEmail: user?.email || 'unknown',
        userName: user?.name || 'Unknown',
        action: 'DEAL_CLONED',
        module: 'BLOTTER',
        description: `Cloned deal ${deal.id} → ${clonedDeal.id}`,
      });
    },
    [setDeals, user, userRole]
  );

  const handleWorkflowAction = useCallback(
    async (deal: Transaction, action: WorkflowAction) => {
      const pricingSnapshot = action.requiresPricingSnapshot
        ? calculatePricing(deal, data.approvalMatrix, pricingContext)
        : undefined;
      const result = executeTransition(deal, action.to, userRole, user?.email || 'unknown', pricingSnapshot);

      if (!result.success) {
        window.alert(result.error || 'Transition not allowed.');
        return;
      }

      const persistedDeal = canWriteRemotely
        ? deal.id
          ? await dealsApi.transitionDeal({
              dealId: deal.id,
              newStatus: action.to,
              userEmail: user?.email || 'unknown',
              pricingSnapshot,
            })
          : await dealsApi.upsertDeal({
              ...deal,
              status: result.newStatus as Transaction['status'],
            })
        : null;
      const updatedDeal = persistedDeal || {
        ...deal,
        status: result.newStatus as Transaction['status'],
      };

      setDeals((previous) => previous.map((item) => (item.id === deal.id ? updatedDeal : item)));
      if (updatedDeal.id) void pricingDiscipline.recomputeVariance(updatedDeal.id);

      if (updatedDeal.id && user?.email && user?.name) {
        let nextDossiers = data.pricingDossiers;
        let nextTasks = data.approvalTasks;

        if (result.newStatus === 'Pending_Approval' && pricingSnapshot) {
          const existingDossier = nextDossiers.find((dossier) => dossier.dealId === updatedDeal.id);
          let dossier = mergePricingDossier(
            existingDossier,
            buildPricingDossier({
              deal: updatedDeal,
              result: pricingSnapshot,
              approvalMatrix: data.approvalMatrix,
              rules: data.rules,
              methodologyVersions: data.methodologyVersions,
              currentUser: {
                email: user.email,
                name: user.name,
              },
              yieldCurveCount: data.yieldCurves.length,
              liquidityCurveCount: data.liquidityCurves.length,
              marketDataSources: data.marketDataSources,
              portfolioSnapshots: data.portfolioSnapshots,
              status: 'Pending_Approval',
            })
          );
          const existingTask = nextTasks.find(
            (task) => task.scope === 'DEAL_PRICING' && task.subject.id === updatedDeal.id
          );
          const approvalTask = mergeApprovalTask(existingTask, buildApprovalTaskForPricingDossier(dossier));
          if (approvalTask) {
            dossier = {
              ...dossier,
              approvalTaskId: approvalTask.id,
            };
            nextTasks = upsertApprovalTask(nextTasks, approvalTask);
          }
          nextDossiers = upsertPricingDossier(nextDossiers, dossier);
        } else {
          const dossierStatus = mapWorkflowStatusToDossierStatus(updatedDeal.status);
          if (dossierStatus) {
            nextDossiers = updatePricingDossierStatus(nextDossiers, updatedDeal.id, dossierStatus);
            nextTasks = updateDealApprovalTasks(nextTasks, updatedDeal.id, dossierStatus, user.email, user.name);
          }
        }

        data.setPricingDossiers(nextDossiers);
        data.setApprovalTasks(nextTasks);
        if (canWriteRemotely) {
          await Promise.all([configApi.savePricingDossiers(nextDossiers), configApi.saveApprovalTasks(nextTasks)]);
        }
      }

      await auditApi.createAuditEntry({
        userEmail: user?.email || 'unknown',
        userName: user?.name || 'Unknown',
        action: `WORKFLOW_${action.to.toUpperCase()}`,
        module: 'BLOTTER',
        description: `Deal ${deal.id}: ${deal.status || 'Draft'} → ${action.to} by ${user?.name || 'unknown'} (${userRole})`,
        details: {
          correlationDealId: updatedDeal.id,
          pricingSnapshotGenerated: Boolean(pricingSnapshot),
        },
      });
    },
    [data, pricingContext, setDeals, user, userRole]
  );

  const handleBatchReprice = useCallback(async () => {
    if (!canBatchRepriceDeals(userRole)) return;
    setIsRepricing(true);
    const results = batchReprice(deals, data.approvalMatrix, pricingContext);
    setRepriceCount(results.size);
    await exportDealsToExcel(deals, results);

    await auditApi.createAuditEntry({
      userEmail: user?.email || 'unknown',
      userName: user?.name || 'Unknown',
      action: 'BATCH_REPRICE',
      module: 'BLOTTER',
      description: `Batch repriced ${results.size} deals and exported to Excel`,
    });
    setIsRepricing(false);
    if (repriceResetTimerRef.current) clearTimeout(repriceResetTimerRef.current);
    repriceResetTimerRef.current = setTimeout(() => {
      setRepriceCount(0);
      repriceResetTimerRef.current = null;
    }, 3000);
  }, [data.approvalMatrix, deals, pricingContext, user, userRole]);

  return {
    behaviouralModels,
    handleBatchReprice,
    handleCloneDeal,
    handleWorkflowAction,
    isRepricing,
    repriceCount,
  };
}
