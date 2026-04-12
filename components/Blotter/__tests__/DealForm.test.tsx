// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../contexts/UIContext', () => ({
  useUI: () => ({
    language: 'en',
    t: {
      dealId: 'Deal ID',
      counterparty: 'Counterparty',
      selectClientIdOption: '-- Select Client ID --',
      productDefinition: 'Product Definition',
      productStructure: 'Product Structure',
      startDate: 'Start Date',
      durationMonths: 'Duration (Months)',
      repricing: 'Repricing',
      riskAndCapital: 'Risk & Capital',
      behaviouralAndEsg: 'Behavioural & ESG',
      workflowStatus: 'Workflow Status',
      statusManagedViaWorkflow: 'Status is managed via workflow actions in the blotter table.',
    },
  }),
}));

vi.mock('../../../utils/dealWorkflow', () => ({
  formatStatus: (s: string) => s.replace(/_/g, ' '),
  getStatusColor: () => 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}));

vi.mock('../../../utils/dealFormResolver', () => ({
  dealFormResolver: async (values: Record<string, unknown>) => ({ values, errors: {} }),
}));

// ---------------------------------------------------------------------------
// Import component under test
// ---------------------------------------------------------------------------

import React from 'react';
import DealForm from '../DealForm';
import type { ClientEntity, BusinessUnit, ProductDefinition, BehaviouralModel, Transaction } from '../../../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_DEAL: Partial<Transaction> = {
  id: 'DEAL-001',
  clientId: 'CL-1001',
  clientType: 'Corporate',
  productType: 'LOAN_COMM',
  amount: 5000000,
  currency: 'EUR',
  startDate: '2024-01-15',
  durationMonths: 36,
  marginTarget: 1.5,
  riskWeight: 100,
  capitalRatio: 11.5,
  targetROE: 15,
  operationalCostBps: 45,
  status: 'Draft',
  amortization: 'Bullet',
  repricingFreq: 'Fixed',
  transitionRisk: 'Neutral',
  physicalRisk: 'Low',
};

const MOCK_CLIENTS: ClientEntity[] = [
  { id: 'CL-1001', name: 'Acme Corp', type: 'Corporate', segment: 'Corporate', rating: 'A' },
  { id: 'CL-1002', name: 'Beta Bank', type: 'Institution', segment: 'Financial', rating: 'AA' },
];

const MOCK_BU: BusinessUnit[] = [
  { id: 'BU-001', name: 'CIB', code: 'CIB' },
  { id: 'BU-002', name: 'Retail', code: 'RTL' },
];

const MOCK_PRODUCTS: ProductDefinition[] = [
  { id: 'LOAN_COMM', name: 'Commercial Loan', category: 'Asset' },
  { id: 'DEP_TERM', name: 'Term Deposit', category: 'Liability' },
];

const MOCK_BEHAVIOURAL_MODELS: BehaviouralModel[] = [];

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderForm(overrides: Partial<Parameters<typeof DealForm>[0]> = {}) {
  const onChange = vi.fn();
  const result = render(
    <DealForm
      selectedDeal={MOCK_DEAL}
      clients={MOCK_CLIENTS}
      businessUnits={MOCK_BU}
      products={MOCK_PRODUCTS}
      behaviouralModels={MOCK_BEHAVIOURAL_MODELS}
      onChange={onChange}
      {...overrides}
    />,
  );
  return { ...result, onChange };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DealForm', () => {
  it('renders form with deal data', () => {
    renderForm();
    // Deal ID is displayed as text
    expect(screen.getByText('DEAL-001')).toBeInTheDocument();
    // Section headings are present
    expect(screen.getByText('Counterparty')).toBeInTheDocument();
    expect(screen.getByText('Product Structure')).toBeInTheDocument();
    expect(screen.getByText('Risk & Capital')).toBeInTheDocument();
    expect(screen.getByText('Workflow Status')).toBeInTheDocument();
  });

  it('calls onChange when form values change', async () => {
    const onChange = vi.fn();
    renderForm({ onChange });
    // Type into the Amount field
    const amountInput = screen.getByLabelText('Amount') as HTMLInputElement;
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, '9000000');
    // onChange is called via useWatch propagation
    expect(onChange).toHaveBeenCalled();
  });

  it('renders product options from products prop', () => {
    renderForm();
    expect(screen.getByText('Commercial Loan')).toBeInTheDocument();
    expect(screen.getByText('Term Deposit')).toBeInTheDocument();
  });
});
