import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { MemoryRouter } from 'react-router';
import PricingReceipt from './PricingReceipt';
import { UIProvider } from '../../contexts/UIContext';
import { DataProvider } from '../../contexts/DataContext';
import { MarketDataProvider } from '../../contexts/MarketDataContext';
import { GovernanceProvider } from '../../contexts/GovernanceContext';
import { AuthProvider } from '../../contexts/AuthContext';
import { INITIAL_DEAL } from '../../utils/seedData';
import type { ApprovalMatrixConfig, Transaction } from '../../types';

const approvalMatrix: ApprovalMatrixConfig = {
  autoApprovalThreshold: 15.0,
  l1Threshold: 10.0,
  l2Threshold: 5.0,
};

const standardDeal: Transaction = {
  ...INITIAL_DEAL,
  id: 'DEAL-STORY-001',
  status: 'Draft',
};

const highMarginDeal: Transaction = {
  ...INITIAL_DEAL,
  id: 'DEAL-STORY-002',
  status: 'Draft',
  marginTarget: 5.0,
  amount: 12_000_000,
  durationMonths: 60,
};

const meta = {
  title: 'Calculator/PricingReceipt',
  component: PricingReceipt,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/pricing']}>
        <AuthProvider>
          <MarketDataProvider>
            <GovernanceProvider>
              <DataProvider>
                <UIProvider>
                  <div style={{ background: 'var(--nfq-bg-root)', padding: 24, maxWidth: 520 }}>
                    <Story />
                  </div>
                </UIProvider>
              </DataProvider>
            </GovernanceProvider>
          </MarketDataProvider>
        </AuthProvider>
      </MemoryRouter>
    ),
  ],
  args: {
    approvalMatrix,
    language: 'en',
    setMatchedMethod: action('setMatchedMethod'),
  },
} satisfies Meta<typeof PricingReceipt>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    deal: standardDeal,
  },
};

export const HighMargin: Story = {
  args: {
    deal: highMarginDeal,
  },
};
