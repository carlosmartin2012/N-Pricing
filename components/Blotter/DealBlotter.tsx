import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import * as auditApi from '../../api/audit';
import * as configApi from '../../api/config';
import * as dealsApi from '../../api/deals';
import { Panel } from '../ui/LayoutComponents';
import { validateDeal, type ValidationError } from '../../utils/validation';
import {
  Transaction,
  ProductDefinition,
  ClientEntity,
  BusinessUnit,
  UserProfile,
} from '../../types';
import { useData } from '../../contexts/DataContext';
import { batchReprice, calculatePricing } from '../../utils/pricingEngine';
import { errorTracker } from '../../utils/errorTracking';
import { translations, Language } from '../../translations';
import { downloadTemplate, exportDealsToExcel } from '../../utils/excelUtils';
import { executeTransition, type UserRole, type WorkflowAction } from '../../utils/dealWorkflow';
import { buildPricingContext } from '../../utils/pricingContext';
import {
  buildApprovalTaskForPricingDossier,
  buildPricingDossier,
  mergeApprovalTask,
  mergePricingDossier,
  updateDealApprovalTasks,
  updatePricingDossierStatus,
  upsertApprovalTask,
  upsertPricingDossier,
} from '../../utils/governanceWorkflows';
import BlotterFooter from './BlotterFooter';
import BlotterHeaderActions from './BlotterHeaderActions';
import BlotterTable from './BlotterTable';
import BlotterToolbar from './BlotterToolbar';
import DealBlotterDrawers from './DealBlotterDrawers';
import {
  buildDealsCsv,
  createImportedDeal,
  createNewDealDraft,
  DEAL_BLOTTER_TEMPLATE,
  formatDealCurrency,
  normalizeDealDraft,
} from './blotterUtils';
import { mapWorkflowStatusToDossierStatus, type RenamedDealReferences, updateReferencedDealId } from './blotterReferenceUtils';
import { buildCommitteePackage, downloadCommitteePackage } from './committeeDossierUtils';
import { useBlotterState } from './hooks/useBlotterState';

interface Props {
  deals: Transaction[];
  setDeals: React.Dispatch<React.SetStateAction<Transaction[]>>;
  products: ProductDefinition[];
  clients: ClientEntity[];
  businessUnits: BusinessUnit[];
  language: Language;
  user: UserProfile | null;
}

type ImportRow = Record<string, unknown>;

const DealBlotter: React.FC<Props> = ({ deals, setDeals, products, clients, businessUnits, language, user }) => {
  const data = useData();
  const { behaviouralModels } = data;
  const t = translations[language];

  // Drawer States
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDossierOpen, setIsDossierOpen] = useState(false);

  const [selectedDeal, setSelectedDeal] = useState<Partial<Transaction> | null>(null);
  const [dealValidationErrors, setDealValidationErrors] = useState<ValidationError[]>([]);
  const dealFormRef = useRef<UseFormReturn<Transaction> | null>(null);
  const userRole = (user?.role || 'Trader') as UserRole;
  const {
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    filteredDeals,
    selectedDossierDeal,
    selectedPricingDossier,
    selectedApprovalTask,
    selectedMethodologyVersion,
    selectedPortfolioSnapshot,
    selectedMarketDataSources,
    committeeSummary,
    selectedAvailableActions,
    setSelectedDossierDealId,
  } = useBlotterState({ deals, data, userRole });

  const handleImport = async (rows: ImportRow[]) => {
    // Check if it's an ID modification import or a full deal import
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
        await Promise.all([
          configApi.saveApprovalTasks(updatedReferences.nextApprovalTasks),
          configApi.savePricingDossiers(updatedReferences.nextPricingDossiers),
          configApi.savePortfolioSnapshots(updatedReferences.nextPortfolioSnapshots),
        ]);
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

      setDeals((prev) => [...newDeals, ...prev]);
      // Persist imported deals to Supabase
      await Promise.all(newDeals.map((d) => dealsApi.upsertDeal(d)));

      void auditApi.logAudit({
        userEmail: user?.email || 'unknown',
        userName: user?.name || 'Unknown User',
        action: 'IMPORT_DEALS',
        module: 'BLOTTER',
        description: `Imported ${newDeals.length} deals from Excel.`,
      });
    }
    setIsImportOpen(false);
  };

  const handleDownloadTemplate = async () => downloadTemplate('DEAL_BLOTTER_IDS', 'Deal_ID_Modification_Template');

  // Clone deal handler
  const handleCloneDeal = useCallback(
    async (deal: Transaction) => {
      const clonedDeal: Transaction = {
        ...deal,
        id: `TRD-${Date.now().toString(36).toUpperCase()}`,
        status: 'Draft',
        startDate: new Date().toISOString().split('T')[0],
        description: `Clone of ${deal.id}`,
      };
      await dealsApi.upsertDeal(clonedDeal);
      setDeals((prev) => [clonedDeal, ...prev]);
      await auditApi.createAuditEntry({
        userEmail: user?.email || 'unknown',
        userName: user?.name || 'Unknown',
        action: 'DEAL_CLONED',
        module: 'BLOTTER',
        description: `Cloned deal ${deal.id} → ${clonedDeal.id}`,
      });
    },
    [user, setDeals]
  );

  // Batch repricing
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
  const pricingContext = useMemo(
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
      data.yieldCurves,
      data.liquidityCurves,
      data.rules,
      data.ftpRateCards,
      data.transitionGrid,
      data.physicalGrid,
      data.greeniumGrid,
      data.behaviouralModels,
      clients,
      products,
      businessUnits,
    ]
  );

  // Workflow action handler
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

      const persistedDeal = deal.id
        ? await dealsApi.transitionDeal({
            dealId: deal.id,
            newStatus: action.to,
            userEmail: user?.email || 'unknown',
            pricingSnapshot,
          })
        : await dealsApi.upsertDeal({
            ...deal,
            status: result.newStatus as Transaction['status'],
          });
      const updatedDeal = persistedDeal || {
        ...deal,
        status: result.newStatus as Transaction['status'],
      };

      setDeals((prev) => prev.map((d) => (d.id === deal.id ? updatedDeal : d)));

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
        await Promise.all([
          configApi.savePricingDossiers(nextDossiers),
          configApi.saveApprovalTasks(nextTasks),
        ]);
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
    [user, setDeals, data, pricingContext, userRole]
  );

  const handleBatchReprice = useCallback(async () => {
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
  }, [deals, user, data.approvalMatrix, pricingContext]);

  const handleEdit = (deal: Transaction) => {
    setDealValidationErrors([]);
    setSelectedDeal({ ...deal });
    setIsEditOpen(true);
  };

  const handleOpenDossier = useCallback((deal: Transaction) => {
    if (!deal.id) return;
    setSelectedDossierDealId(deal.id);
    setIsDossierOpen(true);
  }, [setSelectedDossierDealId]);

  const handleCloseDossier = useCallback(() => {
    setIsDossierOpen(false);
    setSelectedDossierDealId(null);
  }, [setSelectedDossierDealId]);

  const handleSaveEdit = async () => {
    const form = dealFormRef.current;
    if (!form || !selectedDeal) return;

    // Trigger RHF validation first
    const isValid = await form.trigger();
    if (!isValid) {
      // Convert RHF errors to ValidationError[] for the existing error display
      const rhfErrors = form.formState.errors;
      const mapped: ValidationError[] = Object.entries(rhfErrors).map(([field, err]) => ({
        field,
        message: (err as { message?: string })?.message || 'Invalid',
      }));
      setDealValidationErrors(mapped);
      return;
    }

    const formValues = form.getValues();
    const updated = normalizeDealDraft(formValues, products, {
      id: selectedDeal.id,
      status: selectedDeal.status,
    });

    // Double-check with validateDeal (belt-and-suspenders for domain rules)
    const { valid, errors } = validateDeal(updated);
    if (!valid) {
      setDealValidationErrors(errors);
      return;
    }

    setDealValidationErrors([]);
    const savedDeal = await dealsApi.upsertDeal(updated);
    setDeals((prev) => prev.map((d) => (d.id === updated.id ? savedDeal || updated : d)));
    setIsEditOpen(false);
  };

  const handleNewDeal = () => {
    setDealValidationErrors([]);
    setSelectedDeal(createNewDealDraft(products));
    setIsNewOpen(true);
  };

  const handleSaveNew = async () => {
    const form = dealFormRef.current;
    if (!form || !selectedDeal) return;

    // Trigger RHF validation first
    const isValid = await form.trigger();
    if (!isValid) {
      const rhfErrors = form.formState.errors;
      const mapped: ValidationError[] = Object.entries(rhfErrors).map(([field, err]) => ({
        field,
        message: (err as { message?: string })?.message || 'Invalid',
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
    setDeals((prev) => [savedDeal || newDeal, ...prev]);
    setIsNewOpen(false);
  };

  const handleDelete = (deal: Transaction) => {
    setSelectedDeal(deal);
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (selectedDeal && selectedDeal.id) {
      await dealsApi.deleteDeal(selectedDeal.id);
      setDeals((prev) => prev.filter((deal) => deal.id !== selectedDeal.id));
      const nextTasks = data.approvalTasks.filter(
        (task) => !(task.scope === 'DEAL_PRICING' && task.subject.id === selectedDeal.id)
      );
      const nextDossiers = data.pricingDossiers.filter((dossier) => dossier.dealId !== selectedDeal.id);
      data.setApprovalTasks(nextTasks);
      data.setPricingDossiers(nextDossiers);
      await Promise.all([
        configApi.saveApprovalTasks(nextTasks),
        configApi.savePricingDossiers(nextDossiers),
      ]);
      await auditApi.createAuditEntry({
        userEmail: user?.email || 'unknown',
        userName: user?.name || 'Unknown',
        action: 'DELETE_DEAL',
        module: 'BLOTTER',
        description: `Deleted deal ${selectedDeal.id}`,
      });
      setIsDeleteOpen(false);
      setSelectedDeal(null);
    }
  };

  const handleExportCommitteePackage = useCallback(async () => {
    if (!selectedDossierDeal || !selectedPricingDossier) return;

    const reviewPackage = buildCommitteePackage({
      deal: selectedDossierDeal,
      dossier: selectedPricingDossier,
      approvalTask: selectedApprovalTask,
      methodologyVersion: selectedMethodologyVersion,
      portfolioSnapshot: selectedPortfolioSnapshot,
      marketDataSources: selectedMarketDataSources,
    });
    downloadCommitteePackage(reviewPackage);

    const packageTimestamp = new Date().toISOString();
    const packageMetadata = {
      packageType: reviewPackage.packageType,
      dossierId: selectedPricingDossier.id,
      approvalTaskId: selectedApprovalTask?.id,
      methodologyVersionId: selectedPricingDossier.methodologyVersionId,
      portfolioSnapshotId: selectedPortfolioSnapshot?.id,
      marketDataSourceIds: selectedMarketDataSources.map((source) => source.id),
    };

    const nextDossiers = data.pricingDossiers.map((dossier) => {
      if (dossier.id !== selectedPricingDossier.id) return dossier;

      const existingCommitteePackage = dossier.evidence.find(
        (evidence) =>
          evidence.type === 'EXPORT_PACKAGE' &&
          (evidence.metadata as Record<string, unknown> | undefined)?.packageType === 'COMMITTEE_REVIEW'
      );

      const committeeEvidence = existingCommitteePackage
        ? {
            ...existingCommitteePackage,
            status: 'Generated' as const,
            metadata: packageMetadata,
          }
        : {
            id: `EVD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
            type: 'EXPORT_PACKAGE' as const,
            label: `Committee review package for ${dossier.dealId}`,
            format: 'json' as const,
            createdAt: packageTimestamp,
            createdByEmail: user?.email || 'system',
            createdByName: user?.name || 'System',
            status: 'Generated' as const,
            metadata: packageMetadata,
          };

      return {
        ...dossier,
        updatedAt: packageTimestamp,
        evidence: existingCommitteePackage
          ? dossier.evidence.map((evidence) =>
              evidence.id === existingCommitteePackage.id ? committeeEvidence : evidence
            )
          : [...dossier.evidence, committeeEvidence],
      };
    });

    data.setPricingDossiers(nextDossiers);
    try {
      await configApi.savePricingDossiers(nextDossiers);
      await auditApi.createAuditEntry({
        userEmail: user?.email || 'unknown',
        userName: user?.name || 'Unknown',
        action: 'EXPORT_COMMITTEE_PACKAGE',
        module: 'BLOTTER',
        description: `Exported committee package for deal ${selectedDossierDeal.id}`,
        details: packageMetadata,
      });
    } catch (error) {
      errorTracker.captureException(error instanceof Error ? error : new Error(String(error)), {
        module: 'DEAL_BLOTTER',
        dealId: selectedDossierDeal.id,
        extra: { operation: 'exportCommitteePackage' },
      });
      window.alert(
        'The committee package was exported locally, but its persistence record could not be saved. Please retry or check the backend connection.',
      );
    }
  }, [
    data,
    selectedApprovalTask,
    selectedDossierDeal,
    selectedMarketDataSources,
    selectedMethodologyVersion,
    selectedPortfolioSnapshot,
    selectedPricingDossier,
    user,
  ]);

  return (
    <Panel
      title={t.dealBlotter}
      className="h-full overflow-hidden"
      actions={
        <BlotterHeaderActions
          isRepricing={isRepricing}
          repriceCount={repriceCount}
          onDownloadTemplate={() => {
            void handleDownloadTemplate();
          }}
          onOpenImport={() => setIsImportOpen(true)}
          onBatchReprice={() => {
            void handleBatchReprice();
          }}
          onNewDeal={handleNewDeal}
        />
      }
    >
      <div className="flex flex-col h-full bg-slate-50 dark:bg-black">
        <BlotterToolbar
          searchTerm={searchTerm}
          filterStatus={filterStatus}
          onSearchChange={setSearchTerm}
          onFilterChange={setFilterStatus}
          onExportCsv={() => {
            const csv = buildDealsCsv(filteredDeals);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `N-Pricing_Deals_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            URL.revokeObjectURL(url);
          }}
          onExportExcel={async () => exportDealsToExcel(filteredDeals)}
        />

        <BlotterTable
          deals={filteredDeals}
          behaviouralModels={behaviouralModels}
          userRole={userRole}
          onWorkflowAction={handleWorkflowAction}
          onOpenDossier={handleOpenDossier}
          onCloneDeal={handleCloneDeal}
          onEditDeal={handleEdit}
          onDeleteDeal={handleDelete}
          formatCurrency={formatDealCurrency}
        />

        <BlotterFooter deals={filteredDeals} committeeSummary={committeeSummary} />

        <DealBlotterDrawers
          isEditOpen={isEditOpen}
          isNewOpen={isNewOpen}
          isImportOpen={isImportOpen}
          isDeleteOpen={isDeleteOpen}
          isDossierOpen={isDossierOpen}
          selectedDeal={selectedDeal}
          clients={clients}
          businessUnits={businessUnits}
          products={products}
          behaviouralModels={behaviouralModels}
          validationErrors={dealValidationErrors}
          dossierState={{
            selectedDossierDeal,
            selectedPricingDossier,
            selectedApprovalTask,
            selectedMethodologyVersion,
            selectedPortfolioSnapshot,
            selectedMarketDataSources,
            selectedAvailableActions,
          }}
          dealTemplateContent={DEAL_BLOTTER_TEMPLATE}
          onCloseEdit={() => setIsEditOpen(false)}
          onCloseNew={() => setIsNewOpen(false)}
          onCloseImport={() => setIsImportOpen(false)}
          onCloseDelete={() => setIsDeleteOpen(false)}
          onCloseDossier={handleCloseDossier}
          onSubmitEdit={handleSaveEdit}
          onSubmitNew={handleSaveNew}
          onConfirmDelete={() => {
            void confirmDelete();
          }}
          onDealChange={(updates) => setSelectedDeal((prev) => ({ ...(prev ?? {}), ...updates }))}
          onFormReady={(form) => {
            dealFormRef.current = form;
          }}
          onImportUpload={handleImport}
          onDossierWorkflowAction={handleWorkflowAction}
          onExportCommitteePackage={() => {
            void handleExportCommitteePackage();
          }}
        />
      </div>
    </Panel>
  );
};

export default DealBlotter;
