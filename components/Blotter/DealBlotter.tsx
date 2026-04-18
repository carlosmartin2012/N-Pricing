import React, { lazy, Suspense, useCallback, useState } from 'react';
import * as auditApi from '../../api/audit';
import * as configApi from '../../api/config';
import { Panel } from '../ui/LayoutComponents';
import { exportDealsToExcel } from '../../utils/excelUtils';
import type {
  Transaction,
} from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { errorTracker } from '../../utils/errorTracking';
import type { UserRole } from '../../utils/dealWorkflow';
import BlotterFooter from './BlotterFooter';
import BlotterHeaderActions from './BlotterHeaderActions';
import BlotterTable from './BlotterTable';
import BlotterToolbar from './BlotterToolbar';
// Drawers only mount on user interaction (edit, dossier, import, outcome…).
// Lazy-loading them keeps their ~30 KB out of the initial DealBlotter chunk.
const DealBlotterDrawers = lazy(() => import('./DealBlotterDrawers'));
import { buildDealsCsv, formatDealCurrency } from './blotterUtils';
import { buildCommitteePackage, downloadCommitteePackage } from './committeeDossierUtils';
import { BulkActionBar } from './BulkActionBar';
// Compare drawer opens only from the BulkActionBar — defer its chunk too.
const DealComparisonDrawer = lazy(() =>
  import('./DealComparisonDrawer').then((m) => ({ default: m.DealComparisonDrawer })),
);
import { useBlotterActions } from './hooks/useBlotterActions';
import { useBlotterState } from './hooks/useBlotterState';
import { canBatchRepriceDeals } from '../../utils/dealWorkflow';
import * as dealsApi from '../../api/deals';

const DealBlotter: React.FC = () => {
  const data = useData();
  const { currentUser: user } = useAuth();
  const { t } = useUI();
  const { deals, setDeals, products, clients, businessUnits } = data;
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set());
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isOutcomeOpen, setIsOutcomeOpen] = useState(false);
  const [outcomeDealId, setOutcomeDealId] = useState<string | null>(null);

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

  const {
    behaviouralModels,
    confirmDelete,
    dealFormRef,
    dealTemplateContent,
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
    openImport,
    repriceCount,
    selectedDeal,
    setIsDeleteOpen,
    setIsEditOpen,
    setIsImportOpen,
    setIsNewOpen,
    setSelectedDeal,
  } = useBlotterActions({
    deals,
    setDeals,
    products,
    clients,
    businessUnits,
    user,
    userRole,
  });

  const handleOpenDossier = useCallback(
    (deal: Transaction) => {
      if (!deal.id) return;
      setSelectedDossierDealId(deal.id);
      setIsDossierOpen(true);
    },
    [setSelectedDossierDealId]
  );

  const handleCloseDossier = useCallback(() => {
    setIsDossierOpen(false);
    setSelectedDossierDealId(null);
  }, [setSelectedDossierDealId]);

  const handleCaptureOutcome = useCallback((deal: Transaction) => {
    if (!deal.id) return;
    setOutcomeDealId(deal.id);
    setIsOutcomeOpen(true);
  }, []);

  const handleSaveOutcome = useCallback(
    async (patch: Partial<Transaction>) => {
      if (!outcomeDealId) return;
      const target = deals.find((d) => d.id === outcomeDealId);
      if (!target) return;
      const updated: Transaction = { ...target, ...patch };
      try {
        const saved = await dealsApi.upsertDeal(updated);
        setDeals((previous) => previous.map((d) => (d.id === outcomeDealId ? saved || updated : d)));
        await auditApi.createAuditEntry({
          userEmail: user?.email || 'unknown',
          userName: user?.name || 'Unknown',
          action: 'CAPTURE_OUTCOME',
          module: 'BLOTTER',
          description: `Captured outcome ${patch.wonLost ?? '?'} for deal ${outcomeDealId}`,
          details: { wonLost: patch.wonLost, lossReason: patch.lossReason, competitorRate: patch.competitorRate },
        });
      } catch (error) {
        errorTracker.captureException(error instanceof Error ? error : new Error(String(error)), {
          module: 'DEAL_BLOTTER',
          dealId: outcomeDealId,
          extra: { operation: 'captureOutcome' },
        });
      }
    },
    [outcomeDealId, deals, setDeals, user],
  );

  const outcomeDeal = outcomeDealId ? deals.find((d) => d.id === outcomeDealId) : undefined;

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
    <>
    <Panel
      title={t.dealBlotter}
      className="h-full overflow-hidden"
      actions={
        <BlotterHeaderActions
          canMutate={canBatchRepriceDeals(userRole)}
          isRepricing={isRepricing}
          repriceCount={repriceCount}
          onDownloadTemplate={() => {
            void handleDownloadTemplate();
          }}
          onOpenImport={openImport}
          onBatchReprice={() => {
            void handleBatchReprice();
          }}
          onNewDeal={handleNewDeal}
        />
      }
    >
      <div className="flex h-full flex-col bg-slate-50 dark:bg-black">
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

        <BulkActionBar
          selectedCount={selectedDealIds.size}
          onClear={() => setSelectedDealIds(new Set())}
          onExport={() => {
            const selected = filteredDeals.filter((d) => d.id && selectedDealIds.has(d.id));
            if (selected.length > 0) void exportDealsToExcel(selected);
            setSelectedDealIds(new Set());
          }}
          onBatchReprice={() => { void handleBatchReprice(); setSelectedDealIds(new Set()); }}
          canReprice={canBatchRepriceDeals(userRole)}
          onCompare={() => setIsCompareOpen(true)}
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
          onCaptureOutcome={handleCaptureOutcome}
          formatCurrency={formatDealCurrency}
          selectedDealIds={selectedDealIds}
          onSelectionChange={setSelectedDealIds}
        />

        <BlotterFooter deals={filteredDeals} committeeSummary={committeeSummary} />

        {(isEditOpen || isNewOpen || isImportOpen || isDeleteOpen || isDossierOpen || isOutcomeOpen) && (
        <Suspense fallback={null}>
        <DealBlotterDrawers
          isEditOpen={isEditOpen}
          isNewOpen={isNewOpen}
          isImportOpen={isImportOpen}
          isDeleteOpen={isDeleteOpen}
          isDossierOpen={isDossierOpen}
          isOutcomeOpen={isOutcomeOpen}
          outcomeDeal={outcomeDeal}
          onCloseOutcome={() => {
            setIsOutcomeOpen(false);
            setOutcomeDealId(null);
          }}
          onSaveOutcome={handleSaveOutcome}
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
          dealTemplateContent={dealTemplateContent}
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
          onDealChange={(updates) => setSelectedDeal((previous) => ({ ...(previous ?? {}), ...updates }))}
          onFormReady={(form) => {
            dealFormRef.current = form;
          }}
          onImportUpload={handleImport}
          onDossierWorkflowAction={handleWorkflowAction}
          onExportCommitteePackage={() => {
            void handleExportCommitteePackage();
          }}
        />
        </Suspense>
        )}
      </div>
    </Panel>

    {isCompareOpen && (() => {
      const ids = Array.from(selectedDealIds);
      const compareA = filteredDeals.find((d) => d.id === ids[0]) || null;
      const compareB = filteredDeals.find((d) => d.id === ids[1]) || null;
      return (
        <Suspense fallback={null}>
          <DealComparisonDrawer
            isOpen={isCompareOpen}
            onClose={() => setIsCompareOpen(false)}
            dealA={compareA}
            dealB={compareB}
          />
        </Suspense>
      );
    })()}
    </>
  );
};

export default DealBlotter;
