import type { UseFormReturn } from 'react-hook-form';
import type { BusinessUnit, ClientEntity, ProductDefinition, Transaction } from '../../types';
import { FileUploadModal } from '../ui/FileUploadModal';
import CommitteeDossierDrawer from './CommitteeDossierDrawer';
import DealDeleteDrawer from './DealDeleteDrawer';
import DealEditorDrawer from './DealEditorDrawer';
import type { BehaviouralModel, ValidationError } from './dealEditorTypes';
import type { useBlotterState } from './hooks/useBlotterState';

interface DealBlotterDrawersProps {
  isEditOpen: boolean;
  isNewOpen: boolean;
  isImportOpen: boolean;
  isDeleteOpen: boolean;
  isDossierOpen: boolean;
  selectedDeal: Partial<Transaction> | null;
  clients: ClientEntity[];
  businessUnits: BusinessUnit[];
  products: ProductDefinition[];
  behaviouralModels: BehaviouralModel[];
  validationErrors: ValidationError[];
  dossierState: Pick<
    ReturnType<typeof useBlotterState>,
    | 'selectedDossierDeal'
    | 'selectedPricingDossier'
    | 'selectedApprovalTask'
    | 'selectedMethodologyVersion'
    | 'selectedPortfolioSnapshot'
    | 'selectedMarketDataSources'
    | 'selectedAvailableActions'
  >;
  dealTemplateContent: string;
  onCloseEdit: () => void;
  onCloseNew: () => void;
  onCloseImport: () => void;
  onCloseDelete: () => void;
  onCloseDossier: () => void;
  onSubmitEdit: () => void;
  onSubmitNew: () => void;
  onConfirmDelete: () => void;
  onDealChange: (updates: Partial<Transaction>) => void;
  onFormReady: (form: UseFormReturn<Transaction>) => void;
  onImportUpload: (rows: Record<string, unknown>[]) => void | Promise<void>;
  onDossierWorkflowAction: (
    deal: Transaction,
    action: ReturnType<typeof useBlotterState>['selectedAvailableActions'][number],
  ) => void | Promise<void>;
  onExportCommitteePackage: () => void;
}

const DealBlotterDrawers: React.FC<DealBlotterDrawersProps> = ({
  isEditOpen,
  isNewOpen,
  isImportOpen,
  isDeleteOpen,
  isDossierOpen,
  selectedDeal,
  clients,
  businessUnits,
  products,
  behaviouralModels,
  validationErrors,
  dossierState,
  dealTemplateContent,
  onCloseEdit,
  onCloseNew,
  onCloseImport,
  onCloseDelete,
  onCloseDossier,
  onSubmitEdit,
  onSubmitNew,
  onConfirmDelete,
  onDealChange,
  onFormReady,
  onImportUpload,
  onDossierWorkflowAction,
  onExportCommitteePackage,
}) => (
  <>
    <DealEditorDrawer
      isOpen={isEditOpen}
      onClose={onCloseEdit}
      mode="edit"
      selectedDeal={selectedDeal}
      clients={clients}
      businessUnits={businessUnits}
      products={products}
      behaviouralModels={behaviouralModels}
      validationErrors={validationErrors}
      onSubmit={onSubmitEdit}
      onChange={onDealChange}
      onFormReady={onFormReady}
    />

    <DealEditorDrawer
      isOpen={isNewOpen}
      onClose={onCloseNew}
      mode="create"
      selectedDeal={selectedDeal}
      clients={clients}
      businessUnits={businessUnits}
      products={products}
      behaviouralModels={behaviouralModels}
      validationErrors={validationErrors}
      onSubmit={onSubmitNew}
      onChange={onDealChange}
      onFormReady={onFormReady}
    />

    <FileUploadModal
      isOpen={isImportOpen}
      onClose={onCloseImport}
      onUpload={onImportUpload}
      title="Import Transaction Batch"
      templateName="deals_template.csv"
      templateContent={dealTemplateContent}
    />

    <DealDeleteDrawer
      isOpen={isDeleteOpen}
      onClose={onCloseDelete}
      dealId={selectedDeal?.id}
      onConfirm={onConfirmDelete}
    />

    <CommitteeDossierDrawer
      isOpen={isDossierOpen}
      onClose={onCloseDossier}
      deal={dossierState.selectedDossierDeal}
      dossier={dossierState.selectedPricingDossier}
      approvalTask={dossierState.selectedApprovalTask}
      methodologyVersion={dossierState.selectedMethodologyVersion}
      portfolioSnapshot={dossierState.selectedPortfolioSnapshot}
      marketDataSources={dossierState.selectedMarketDataSources}
      availableActions={dossierState.selectedAvailableActions}
      onWorkflowAction={onDossierWorkflowAction}
      onExportPackage={onExportCommitteePackage}
    />
  </>
);

export default DealBlotterDrawers;
