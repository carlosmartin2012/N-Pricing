import type { Meta, StoryObj } from '@storybook/react';
import React, { useEffect, useState } from 'react';
import { MemoryRouter } from 'react-router';
import StressPricingView from './StressPricingView';
import { DataProvider, useData } from '../../contexts/DataContext';
import { UIProvider } from '../../contexts/UIContext';
import { AuthProvider } from '../../contexts/AuthContext';
import { EntityProvider } from '../../contexts/EntityContext';
import { MarketDataProvider } from '../../contexts/MarketDataContext';
import { GovernanceProvider } from '../../contexts/GovernanceContext';
import { INITIAL_DEAL } from '../../utils/seedData';
import type { ApprovalMatrixConfig, Transaction } from '../../types';

/**
 * Stories for StressPricingView — Ola 6 B.5.
 *
 * Renders 7 rows (Base + 6 EBA GL 2018/02 presets) using the real
 * pricing engine (no mocks). Variants:
 *   - Default: 1 priceable deal, table with 7 rows.
 *   - MultipleDeals: dropdown shows 3 options.
 *   - EmptyBlotter: empty state copy ("No priceable deals…").
 *
 * Activeentity chip is omitted in stories — EntityContext requires
 * an async load that depends on the entities API; the component
 * already renders gracefully without it (chip is conditional).
 */

const matrix: ApprovalMatrixConfig = {
  autoApprovalThreshold: 15,
  l1Threshold: 10,
  l2Threshold: 5,
};

const corporateLoan: Transaction = {
  ...INITIAL_DEAL,
  id: 'DEAL-STORY-001',
  status: 'Draft',
  productType: 'LOAN_COMM',
  currency: 'EUR',
  amount: 5_000_000,
  durationMonths: 36,
  marginTarget: 1.85,
};

const longMortgage: Transaction = {
  ...INITIAL_DEAL,
  id: 'DEAL-STORY-002',
  status: 'Draft',
  productType: 'MORTGAGE',
  currency: 'EUR',
  amount: 250_000,
  durationMonths: 240,
  marginTarget: 1.20,
  ltvPct: 80,
};

const shortDeposit: Transaction = {
  ...INITIAL_DEAL,
  id: 'DEAL-STORY-003',
  status: 'Draft',
  productType: 'DEPOSIT',
  category: 'Liability',
  currency: 'EUR',
  amount: 10_000_000,
  durationMonths: 6,
  marginTarget: 0.45,
};

const DataSeeder: React.FC<{
  deals: Transaction[];
  approvalMatrix: ApprovalMatrixConfig;
  children: React.ReactNode;
}> = ({ deals, approvalMatrix, children }) => {
  const { setDeals, setApprovalMatrix, setIsLoading } = useData();
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    setDeals(deals);
    setApprovalMatrix(approvalMatrix);
    setIsLoading(false);
    setSeeded(true);
  }, [deals, approvalMatrix, setDeals, setApprovalMatrix, setIsLoading]);

  if (!seeded) return null;
  return <>{children}</>;
};

interface DecoratorArgs {
  deals: Transaction[];
}

const meta = {
  title: 'StressPricing/StressPricingView',
  component: StressPricingView,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof StressPricingView>;

export default meta;

type Story = StoryObj<DecoratorArgs>;

const renderStory = (deals: Transaction[]) => (
  <MemoryRouter initialEntries={['/stress-pricing']}>
    <AuthProvider>
      <EntityProvider>
        <MarketDataProvider>
          <GovernanceProvider>
            <DataProvider>
              <UIProvider>
                <DataSeeder deals={deals} approvalMatrix={matrix}>
                  <div style={{ background: 'var(--nfq-bg-root)', minHeight: '100vh' }}>
                    <StressPricingView />
                  </div>
                </DataSeeder>
              </UIProvider>
            </DataProvider>
          </GovernanceProvider>
        </MarketDataProvider>
      </EntityProvider>
    </AuthProvider>
  </MemoryRouter>
);

export const Default: Story = {
  render: () => renderStory([corporateLoan]),
};

export const MultipleDeals: Story = {
  render: () => renderStory([corporateLoan, longMortgage, shortDeposit]),
};

export const EmptyBlotter: Story = {
  render: () => renderStory([]),
};
