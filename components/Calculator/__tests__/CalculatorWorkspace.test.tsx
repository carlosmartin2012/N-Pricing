// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router';
import { UIProvider } from '../../../contexts/UIContext';
import { CalculatorWorkspace } from '../CalculatorWorkspace';
import { INITIAL_DEAL } from '../../../utils/seedData';
import type { Transaction } from '../../../types';

const mocks = vi.hoisted(() => ({
  calculatePricing: vi.fn(() => ({
    ftpRate: 3.5,
    totalCharge: 1.2,
    finalClientRate: 4.7,
    raroc: 15.5,
  })),
}));

vi.mock('../../../utils/pricingEngine', () => ({
  calculatePricing: mocks.calculatePricing,
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: { id: 'u1', email: 'test@nfq.es', name: 'Test', role: 'Trader' } }),
}));

vi.mock('../../../contexts/DataContext', () => ({
  useData: () => ({
    deals: [],
    clients: [],
    products: [],
    businessUnits: [],
    behaviouralModels: [],
    approvalMatrix: { autoApprovalThreshold: 15, l1Threshold: 10, l2Threshold: 5 },
  }),
}));

vi.mock('../../../contexts/UIContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../contexts/UIContext')>();
  return {
    ...actual,
    useUI: () => ({ language: 'en' }),
  };
});

vi.mock('../DealInputPanel', () => ({
  default: (props: Record<string, unknown>) => <div data-testid="deal-input-panel">{JSON.stringify(props.values)}</div>,
}));

vi.mock('../PricingReceipt', () => ({
  default: () => <div data-testid="pricing-receipt">Receipt</div>,
}));

vi.mock('../MethodologyVisualizer', () => ({
  default: () => <div>MethodologyVisualizer</div>,
}));

vi.mock('../PricingComparison', () => ({
  default: () => <div>PricingComparison</div>,
}));

vi.mock('../InverseOptimizerPanel', () => ({
  default: () => <div>InverseOptimizer</div>,
}));

vi.mock('../DelegationAuditPanel', () => ({
  default: (props: Record<string, unknown>) => <div data-testid="delegation-audit">{JSON.stringify(props.result)}</div>,
}));

vi.mock('../CrossBonusesPicker', () => ({
  default: () => <div>CrossBonuses</div>,
}));

vi.mock('../IFRS9StagePanel', () => ({
  default: () => <div>IFRS9</div>,
}));

vi.mock('../LineagePanel', () => ({
  default: () => <div>Lineage</div>,
}));

vi.mock('../../RAROC/WaterfallExplainerCard', () => ({
  WaterfallExplainerCard: () => <div>Waterfall</div>,
}));

// Customer360 panels bring React Query into the tree; stub them so this
// test doesn't need a QueryClientProvider.
vi.mock('../../Customer360/CustomerRelationshipPanel', () => ({
  default: () => <div data-testid="customer-relationship-panel" />,
}));
vi.mock('../../Customer360/LtvImpactPanel', () => ({
  default: () => <div data-testid="ltv-impact-panel" />,
}));

// AttributionSimulator (Ola 8 Bloque B) idem — useAttributionMatrixQuery
// requiere QueryClientProvider que este test no monta.
vi.mock('../../Attributions/AttributionSimulator', () => ({
  default: () => <div data-testid="attribution-simulator" />,
}));

describe('CalculatorWorkspace', () => {
  const setDealParams = vi.fn();

  beforeEach(() => {
    mocks.calculatePricing.mockClear();
    setDealParams.mockClear();
  });

  function renderWorkspace(dealOverrides: Partial<Transaction> = {}) {
    const deal = { ...INITIAL_DEAL, ...dealOverrides };
    return render(
      <MemoryRouter>
        <UIProvider>
          <CalculatorWorkspace dealParams={deal} setDealParams={setDealParams} />
        </UIProvider>
      </MemoryRouter>,
    );
  }

  it('renders deal input panel and pricing receipt', async () => {
    renderWorkspace();
    expect(screen.getByTestId('deal-input-panel')).toBeInTheDocument();
    expect(await screen.findByTestId('pricing-receipt')).toBeInTheDocument();
  });

  it('computes pricing result from dealParams and approvalMatrix', () => {
    renderWorkspace();
    expect(mocks.calculatePricing).toHaveBeenCalledWith(
      expect.objectContaining({ productType: 'LOAN_COMM', amount: 5000000 }),
      { autoApprovalThreshold: 15, l1Threshold: 10, l2Threshold: 5 },
    );
  });

  it('does not render optional panels when pricing result is null', () => {
    mocks.calculatePricing.mockImplementation(() => {
      throw new Error('boom');
    });
    renderWorkspace();
    expect(screen.queryByTestId('delegation-audit')).not.toBeInTheDocument();
  });
});
