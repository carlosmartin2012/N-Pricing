import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import React from 'react';
import ClientEmptyStateBanner, { ImportIcon, InitializeIcon } from './ClientEmptyStateBanner';

const meta = {
  title: 'Customer360/ClientEmptyStateBanner',
  component: ClientEmptyStateBanner,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div style={{ background: '#0e0e0e', padding: 32, minHeight: '100vh', maxWidth: 720 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ClientEmptyStateBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoData: Story = {
  args: {
    variant: 'no-data',
    title: 'Customer 360 not yet populated',
    body: 'This client has no positions on file. Import positions from your core banking CSV or run the CLV demo seed to see the full picture.',
    hint: 'Tip: `npm run seed:clv-demo` inserts 3 demo clients with positions, metrics and LTV precomputed.',
    actions: [
      {
        label: 'Import positions (CSV)',
        icon: ImportIcon,
        variant: 'primary',
        href: '/api/customer360/import/positions',
        onClick: action('import-positions'),
      },
    ],
  },
};

export const NoSnapshot: Story = {
  args: {
    variant: 'no-snapshot',
    title: 'CLV not computed yet',
    body: 'This client has positions but no LTV snapshot. One click runs the engine and ranks 2-3 Next-Best-Action candidates.',
    actions: [
      {
        label: 'Initialize CLV for this client',
        icon: InitializeIcon,
        variant: 'primary',
        onClick: action('initialize-clv'),
      },
    ],
  },
};

export const NoSnapshotInitializing: Story = {
  args: {
    variant: 'no-snapshot',
    title: 'CLV not computed yet',
    body: 'This client has positions but no LTV snapshot. One click runs the engine and ranks 2-3 Next-Best-Action candidates.',
    actions: [
      {
        label: 'Computing CLV + NBA…',
        icon: InitializeIcon,
        variant: 'primary',
        disabled: true,
        onClick: action('initialize-clv-pending'),
      },
    ],
  },
};

export const NoSnapshotWithError: Story = {
  args: {
    variant: 'no-snapshot',
    title: 'CLV not computed yet',
    body: 'This client has positions but no LTV snapshot. One click runs the engine and ranks 2-3 Next-Best-Action candidates.',
    errorMessage: 'Initialization failed. Retry or contact ops.',
    actions: [
      {
        label: 'Initialize CLV for this client',
        icon: InitializeIcon,
        variant: 'primary',
        onClick: action('initialize-clv-retry'),
      },
    ],
  },
};
