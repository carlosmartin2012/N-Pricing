// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  useBlotterState: vi.fn(),
  useBlotterActions: vi.fn(),
}));

vi.mock('../hooks/useBlotterState', () => ({ useBlotterState: mocks.useBlotterState }));
vi.mock('../hooks/useBlotterActions', () => ({ useBlotterActions: mocks.useBlotterActions }));

vi.mock('../../../contexts/DataContext', () => ({
  useData: () => ({
    deals: [{ id: 'DEAL-001', clientId: 'CL-1001', productType: 'LOAN_COMM', amount: 5000000, status: 'Draft', currency: 'EUR', durationMonths: 36, marginTarget: 1.5, behaviouralModelId: '' }],
    setDeals: vi.fn(),
    products: [{ id: 'LOAN_COMM', name: 'Commercial Loan', category: 'Asset' }],
    clients: [{ id: 'CL-1001', name: 'Acme Corp', segment: 'Corporate' }],
    businessUnits: [{ id: 'BU-001', name: 'CIB', code: 'CIB' }],
    approvalTasks: [],
    pricingDossiers: [],
    methodologyVersions: [],
    portfolioSnapshots: [],
    marketDataSources: [],
    behaviouralModels: [],
    setPricingDossiers: vi.fn(),
  }),
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: { id: 'u1', email: 'trader@nfq.es', name: 'Test Trader', role: 'Trader' } }),
}));

vi.mock('../../../contexts/UIContext', () => ({
  useUI: () => ({
    language: 'en',
    t: {
      dealBlotter: 'Deal Blotter',
      search: 'Search',
      all: 'All',
      searchClientOrId: 'Search Client or ID...',
      allStatus: 'All Status',
    },
  }),
  UIProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../../api/audit', () => ({ createAuditEntry: vi.fn(), logAudit: vi.fn() }));
vi.mock('../../../api/config', () => ({ savePricingDossiers: vi.fn() }));
vi.mock('../../../utils/errorTracking', () => ({
  errorTracker: { captureException: vi.fn() },
}));
vi.mock('../../../utils/excelUtils', () => ({ exportDealsToExcel: vi.fn() }));
vi.mock('../../../utils/dealWorkflow', () => ({
  canBatchRepriceDeals: () => true,
  canEditDeal: () => true,
  canCreateOrCloneDeals: () => true,
  canDeleteDeal: () => true,
  getAvailableActions: () => [],
  formatStatus: (s: string) => s.replace(/_/g, ' '),
  getStatusColor: () => 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}));
vi.mock('../blotterUtils', () => ({
  buildDealsCsv: vi.fn(() => ''),
  formatDealCurrency: vi.fn((v: number) => `$${v}`),
}));
vi.mock('../committeeDossierUtils', () => ({
  buildCommitteePackage: vi.fn(),
  downloadCommitteePackage: vi.fn(),
  summarizeCommitteeQueue: vi.fn(() => ({ pendingReview: 0, readyToBook: 0, aiSupported: 0, openTasks: 0 })),
}));

// ---------------------------------------------------------------------------
// Import component under test (after mocks)
// ---------------------------------------------------------------------------

import React from 'react';
import DealBlotter from '../DealBlotter';

// ---------------------------------------------------------------------------
// Default mock return values
// ---------------------------------------------------------------------------

const MOCK_DEAL = {
  id: 'DEAL-001',
  clientId: 'CL-1001',
  productType: 'LOAN_COMM',
  amount: 5000000,
  status: 'Draft',
  currency: 'EUR',
  durationMonths: 36,
  marginTarget: 1.5,
  behaviouralModelId: '',
};

function setupMocks() {
  mocks.useBlotterState.mockReturnValue({
    searchTerm: '',
    setSearchTerm: vi.fn(),
    filterStatus: 'All',
    setFilterStatus: vi.fn(),
    filteredDeals: [MOCK_DEAL],
    selectedDossierDeal: null,
    selectedPricingDossier: undefined,
    selectedApprovalTask: undefined,
    selectedMethodologyVersion: undefined,
    selectedPortfolioSnapshot: undefined,
    selectedMarketDataSources: [],
    committeeSummary: { pendingReview: 0, readyToBook: 0, aiSupported: 0, openTasks: 0 },
    selectedAvailableActions: [],
    setSelectedDossierDealId: vi.fn(),
  });

  mocks.useBlotterActions.mockReturnValue({
    behaviouralModels: [],
    confirmDelete: vi.fn(),
    dealFormRef: { current: null },
    dealTemplateContent: '',
    dealValidationErrors: [],
    handleBatchReprice: vi.fn(),
    handleCloneDeal: vi.fn(),
    handleDelete: vi.fn(),
    handleDownloadTemplate: vi.fn(),
    handleEdit: vi.fn(),
    handleImport: vi.fn(),
    handleNewDeal: vi.fn(),
    handleSaveEdit: vi.fn(),
    handleSaveNew: vi.fn(),
    handleWorkflowAction: vi.fn(),
    isDeleteOpen: false,
    isEditOpen: false,
    isImportOpen: false,
    isNewOpen: false,
    isRepricing: false,
    openImport: vi.fn(),
    repriceCount: 0,
    selectedDeal: null,
    setIsDeleteOpen: vi.fn(),
    setIsEditOpen: vi.fn(),
    setIsImportOpen: vi.fn(),
    setIsNewOpen: vi.fn(),
    setSelectedDeal: vi.fn(),
  });
}

function renderDealBlotter() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DealBlotter />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DealBlotter', () => {
  beforeEach(() => {
    setupMocks();
  });

  it('renders the deal blotter panel with title', () => {
    renderDealBlotter();
    expect(screen.getByText('Deal Blotter')).toBeInTheDocument();
  });

  it('renders toolbar with search and filter controls', () => {
    renderDealBlotter();
    expect(screen.getByPlaceholderText('Search Client or ID...')).toBeInTheDocument();
  });

  it('displays deal count in footer', () => {
    renderDealBlotter();
    // BlotterFooter renders "ROWS:" followed by the deal count
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText(/ROWS/)).toBeInTheDocument();
  });
});
