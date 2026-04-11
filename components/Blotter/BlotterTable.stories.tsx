import type { Meta, StoryObj } from '@storybook/react';
import BlotterTable from './BlotterTable';
import { INITIAL_DEAL, MOCK_BEHAVIOURAL_MODELS, MOCK_DEALS } from '../../utils/seedData';
import type { Transaction } from '../../types';

const noop = () => undefined;

const formatCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);

const smallSample: Transaction[] = [
  {
    ...INITIAL_DEAL,
    id: 'DL-STORY-001',
    status: 'Draft',
    amount: 4_500_000,
    marginTarget: 2.15,
  },
  {
    ...MOCK_DEALS[0],
    behaviouralModelId: MOCK_BEHAVIOURAL_MODELS[0]?.id,
  },
  {
    ...MOCK_DEALS[3],
    behaviouralModelId: MOCK_BEHAVIOURAL_MODELS[2]?.id,
  },
  {
    ...MOCK_DEALS[4],
    behaviouralModelId: MOCK_BEHAVIOURAL_MODELS[1]?.id,
  },
];

const reviewQueue: Transaction[] = [
  {
    ...MOCK_DEALS[6],
    status: 'Pending_Approval',
    behaviouralModelId: MOCK_BEHAVIOURAL_MODELS[0]?.id,
  },
  {
    ...MOCK_DEALS[8],
    status: 'Pending_Approval',
    behaviouralModelId: MOCK_BEHAVIOURAL_MODELS[2]?.id,
  },
  {
    ...MOCK_DEALS[4],
    id: 'TRD-QUEUE-003',
    status: 'Rejected',
    behaviouralModelId: MOCK_BEHAVIOURAL_MODELS[1]?.id,
  },
  {
    ...MOCK_DEALS[0],
    id: 'TRD-QUEUE-004',
    status: 'Approved',
    behaviouralModelId: MOCK_BEHAVIOURAL_MODELS[0]?.id,
  },
];

const virtualizedSample: Transaction[] = Array.from({ length: 72 }, (_, index) => ({
  ...MOCK_DEALS[index % MOCK_DEALS.length],
  id: `DL-VIRTUAL-${String(index + 1).padStart(3, '0')}`,
  amount: MOCK_DEALS[index % MOCK_DEALS.length]!.amount + index * 175_000,
  marginTarget: Number((1.1 + (index % 8) * 0.28).toFixed(2)),
  status: (['Draft', 'Pending_Approval', 'Approved', 'Booked'][index % 4] as Transaction['status']),
  behaviouralModelId: MOCK_BEHAVIOURAL_MODELS[index % MOCK_BEHAVIOURAL_MODELS.length]?.id,
}));

const meta = {
  title: 'Blotter/BlotterTable',
  component: BlotterTable,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div
        style={{
          background: 'var(--nfq-bg-root)',
          padding: 24,
          minHeight: '100vh',
        }}
      >
        <div
          style={{
            height: 640,
            borderRadius: 24,
            overflow: 'hidden',
            border: '1px solid var(--nfq-border-ghost)',
            background: 'var(--nfq-bg-surface)',
          }}
        >
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    behaviouralModels: MOCK_BEHAVIOURAL_MODELS,
    userRole: 'Admin',
    onWorkflowAction: noop,
    onOpenDossier: noop,
    onCloneDeal: noop,
    onEditDeal: noop,
    onDeleteDeal: noop,
    formatCurrency,
  },
} satisfies Meta<typeof BlotterTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DefaultDeskView: Story = {
  args: {
    deals: smallSample,
  },
};

export const CommitteeQueue: Story = {
  args: {
    deals: reviewQueue,
    userRole: 'Risk_Manager',
  },
};

export const VirtualizedPortfolio: Story = {
  args: {
    deals: virtualizedSample,
  },
};
