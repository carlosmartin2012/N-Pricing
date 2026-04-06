import type { Meta, StoryObj } from '@storybook/react';
import { AccountingSummaryCard } from './AccountingSummaryCard';

/**
 * Summary card used in the Accounting Ledger view.
 * Shows aggregated amounts by currency with a primary highlight
 * and secondary currency breakdown.
 */
const meta = {
  title: 'Accounting/SummaryCard',
  component: AccountingSummaryCard,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 260, background: 'var(--nfq-bg-surface)', padding: 16, borderRadius: 12 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccountingSummaryCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleCurrencyAssets: Story = {
  args: {
    title: 'Total Assets',
    emptyLabel: 'No assets booked',
    breakdown: [{ currency: 'EUR', amount: 12_500_000 }],
    accentClassName: 'text-cyan-400',
  },
};

export const MultiCurrencyAssets: Story = {
  args: {
    title: 'Total Assets',
    emptyLabel: 'No assets booked',
    breakdown: [
      { currency: 'EUR', amount: 12_500_000 },
      { currency: 'USD', amount: 8_200_000 },
      { currency: 'GBP', amount: 3_100_000 },
    ],
    accentClassName: 'text-cyan-400',
  },
};

export const Liabilities: Story = {
  args: {
    title: 'Total Liabilities',
    emptyLabel: 'No liabilities booked',
    breakdown: [
      { currency: 'EUR', amount: 9_800_000 },
      { currency: 'USD', amount: 5_400_000 },
    ],
    accentClassName: 'text-rose-400',
  },
};

export const FTPIncome: Story = {
  args: {
    title: 'FTP Income',
    emptyLabel: 'No FTP income',
    breakdown: [
      { currency: 'EUR', amount: 345_000 },
      { currency: 'USD', amount: 128_000 },
      { currency: 'GBP', amount: 67_000 },
      { currency: 'CHF', amount: 22_000 },
    ],
    accentClassName: 'text-emerald-400',
  },
};

export const Commitments: Story = {
  args: {
    title: 'Off-Balance Commitments',
    emptyLabel: 'No commitments',
    breakdown: [{ currency: 'EUR', amount: 4_750_000 }],
    accentClassName: 'text-amber-400',
  },
};

export const Empty: Story = {
  args: {
    title: 'Total Assets',
    emptyLabel: 'No assets booked',
    breakdown: [],
    accentClassName: 'text-cyan-400',
  },
};

export const DashboardRow: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 24, width: 800 }}>
      <AccountingSummaryCard
        title="Total Assets"
        emptyLabel="No assets"
        breakdown={[
          { currency: 'EUR', amount: 12_500_000 },
          { currency: 'USD', amount: 8_200_000 },
        ]}
        accentClassName="text-cyan-400"
      />
      <AccountingSummaryCard
        title="Total Liabilities"
        emptyLabel="No liabilities"
        breakdown={[
          { currency: 'EUR', amount: 9_800_000 },
          { currency: 'USD', amount: 5_400_000 },
        ]}
        accentClassName="text-rose-400"
      />
      <AccountingSummaryCard
        title="FTP Income"
        emptyLabel="No FTP income"
        breakdown={[{ currency: 'EUR', amount: 345_000 }]}
        accentClassName="text-emerald-400"
      />
      <AccountingSummaryCard
        title="Commitments"
        emptyLabel="No commitments"
        breakdown={[]}
        accentClassName="text-amber-400"
      />
    </div>
  ),
};
