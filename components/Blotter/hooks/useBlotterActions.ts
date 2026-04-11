import { useCallback, useRef, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import * as auditApi from '../../../api/audit';
import * as configApi from '../../../api/config';
import * as dealsApi from '../../../api/deals';
import { useData } from '../../../contexts/DataContext';
import type {
  BusinessUnit,
  ClientEntity,
  ProductDefinition,
  Transaction,
  UserProfile,
} from '../../../types';
import { type UserRole } from '../../../utils/dealWorkflow';
import { downloadTemplate } from '../../../utils/excelUtils';
import { validateDeal, type ValidationError } from '../../../utils/validation';
import {
  createImportedDeal,
  createNewDealDraft,
  DEAL_BLOTTER_TEMPLATE,
  normalizeDealDraft,
} from '../blotterUtils';
import {
  type RenamedDealReferences,
  updateReferencedDealId,
} from '../blotterReferenceUtils';
import { errorTracker } from '../../../utils/errorTracking';
import { useBlotterWorkflowActions } from './useBlotterWorkflowActions';

type ImportRow = Record<string, unknown>;

interface UseBlotterActionsOptions {
  deals: Transaction[];
  setDeals: React.Dispatch<React.SetStateAction<Transaction[]>>;
  products: ProductDefinition[];
  clients: ClientEntity[];
  businessUnits: BusinessUnit[];
  user: UserProfile | null;
  userRole: UserRole;
}

export function useBlotterActions({
  deals,
  setDeals,
  products,
  clients,
  businessUnits,
  user,
  userRole,
}: UseBlotterActionsOptions) {
  const data = useData();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Partial<Transaction> | null>(null);
  const [dealValidationErrors, setDealValidationErrors] = useState<ValidationError[]>([]);

  const dealFormRef = useRef<UseFormReturn<Transaction> | null>(null);
  const {
    behaviouralModels,
    handleBatchReprice,
    handleCloneDeal,
    handleWorkflowAction,
    isRepricing,
    repriceCount,
  } = useBlotterWorkflowActions({
    deals,
    setDeals,
    products,
    clients,
    businessUnits,
    user,
    userRole,
  });

  const handleImport = useCallback(
    async (rows: ImportRow[]) => {
      const isIDMod = rows[0] && (rows[0].NewID !== undefined || rows[0].newID !== undefined);

      if (isIDMod) {
        const renameOperations = rows
          .map((row) => ({
            previousId: String(row.ID || row.id || '').trim(),
            nextId: String(row.NewID || row.newID || '').trim(),
          }))
          .filter((operation) => operation.previousId && operation.nextId && operation.previousId !== operation.nextId);

        const successfulRenames: Array<{ previousId: string; nextId: string }> = [];

        for (const operation of renameOperations) {
          const renamedDeal = await dealsApi.renameDealId(operation.previousId, operation.nextId);
          if (renamedDeal?.id === operation.nextId) {
            successfulRenames.push(operation);
          }
        }

        if (successfulRenames.length > 0) {
          const renameMap = new Map(successfulRenames.map((operation) => [operation.previousId, operation.nextId]));
          const updatedDeals = deals.map((deal) =>
            deal.id && renameMap.has(deal.id)
              ? {
                  ...deal,
                  id: renameMap.get(deal.id),
                }
              : deal
          );
          const updatedReferences = successfulRenames.reduce<RenamedDealReferences>(
            (accumulator, operation) =>
              updateReferencedDealId(operation.previousId, operation.nextId, {
                approvalTasks: accumulator.nextApprovalTasks,
                pricingDossiers: accumulator.nextPricingDossiers,
                portfolioSnapshots: accumulator.nextPortfolioSnapshots,
              }),
            {
              nextApprovalTasks: data.approvalTasks,
              nextPricingDossiers: data.pricingDossiers,
              nextPortfolioSnapshots: data.portfolioSnapshots,
            }
          );

          setDeals(updatedDeals);
          data.setApprovalTasks(updatedReferences.nextApprovalTasks);
          data.setPricingDossiers(updatedReferences.nextPricingDossiers);
          data.setPortfolioSnapshots(updatedReferences.nextPortfolioSnapshots);
          const renameOperationLabels = [
            'saveApprovalTasks',
            'savePricingDossiers',
            'savePortfolioSnapshots',
          ] as const;
          const renameOutcomes = await Promise.allSettled([
            configApi.saveApprovalTasks(updatedReferences.nextApprovalTasks),
            configApi.savePricingDossiers(updatedReferences.nextPricingDossiers),
            configApi.savePortfolioSnapshots(updatedReferences.nextPortfolioSnapshots),
          ]);
          renameOutcomes.forEach((outcome, index) => {
            if (outcome.status === 'rejected') {
              errorTracker.captureException(
                outcome.reason instanceof Error
                  ? outcome.reason
                  : new Error(String(outcome.reason)),
                {
                  module: 'BLOTTER',
                  extra: {
                    operation: renameOperationLabels[index],
                    renamedCount: successfulRenames.length,
                  },
                }
              );
            }
          });
        }

        void auditApi.logAudit({
          userEmail: user?.email || 'unknown',
          userName: user?.name || 'Unknown User',
          action: 'BATCH_ID_RENAME',
          module: 'BLOTTER',
          description: `Renamed ${successfulRenames.length} deal IDs via Excel import.`,
          details: {
            requested: renameOperations.length,
            successful: successfulRenames.length,
          },
        });
      } else {
        const newDeals: Transaction[] = rows.map((row) => createImportedDeal(row, products));

        setDeals((previous) => [...newDeals, ...previous]);
        const upsertOutcomes = await Promise.allSettled(
          newDeals.map((deal) => dealsApi.upsertDeal(deal))
        );
        upsertOutcomes.forEach((outcome, index) => {
          if (outcome.status === 'rejected') {
            errorTracker.captureException(
              outcome.reason instanceof Error
                ? outcome.reason
                : new Error(String(outcome.reason)),
              {
                module: 'BLOTTER',
                dealId: newDeals[index]?.id,
                extra: { operation: 'importDealUpsert' },
              }
            );
          }
        });

        void auditApi.logAudit({
          userEmail: user?.email || 'unknown',
          userName: user?.name || 'Unknown User',
          action: 'IMPORT_DEALS',
          module: 'BLOTTER',
          description: `Imported ${newDeals.length} deals from Excel.`,
        });
      }

      setIsImportOpen(false);
    },
    [data, deals, products, setDeals, user]
  );

  const handleDownloadTemplate = useCallback(
    async () => downloadTemplate('DEAL_BLOTTER_IDS', 'Deal_ID_Modification_Template'),
    []
  );

  const handleEdit = useCallback((deal: Transaction) => {
    setDealValidationErrors([]);
    setSelectedDeal({ ...deal });
    setIsEditOpen(true);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    const form = dealFormRef.current;
    if (!form || !selectedDeal) return;

    const isValid = await form.trigger();
    if (!isValid) {
      const mapped: ValidationError[] = Object.entries(form.formState.errors).map(([field, error]) => ({
        field,
        message: (error as { message?: string })?.message || 'Invalid',
      }));
      setDealValidationErrors(mapped);
      return;
    }

    const updated = normalizeDealDraft(form.getValues(), products, {
      id: selectedDeal.id,
      status: selectedDeal.status,
    });
    const { valid, errors } = validateDeal(updated);
    if (!valid) {
      setDealValidationErrors(errors);
      return;
    }

    setDealValidationErrors([]);
    const savedDeal = await dealsApi.upsertDeal(updated);
    setDeals((previous) => previous.map((deal) => (deal.id === updated.id ? savedDeal || updated : deal)));
    setIsEditOpen(false);
  }, [products, selectedDeal, setDeals]);

  const handleNewDeal = useCallback(() => {
    setDealValidationErrors([]);
    setSelectedDeal(createNewDealDraft(products));
    setIsNewOpen(true);
  }, [products]);

  const handleSaveNew = useCallback(async () => {
    const form = dealFormRef.current;
    if (!form || !selectedDeal) return;

    const isValid = await form.trigger();
    if (!isValid) {
      const mapped: ValidationError[] = Object.entries(form.formState.errors).map(([field, error]) => ({
        field,
        message: (error as { message?: string })?.message || 'Invalid',
      }));
      setDealValidationErrors(mapped);
      return;
    }

    const formValues = form.getValues();
    if (!formValues.clientId) return;

    const newDeal = normalizeDealDraft(formValues, products, { status: 'Draft' });
    const { valid, errors } = validateDeal(newDeal);
    if (!valid) {
      setDealValidationErrors(errors);
      return;
    }

    setDealValidationErrors([]);
    const savedDeal = await dealsApi.upsertDeal(newDeal);
    setDeals((previous) => [savedDeal || newDeal, ...previous]);
    setIsNewOpen(false);
  }, [products, selectedDeal, setDeals]);

  const handleDelete = useCallback((deal: Transaction) => {
    setSelectedDeal(deal);
    setIsDeleteOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!selectedDeal?.id) return;

    await dealsApi.deleteDeal(selectedDeal.id);
    setDeals((previous) => previous.filter((deal) => deal.id !== selectedDeal.id));
    const nextTasks = data.approvalTasks.filter(
      (task) => !(task.scope === 'DEAL_PRICING' && task.subject.id === selectedDeal.id)
    );
    const nextDossiers = data.pricingDossiers.filter((dossier) => dossier.dealId !== selectedDeal.id);
    data.setApprovalTasks(nextTasks);
    data.setPricingDossiers(nextDossiers);
    const deleteOutcomes = await Promise.allSettled([
      configApi.saveApprovalTasks(nextTasks),
      configApi.savePricingDossiers(nextDossiers),
    ]);
    deleteOutcomes.forEach((outcome, index) => {
      if (outcome.status === 'rejected') {
        errorTracker.captureException(
          outcome.reason instanceof Error
            ? outcome.reason
            : new Error(String(outcome.reason)),
          {
            module: 'BLOTTER',
            dealId: selectedDeal.id,
            extra: {
              operation: index === 0 ? 'saveApprovalTasks' : 'savePricingDossiers',
            },
          }
        );
      }
    });
    await auditApi.createAuditEntry({
      userEmail: user?.email || 'unknown',
      userName: user?.name || 'Unknown',
      action: 'DELETE_DEAL',
      module: 'BLOTTER',
      description: `Deleted deal ${selectedDeal.id}`,
    });
    setIsDeleteOpen(false);
    setSelectedDeal(null);
  }, [data, selectedDeal, setDeals, user]);

  return {
    behaviouralModels,
    confirmDelete,
    dealFormRef,
    dealTemplateContent: DEAL_BLOTTER_TEMPLATE,
    dealValidationErrors,
    handleBatchReprice,
    handleCloneDeal,
    handleDelete,
    handleDownloadTemplate,
    handleEdit,
    handleImport,
    handleNewDeal,
    handleSaveEdit,
    handleSaveNew,
    handleWorkflowAction,
    isDeleteOpen,
    isEditOpen,
    isImportOpen,
    isNewOpen,
    isRepricing,
    openImport: () => setIsImportOpen(true),
    repriceCount,
    selectedDeal,
    setIsDeleteOpen,
    setIsEditOpen,
    setIsImportOpen,
    setIsNewOpen,
    setSelectedDeal,
  };
}
