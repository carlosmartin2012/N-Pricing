import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { MemoryRouter } from 'react-router';
import DealForm from './DealForm';
import { UIProvider } from '../../contexts/UIContext';
import {
  INITIAL_DEAL,
  MOCK_CLIENTS,
  MOCK_BUSINESS_UNITS,
  MOCK_PRODUCT_DEFS,
  MOCK_BEHAVIOURAL_MODELS,
} from '../../utils/seedData';

const meta = {
  title: 'Blotter/DealForm',
  component: DealForm,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/pricing']}>
        <UIProvider>
          <div style={{ background: 'var(--nfq-bg-root)', padding: 24, minHeight: '100vh' }}>
            <Story />
          </div>
        </UIProvider>
      </MemoryRouter>
    ),
  ],
  args: {
    clients: MOCK_CLIENTS,
    businessUnits: MOCK_BUSINESS_UNITS,
    products: MOCK_PRODUCT_DEFS,
    behaviouralModels: MOCK_BEHAVIOURAL_MODELS,
    onChange: action('onChange'),
  },
} satisfies Meta<typeof DealForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewDeal: Story = {
  args: {
    selectedDeal: {},
  },
};

export const EditExistingDeal: Story = {
  args: {
    selectedDeal: { ...INITIAL_DEAL, id: 'DEAL-001' },
  },
};
