import type { Meta, StoryObj } from '@storybook/react';
import ModelInventoryPanel from './ModelInventoryPanel';
import { DEFAULT_SEED } from './modelInventoryConfig';

const validationSeed = DEFAULT_SEED.map((model, index) =>
  index === 0
    ? { ...model, status: 'INTERNAL_VALIDATION' as const, nextValidationDate: '2026-04-01' }
    : model
);

const legacySeed = [
  ...DEFAULT_SEED.slice(0, 4),
  {
    ...DEFAULT_SEED[4],
    id: 'MDL-LEG-001',
    name: 'Legacy Stress Overlay',
    status: 'RETIRED' as const,
    category: 'STRESS_SCENARIO' as const,
    nextValidationDate: '2025-12-31',
  },
];

const meta = {
  title: 'Config/ModelInventoryPanel',
  component: ModelInventoryPanel,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--nfq-bg-root)',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 1440, margin: '0 auto' }}>
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof ModelInventoryPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DefaultInventory: Story = {
  args: {
    initialModels: DEFAULT_SEED,
  },
};

export const ValidationWatchlist: Story = {
  args: {
    initialModels: validationSeed,
  },
};

export const LegacyAndStressMix: Story = {
  args: {
    initialModels: legacySeed,
  },
};
