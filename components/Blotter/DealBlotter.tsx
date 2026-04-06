import React, { useState, useMemo, useCallback, useRef } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Panel } from '../ui/LayoutComponents';
import { Drawer } from '../ui/Drawer';
import { validateDeal, type ValidationError } from '../../utils/validation';
import {
  PricingDossierStatus,
  Transaction,
  ProductDefinition,
  ClientEntity,
  BusinessUnit,
  UserProfile,
} from '../../types';
import { type DataContextType, useData } from '../../contexts/DataContext';
import { FileUp, Plus, RefreshCw, Trash2, Upload } from 'lucide-react';
import { batchReprice, calculatePricing } from '../../utils/pricingEngine';
import { FileUploadModal } from '../ui/FileUploadModal';
import { supabaseService } from '../../utils/supabaseService';
import { translations, Language } from '../../translations';
import { downloadTemplate, exportDealsToExcel } from '../../utils/excelUtils';
import { executeTransition, getAvailableActions, type UserRole, type WorkflowAction } from '../../utils/dealWorkflow';
import { findLatestPortfolioSnapshotForDeal } from '../../utils/aiGrounding';
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
import BlotterTable from './BlotterTable';
import BlotterToolbar from './BlotterToolbar';
import CommitteeDossierDrawer from './CommitteeDossierDrawer';
import DealForm from './DealForm';
import {
  buildDealsCsv,
  createImportedDeal,
  createNewDealDraft,
  DEAL_BLOTTER_TEMPLATE,
  formatDealCurrency,
  normalizeDealDraft,
} from './blotterUtils';
import { buildCommitteePackage, downloadCommitteePackage, summarizeCommitteeQueue } from './committeeDossierUtils';

const mapWorkflowStatusToDossierStatus = (status?: Transaction['status']): PricingDossierStatus | null => {
  if (!status) return null;
  if (status === 'Pending_Approval') return 'Pending_Approval';
  if (status === 'Approved') return 'Approved';
  if (status === 'Rejected') return 'Rejected';
  if (status === 'Booked') return 'Booked';
  if (status === 'Draft') return 'Draft';
  return null;
};

const replaceDealIdentifier = (value: string | undefined, previousId: string, nextId: string) =>
  value ? value.split(previousId).join(nextId) : value;

const updateReferencedDealId = (
  previousId: string,
  nextId: string,
  data: Pick<DataContextType, 'approvalTasks' | 'pricingDossiers' | 'portfolioSnapshots'>
) => {
  const nextApprovalTasks = data.approvalTasks.map((task) => {
    if (task.scope !== 'DEAL_PRICING' || task.subject.id !== previousId) return task;

    return {
      ...task,
      title: replaceDealIdentifier(task.title, previousId, nextId) || task.title,
      description: replaceDealIdentifier(task.description, previousId, nextId) || task.description,
      subject: {
        ...task.subject,
        id: nextId,
        label: replaceDealIdentifier(task.subject.label, previousId, nextId) || nextId,
      },
      correlation: {
        ...task.correlation,
        dealId: nextId,
      },
    };
  });

  const nextPricingDossiers = data.pricingDossiers.map((dossier) => {
    if (dossier.dealId !== previousId) return dossier;

    return {
      ...dossier,
      dealId: nextId,
      title: replaceDealIdentifier(dossier.title, previousId, nextId) || dossier.title,
      dealSnapshot: {
        ...dossier.dealSnapshot,
        id: nextId,
      },
      evidence: dossier.evidence.map((evidence) => ({
        ...evidence,
        label: replaceDealIdentifier(evidence.label, previousId, nextId) || evidence.label,
      })),
      correlation: {
        ...dossier.correlation,
        dealId: nextId,
      },
      groundedContext: dossier.groundedContext
        ? {
            ...dossier.groundedContext,
            dealId: nextId,
            subjectRefs: dossier.groundedContext.subjectRefs.map((subject) =>
              subject.type === 'DEAL' && subject.id === previousId
                ? {
                    ...subject,
                    id: nextId,
                    label: replaceDealIdentifier(subject.label, previousId, nextId) || nextId,
                  }
                : subject
            ),
          }
        : dossier.groundedContext,
      aiResponseTraces: dossier.aiResponseTraces?.map((trace) => ({
        ...trace,
        groundedContext: {
          ...trace.groundedContext,
          dealId: trace.groundedContext.dealId === previousId ? nextId : trace.groundedContext.dealId,
          subjectRefs: trace.groundedContext.subjectRefs.map((subject) =>
            subject.type === 'DEAL' && subject.id === previousId
              ? {
                  ...subject,
                  id: nextId,
                  label: replaceDealIdentifier(subject.label, previousId, nextId) || nextId,
                }
              : subject
          ),
        },
        sources: trace.sources.map((subject) =>
          subject.type === 'DEAL' && subject.id === previousId
            ? {
                ...subject,
                id: nextId,
                label: replaceDealIdentifier(subject.label, previousId, nextId) || nextId,
              }
            : subject
        ),
      })),
    };
  });

  const nextPortfolioSnapshots = data.portfolioSnapshots.map((snapshot) => ({
    ...snapshot,
    dealIds: snapshot.dealIds.map((dealId) => (dealId === previousId ? nextId : dealId)),
    results: snapshot.results.map((result) =>
      result.dealId === previousId
        ? {
            ...result,
            dealId: nextId,
          }
        : result
    ),
  }));

  return {
    nextApprovalTasks,
    nextPricingDossiers,
    nextPortfolioSnapshots,
  };
};

interface RenamedDealReferences {
  nextApprovalTasks: DataContextType['approvalTasks'];
  nextPricingDossiers: DataContextType['pricingDossiers'];
  nextPortfolioSnapshots: DataContextType['portfolioSnapshots'];
}

interface Props {
  deals: Transaction[];
  setDeals: React.Dispatch<React.SetStateAction<Transaction[]>>;
  products: ProductDefinition[];
  clients: ClientEntity[];
  businessUnits: BusinessUnit[];
  language: Language;
  user: UserProfile | null;
}

const DealBlotter: React.FC<Props> = ({ deals, setDeals, products, clients, businessUnits, language, user }) => {
  const data = useData();
  const { behaviouralModels } = data;
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const t = translations[language];

  // Drawer States
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDossierOpen, setIsDossierOpen] = useState(false);

  const [selectedDeal, setSelectedDeal] = useState<Partial<Transaction> | null>(null);
  const [selectedDossierDealId, setSelectedDossierDealId] = useState<string | null>(null);
  const [dealValidationErrors, setDealValidationErrors] = useState<ValidationError[]>([]);
  const dealFormRef = useRef<UseFormReturn<Transaction> | null>(null);
  const userRole = (user?.role || 'Trader') as UserRole;

  const handleImport = async (rows: any[]) => {
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
        const renamedDeal = await supabaseService.renameDealId(operation.previousId, operation.nextId);
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
          supabaseService.saveApprovalTasks(updatedReferences.nextApprovalTasks),
          supabaseService.savePricingDossiers(updatedReferences.nextPricingDossiers),
          supabaseService.savePortfolioSnapshots(updatedReferences.nextPortfolioSnapshots),
        ]);
      }

      supabaseService.addAuditEntry({
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
      await Promise.all(newDeals.map((d) => supabaseService.upsertDeal(d)));

      supabaseService.addAuditEntry({
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

  const filteredDeals = useMemo(
    () =>
      deals.filter((deal) => {
        const matchesSearch =
          deal.clientId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (deal.id || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'All' || deal.status === filterStatus;
        return matchesSearch && matchesStatus;
      }),
    [deals, searchTerm, filterStatus]
  );
  const filteredDealIds = useMemo(() => new Set(filteredDeals.map((deal) => deal.id)), [filteredDeals]);
  const selectedDossierDeal = useMemo(
    () => deals.find((deal) => deal.id === selectedDossierDealId) || null,
    [deals, selectedDossierDealId]
  );
  const selectedPricingDossier = useMemo(
    () =>
      selectedDossierDeal?.id
        ? data.pricingDossiers.find((dossier) => dossier.dealId === selectedDossierDeal.id)
        : undefined,
    [data.pricingDossiers, selectedDossierDeal?.id]
  );
  const selectedApprovalTask = useMemo(() => {
    if (!selectedDossierDeal?.id) return undefined;

    return (
      (selectedPricingDossier?.approvalTaskId
        ? data.approvalTasks.find((task) => task.id === selectedPricingDossier.approvalTaskId)
        : undefined) ||
      data.approvalTasks.find((task) => task.scope === 'DEAL_PRICING' && task.subject.id === selectedDossierDeal.id)
    );
  }, [data.approvalTasks, selectedDossierDeal?.id, selectedPricingDossier?.approvalTaskId]);
  const selectedMethodologyVersion = useMemo(
    () =>
      selectedPricingDossier
        ? data.methodologyVersions.find((version) => version.id === selectedPricingDossier.methodologyVersionId)
        : undefined,
    [data.methodologyVersions, selectedPricingDossier]
  );
  const selectedPortfolioSnapshot = useMemo(() => {
    if (!selectedDossierDeal?.id) return undefined;

    return (
      (selectedPricingDossier?.groundedContext?.portfolioSnapshotId
        ? data.portfolioSnapshots.find(
            (snapshot) => snapshot.id === selectedPricingDossier.groundedContext?.portfolioSnapshotId
          )
        : undefined) || findLatestPortfolioSnapshotForDeal(selectedDossierDeal.id, data.portfolioSnapshots)
    );
  }, [data.portfolioSnapshots, selectedDossierDeal?.id, selectedPricingDossier?.groundedContext?.portfolioSnapshotId]);
  const selectedMarketDataSources = useMemo(() => {
    if (!selectedPricingDossier?.groundedContext?.marketDataSourceIds?.length) return data.marketDataSources;

    return data.marketDataSources.filter((source) =>
      selectedPricingDossier.groundedContext?.marketDataSourceIds?.includes(source.id)
    );
  }, [data.marketDataSources, selectedPricingDossier?.groundedContext?.marketDataSourceIds]);
  const committeeSummary = useMemo(
    () =>
      summarizeCommitteeQueue({
        deals: filteredDeals,
        dossiers: data.pricingDossiers.filter((dossier) => filteredDealIds.has(dossier.dealId)),
        approvalTasks: data.approvalTasks.filter(
          (task) => task.scope === 'DEAL_PRICING' && filteredDealIds.has(task.subject.id)
        ),
      }),
    [data.approvalTasks, data.pricingDossiers, filteredDealIds, filteredDeals]
  );
  const selectedAvailableActions = useMemo(
    () => (selectedDossierDeal ? getAvailableActions(selectedDossierDeal.status || 'Draft', userRole) : []),
    [selectedDossierDeal, userRole]
  );

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
      await supabaseService.upsertDeal(clonedDeal);
      setDeals((prev) => [clonedDeal, ...prev]);
      await supabaseService.addAuditEntry({
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
        ? await supabaseService.transitionDeal(deal.id, action.to, user?.email || 'unknown', pricingSnapshot)
        : await supabaseService.upsertDeal({
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
          supabaseService.savePricingDossiers(nextDossiers),
          supabaseService.saveApprovalTasks(nextTasks),
        ]);
      }

      await supabaseService.addAuditEntry({
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

    await supabaseService.addAuditEntry({
      userEmail: user?.email || 'unknown',
      userName: user?.name || 'Unknown',
      action: 'BATCH_REPRICE',
      module: 'BLOTTER',
      description: `Batch repriced ${results.size} deals and exported to Excel`,
    });
    setIsRepricing(false);
    setTimeout(() => setRepriceCount(0), 3000);
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
  }, []);

  const handleCloseDossier = useCallback(() => {
    setIsDossierOpen(false);
    setSelectedDossierDealId(null);
  }, []);

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
    const savedDeal = await supabaseService.upsertDeal(updated);
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
    const savedDeal = await supabaseService.upsertDeal(newDeal);
    setDeals((prev) => [savedDeal || newDeal, ...prev]);
    setIsNewOpen(false);
  };

  const handleDelete = (deal: Transaction) => {
    setSelectedDeal(deal);
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (selectedDeal && selectedDeal.id) {
      await supabaseService.deleteDeal(selectedDeal.id);
      setDeals((prev) => prev.filter((deal) => deal.id !== selectedDeal.id));
      const nextTasks = data.approvalTasks.filter(
        (task) => !(task.scope === 'DEAL_PRICING' && task.subject.id === selectedDeal.id)
      );
      const nextDossiers = data.pricingDossiers.filter((dossier) => dossier.dealId !== selectedDeal.id);
      data.setApprovalTasks(nextTasks);
      data.setPricingDossiers(nextDossiers);
      await Promise.all([
        supabaseService.saveApprovalTasks(nextTasks),
        supabaseService.savePricingDossiers(nextDossiers),
      ]);
      await supabaseService.addAuditEntry({
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
    await supabaseService.savePricingDossiers(nextDossiers);
    await supabaseService.addAuditEntry({
      userEmail: user?.email || 'unknown',
      userName: user?.name || 'Unknown',
      action: 'EXPORT_COMMITTEE_PACKAGE',
      module: 'BLOTTER',
      description: `Exported committee package for deal ${selectedDossierDeal.id}`,
      details: packageMetadata,
    });
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
        <div className="flex gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded border border-slate-700 text-xs flex items-center gap-1 transition-colors"
            title="Download ID Modification Template"
          >
            <FileUp size={14} /> <span className="hidden sm:inline">ID Template</span>
          </button>
          <button
            onClick={() => setIsImportOpen(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded border border-slate-700 text-xs flex items-center gap-1 transition-colors"
          >
            <Upload size={14} /> <span className="hidden sm:inline">Import Excel</span>
          </button>
          <button
            onClick={handleBatchReprice}
            disabled={isRepricing}
            className={`px-3 py-1.5 rounded border text-xs flex items-center gap-1 transition-colors font-bold ${
              repriceCount > 0
                ? 'bg-emerald-900/30 border-emerald-700 text-emerald-400'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-400'
            }`}
          >
            <RefreshCw size={14} className={isRepricing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{repriceCount > 0 ? `${repriceCount} Repriced` : 'Batch Reprice'}</span>
          </button>
          <button
            onClick={handleNewDeal}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs flex items-center gap-1 transition-colors font-bold shadow-lg shadow-cyan-900/20"
          >
            <Plus size={14} /> <span className="hidden sm:inline">New Deal</span>
          </button>
        </div>
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

        {/* --- DRAWERS --- */}

        {/* Edit Drawer */}
        <Drawer
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          title={`Edit Deal: ${selectedDeal?.id || ''}`}
          footer={
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsEditOpen(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded"
              >
                Save Changes
              </button>
            </div>
          }
        >
          {dealValidationErrors.length > 0 && (
            <div className="mb-4 rounded-lg border border-red-500/25 bg-red-500/10 p-3">
              <div className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1">Validation Errors</div>
              <ul className="space-y-0.5">
                {dealValidationErrors.map((err) => (
                  <li key={err.field} className="text-[11px] text-red-300">
                    <span className="font-mono text-red-400">{err.field}</span>: {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {selectedDeal && (
            <DealForm
              selectedDeal={selectedDeal}
              clients={clients}
              businessUnits={businessUnits}
              products={products}
              behaviouralModels={behaviouralModels}
              onChange={(updates) => setSelectedDeal((prev) => ({ ...(prev ?? {}), ...updates }))}
              onFormReady={(form) => { dealFormRef.current = form; }}
            />
          )}
        </Drawer>

        {/* New Deal Drawer */}
        <Drawer
          isOpen={isNewOpen}
          onClose={() => setIsNewOpen(false)}
          title="Create New Transaction"
          footer={
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsNewOpen(false)} className="px-4 py-2 text-xs text-slate-400 hover:text-white">
                Cancel
              </button>
              <button
                onClick={handleSaveNew}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded"
              >
                Create Deal
              </button>
            </div>
          }
        >
          {dealValidationErrors.length > 0 && (
            <div className="mb-4 rounded-lg border border-red-500/25 bg-red-500/10 p-3">
              <div className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1">Validation Errors</div>
              <ul className="space-y-0.5">
                {dealValidationErrors.map((err) => (
                  <li key={err.field} className="text-[11px] text-red-300">
                    <span className="font-mono text-red-400">{err.field}</span>: {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {selectedDeal && (
            <DealForm
              selectedDeal={selectedDeal}
              clients={clients}
              businessUnits={businessUnits}
              products={products}
              behaviouralModels={behaviouralModels}
              onChange={(updates) => setSelectedDeal((prev) => ({ ...(prev ?? {}), ...updates }))}
            />
          )}
        </Drawer>

        {/* Import Drawer (FileUploadModal) */}
        <FileUploadModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          onUpload={handleImport}
          title="Import Transaction Batch"
          templateName="deals_template.csv"
          templateContent={DEAL_BLOTTER_TEMPLATE}
        />

        {/* Delete Confirmation Drawer */}
        <Drawer
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
          title="Delete Transaction"
          footer={
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsDeleteOpen(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded"
              >
                Confirm Delete
              </button>
            </div>
          }
        >
          <div className="text-center p-4">
            <div className="w-16 h-16 bg-red-950/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} className="text-red-500" />
            </div>
            <h3 className="text-slate-200 font-bold mb-2">Are you sure?</h3>
            <p className="text-xs text-slate-400">
              This action will permanently delete deal <span className="text-white font-mono">{selectedDeal?.id}</span>{' '}
              and reverse all associated accounting entries.
            </p>
          </div>
        </Drawer>

        <CommitteeDossierDrawer
          isOpen={isDossierOpen}
          onClose={handleCloseDossier}
          deal={selectedDossierDeal}
          dossier={selectedPricingDossier}
          approvalTask={selectedApprovalTask}
          methodologyVersion={selectedMethodologyVersion}
          portfolioSnapshot={selectedPortfolioSnapshot}
          marketDataSources={selectedMarketDataSources}
          availableActions={selectedAvailableActions}
          onWorkflowAction={handleWorkflowAction}
          onExportPackage={() => {
            void handleExportCommitteePackage();
          }}
        />
      </div>
    </Panel>
  );
};

export default DealBlotter;
