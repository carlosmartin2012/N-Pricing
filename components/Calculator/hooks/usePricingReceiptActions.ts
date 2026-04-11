import { useCallback, useEffect, useRef, useState } from 'react';
import * as auditApi from '../../../api/audit';
import * as configApi from '../../../api/config';
import * as dealsApi from '../../../api/deals';
import { useAuth } from '../../../contexts/AuthContext';
import { useData } from '../../../contexts/DataContext';
import type { ApprovalMatrixConfig, FTPResult, Transaction } from '../../../types';
import { findLatestPortfolioSnapshotForDeal } from '../../../utils/aiGrounding';
import {
  buildApprovalTaskForPricingDossier,
  buildPricingDossier,
  mergeApprovalTask,
  mergePricingDossier,
  updateDealApprovalTasks,
  upsertApprovalTask,
  upsertPricingDossier,
} from '../../../utils/governanceWorkflows';
import { exportPricingPDF } from '../../../utils/pdfExport';
import type { PricingShocks } from '../../../utils/pricingEngine';
import { monitoringService } from '../../../utils/supabase/monitoring';
import type { ValidationError } from '../../../utils/validation';
import { errorTracker } from '../../../utils/errorTracking';

interface UsePricingReceiptActionsOptions {
  deal: Transaction;
  result: FTPResult;
  approvalMatrix: ApprovalMatrixConfig;
  activeScenarioShocks: PricingShocks;
  validationErrors: ValidationError[];
  onDealSaved?: (deal: Transaction) => void;
}

export function usePricingReceiptActions({
  deal,
  result,
  approvalMatrix,
  activeScenarioShocks,
  validationErrors,
  onDealSaved,
}: UsePricingReceiptActionsOptions) {
  const data = useData();
  const { currentUser } = useAuth();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [dealSaveStatus, setDealSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStatusResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dealSaveStatusResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = null;
      }
      if (saveStatusResetTimer.current) {
        clearTimeout(saveStatusResetTimer.current);
        saveStatusResetTimer.current = null;
      }
      if (dealSaveStatusResetTimer.current) {
        clearTimeout(dealSaveStatusResetTimer.current);
        dealSaveStatusResetTimer.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const dealId = deal.id;
    if (!dealId || !currentUser) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const userEmail = currentUser.email || 'unknown';
      setSaveStatus('saving');
      monitoringService
        .savePricingResult(dealId, result, deal, userEmail)
        .then(() => {
          if (!isMountedRef.current) return;
          setSaveStatus('saved');
          if (saveStatusResetTimer.current) clearTimeout(saveStatusResetTimer.current);
          saveStatusResetTimer.current = setTimeout(() => {
            if (!isMountedRef.current) return;
            setSaveStatus('idle');
            saveStatusResetTimer.current = null;
          }, 2000);
        })
        .catch((error: unknown) => {
          if (isMountedRef.current) setSaveStatus('idle');
          errorTracker.captureException(
            error instanceof Error ? error : new Error(String(error)),
            {
              module: 'PRICING_RECEIPT',
              dealId,
              extra: { operation: 'autoSavePricingResult' },
            }
          );
        });
    }, 3000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [currentUser, deal, result]);

  const handleSaveAsDeal = useCallback(async () => {
    if (!currentUser) return;
    if (validationErrors.length > 0) return;
    setDealSaveStatus('saving');
    const newDeal: Transaction = {
      ...deal,
      id: deal.id || `DL-${Date.now().toString(36).toUpperCase()}`,
      status: result.approvalLevel === 'Auto' ? 'Approved' : 'Pending_Approval',
      liquiditySpread: result.liquiditySpread,
      _liquidityPremiumDetails: result._liquidityPremiumDetails,
      _clcChargeDetails: result._clcChargeDetails,
    };
    try {
      const persistedDeal = await dealsApi.upsertDeal(newDeal);
      const resolvedDeal = persistedDeal || newDeal;
      data.setDeals((previous) => {
        const exists = previous.find((item) => item.id === resolvedDeal.id);
        return exists
          ? previous.map((item) => (item.id === resolvedDeal.id ? resolvedDeal : item))
          : [...previous, resolvedDeal];
      });
      await monitoringService.savePricingResult(resolvedDeal.id!, result, resolvedDeal, currentUser.email);

      const existingDossier = data.pricingDossiers.find((dossier) => dossier.dealId === resolvedDeal.id);
      let dossier = mergePricingDossier(
        existingDossier,
        buildPricingDossier({
          deal: resolvedDeal,
          result,
          approvalMatrix,
          shocks: activeScenarioShocks,
          rules: data.rules,
          methodologyVersions: data.methodologyVersions,
          currentUser: {
            email: currentUser.email,
            name: currentUser.name,
          },
          yieldCurveCount: data.yieldCurves.length,
          liquidityCurveCount: data.liquidityCurves.length,
          marketDataSources: data.marketDataSources,
          portfolioSnapshots: data.portfolioSnapshots,
          status: resolvedDeal.status === 'Approved' ? 'Approved' : 'Pending_Approval',
        })
      );

      let nextTasks = data.approvalTasks;
      if (dossier.status === 'Pending_Approval') {
        const existingTask = nextTasks.find(
          (task) => task.scope === 'DEAL_PRICING' && task.subject.id === resolvedDeal.id
        );
        const approvalTask = mergeApprovalTask(existingTask, buildApprovalTaskForPricingDossier(dossier));
        if (approvalTask) {
          dossier = {
            ...dossier,
            approvalTaskId: approvalTask.id,
          };
          nextTasks = upsertApprovalTask(nextTasks, approvalTask);
        }
      } else {
        nextTasks = updateDealApprovalTasks(
          nextTasks,
          resolvedDeal.id!,
          'Approved',
          currentUser.email,
          currentUser.name
        );
      }

      const nextDossiers = upsertPricingDossier(data.pricingDossiers, dossier);
      data.setPricingDossiers(nextDossiers);
      data.setApprovalTasks(nextTasks);
      const persistenceResults = await Promise.allSettled([
        configApi.savePricingDossiers(nextDossiers),
        configApi.saveApprovalTasks(nextTasks),
      ]);
      persistenceResults.forEach((outcome, index) => {
        if (outcome.status === 'rejected') {
          errorTracker.captureException(
            outcome.reason instanceof Error
              ? outcome.reason
              : new Error(String(outcome.reason)),
            {
              module: 'PRICING_RECEIPT',
              dealId: resolvedDeal.id,
              extra: {
                operation: index === 0 ? 'savePricingDossiers' : 'saveApprovalTasks',
              },
            }
          );
        }
      });

      await auditApi.createAuditEntry({
        userEmail: currentUser.email,
        userName: currentUser.name,
        action: 'DEAL_SAVED_FROM_CALCULATOR',
        module: 'CALCULATOR',
        description: `Deal ${newDeal.id} saved with RAROC ${result.raroc.toFixed(2)}% — ${result.approvalLevel}`,
        details: {
          dossierId: dossier.id,
          approvalTaskId: dossier.approvalTaskId,
          methodologyVersionId: dossier.methodologyVersionId,
        },
      });

      setDealSaveStatus('saved');
      onDealSaved?.(resolvedDeal);
      if (dealSaveStatusResetTimer.current) clearTimeout(dealSaveStatusResetTimer.current);
      dealSaveStatusResetTimer.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        setDealSaveStatus('idle');
        dealSaveStatusResetTimer.current = null;
      }, 3000);
    } catch {
      setDealSaveStatus('idle');
    }
  }, [activeScenarioShocks, approvalMatrix, currentUser, data, deal, onDealSaved, result, validationErrors]);

  const handleExportReceipt = useCallback(() => {
    const clientName = data.clients.find((client) => client.id === deal.clientId)?.name || deal.clientId;
    exportPricingPDF(deal, result, clientName);
    if (!deal.id) return;

    const existingDossier = data.pricingDossiers.find((dossier) => dossier.dealId === deal.id);
    if (!existingDossier) return;

    const nextDossiers = data.pricingDossiers.map((dossier) => {
      if (dossier.dealId !== deal.id) return dossier;

      const snapshot = findLatestPortfolioSnapshotForDeal(deal.id, data.portfolioSnapshots);
      const hasExportEvidence = dossier.evidence.some((evidence) => evidence.type === 'EXPORT_PACKAGE');

      return {
        ...dossier,
        updatedAt: new Date().toISOString(),
        evidence: [
          ...dossier.evidence.map((evidence) =>
            evidence.type === 'PRICING_RECEIPT' ? { ...evidence, status: 'Generated' as const } : evidence
          ),
          ...(!hasExportEvidence
            ? [
                {
                  id: `EVD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
                  type: 'EXPORT_PACKAGE' as const,
                  label: `Export package for ${dossier.dealId}`,
                  format: 'pdf' as const,
                  createdAt: new Date().toISOString(),
                  createdByEmail: currentUser?.email || 'system',
                  createdByName: currentUser?.name || 'System',
                  status: 'Generated' as const,
                  metadata: {
                    dossierId: dossier.id,
                    methodologyVersionId: dossier.methodologyVersionId,
                    portfolioSnapshotId: snapshot?.id,
                    marketDataSourceIds: dossier.groundedContext?.marketDataSourceIds || [],
                  },
                },
              ]
            : []),
        ],
      };
    });

    data.setPricingDossiers(nextDossiers);
    configApi.savePricingDossiers(nextDossiers).catch((error: unknown) => {
      errorTracker.captureException(
        error instanceof Error ? error : new Error(String(error)),
        {
          module: 'PRICING_RECEIPT',
          dealId: deal.id,
          extra: { operation: 'savePricingDossiers' },
        }
      );
    });
  }, [currentUser, data, deal, result]);

  return {
    dealSaveStatus,
    handleExportReceipt,
    handleSaveAsDeal,
    saveStatus,
  };
}
